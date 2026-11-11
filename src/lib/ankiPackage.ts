import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";
import { Decompress } from "fzstd";

export type AnkiModel = {
  id: string;
  name: string;
  fields: string[];
  notes: { id: string; fields: string[] }[];
};

export type AnkiPackage = { models: AnkiModel[]; noteCount: number };

export const MAX_ANKI_PACKAGE_BYTES = 50 * 1024 * 1024;
const MAX_DATABASE_BYTES = 32 * 1024 * 1024;
const MAX_NOTES = 10_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_FIELDS = 100;
const MAX_FIELD_NAME_LENGTH = 200;
const MAX_FIELD_LENGTH = 100_000;
const UNIT_SEPARATOR = "\u001f";

class AnkiPackageError extends Error {}

function fail(message: string): never {
  throw new AnkiPackageError(message);
}

function concatChunks(chunks: Uint8Array[], length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function extractDatabase(bytes: Uint8Array): { name: string; bytes: Uint8Array } {
  const priorities: Record<string, number> = {
    "collection.anki2": 0,
    "collection.anki21": 1,
    "collection.anki21b": 2,
  };
  let selectedName = "";
  let selected: Uint8Array | null = null;
  let bestPriority = -1;
  const unzip = new Unzip((file) => {
    const name = file.name.split("/").pop() ?? "";
    const priority = priorities[name];
    if (priority === undefined || priority <= bestPriority) return;

    bestPriority = priority;
    selectedName = name;
    selected = null;
    let length = 0;
    const chunks: Uint8Array[] = [];
    file.ondata = (error, chunk, final) => {
      if (error instanceof AnkiPackageError) throw error;
      if (error) fail("Không thể giải nén gói Anki.");
      length += chunk.length;
      const maxBytes = name === "collection.anki21b" ? MAX_ANKI_PACKAGE_BYTES : MAX_DATABASE_BYTES;
      if (length > maxBytes) fail("Cơ sở dữ liệu Anki vượt quá giới hạn kích thước.");
      chunks.push(chunk);
      if (final) selected = concatChunks(chunks, length);
    };
    file.start();
  });
  unzip.register(UnzipPassThrough);
  unzip.register(UnzipInflate);
  try {
    for (let offset = 0; offset < bytes.length; offset += 1024) {
      unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
    }
  } catch (error) {
    if (error instanceof AnkiPackageError) throw error;
    fail("Tệp Anki bị hỏng hoặc không phải gói ZIP hợp lệ.");
  }
  if (!selected || !selectedName) fail("Không tìm thấy cơ sở dữ liệu Anki trong tệp.");
  return { name: selectedName, bytes: selected };
}

function zstdFrameLength(bytes: Uint8Array): number {
  if (bytes.length < 6 || bytes[0] !== 0x28 || bytes[1] !== 0xb5 || bytes[2] !== 0x2f || bytes[3] !== 0xfd) {
    fail("Cơ sở dữ liệu Anki nén Zstandard không hợp lệ.");
  }
  const descriptor = bytes[4];
  if (descriptor & 0x18) fail("Cơ sở dữ liệu Anki nén Zstandard không hợp lệ.");
  const singleSegment = !!(descriptor & 0x20);
  const checksum = !!(descriptor & 0x04);
  const dictionarySize = [0, 1, 2, 4][descriptor & 0x03];
  const contentSizeFlag = descriptor >>> 6;
  const contentSizeLength = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 2 ** contentSizeFlag;
  let offset = 5;
  let windowSize = 0;
  if (!singleSegment) {
    if (offset >= bytes.length) fail("Cơ sở dữ liệu Anki nén Zstandard không hợp lệ.");
    const windowDescriptor = bytes[offset++];
    const windowBase = 2 ** (10 + (windowDescriptor >>> 3));
    windowSize = windowBase + (windowBase / 8) * (windowDescriptor & 7);
  }
  if (offset + dictionarySize + contentSizeLength > bytes.length) {
    fail("Cơ sở dữ liệu Anki nén Zstandard không hợp lệ.");
  }
  let dictionaryId = 0;
  for (let i = 0; i < dictionarySize; i++) dictionaryId += bytes[offset + i] * 2 ** (8 * i);
  if (dictionaryId !== 0) fail("Gói Anki dùng từ điển Zstandard không được hỗ trợ.");
  offset += dictionarySize;
  let contentSize = 0;
  for (let i = 0; i < contentSizeLength; i++) contentSize += bytes[offset + i] * 2 ** (8 * i);
  if (contentSizeLength === 2) contentSize += 256;
  offset += contentSizeLength;
  if (singleSegment) windowSize = contentSize;
  if (windowSize > MAX_DATABASE_BYTES || contentSize > MAX_DATABASE_BYTES) {
    fail("Cơ sở dữ liệu Anki vượt quá 32 MiB.");
  }

  let last = false;
  while (!last) {
    if (offset + 3 > bytes.length) fail("Cơ sở dữ liệu Anki nén Zstandard không hợp lệ.");
    const blockHeader = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    offset += 3;
    last = !!(blockHeader & 1);
    const blockType = (blockHeader >>> 1) & 3;
    const blockSize = blockHeader >>> 3;
    if (blockType === 3 || blockSize > 128 * 1024) fail("Cơ sở dữ liệu Anki nén Zstandard không hợp lệ.");
    offset += blockType === 1 ? 1 : blockSize;
    if (offset > bytes.length) fail("Cơ sở dữ liệu Anki nén Zstandard không hợp lệ.");
  }
  if (checksum) offset += 4;
  if (offset !== bytes.length) fail("Gói Anki chứa nhiều khung Zstandard hoặc dữ liệu không được hỗ trợ.");
  return offset;
}

function decompressDatabase(bytes: Uint8Array): Uint8Array {
  zstdFrameLength(bytes);
  const chunks: Uint8Array[] = [];
  let length = 0;
  const decoder = new Decompress((chunk) => {
    length += chunk.length;
    if (length > MAX_DATABASE_BYTES) fail("Cơ sở dữ liệu Anki vượt quá 32 MiB.");
    chunks.push(chunk);
  });
  try {
    for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
      decoder.push(bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.length)), offset + 64 * 1024 >= bytes.length);
    }
  } catch (error) {
    if (error instanceof AnkiPackageError) throw error;
    fail("Không thể giải nén cơ sở dữ liệu Anki.");
  }
  return concatChunks(chunks, length);
}

type ModelRow = { id: string; name: string; fields: string[]; notes: AnkiModel["notes"] };

function validText(value: unknown, maxLength: number, label: string): string {
  if (typeof value !== "string" || value.length > maxLength) fail(`${label} không hợp lệ hoặc quá dài.`);
  return value;
}

function readLegacyModels(db: Database): ModelRow[] {
  let raw: unknown;
  try {
    raw = db.exec("SELECT models FROM col LIMIT 1")[0]?.values[0]?.[0];
  } catch {
    fail("Cơ sở dữ liệu Anki thiếu thông tin kiểu thẻ cũ.");
  }
  if (typeof raw !== "string") fail("Cơ sở dữ liệu Anki thiếu thông tin kiểu thẻ cũ.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("Thông tin kiểu thẻ trong cơ sở dữ liệu Anki bị hỏng.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("Thông tin kiểu thẻ trong cơ sở dữ liệu Anki bị hỏng.");
  const models = Object.entries(parsed).map(([id, value]) => {
    if (!value || typeof value !== "object") fail("Thông tin kiểu thẻ trong cơ sở dữ liệu Anki bị hỏng.");
    const model = value as { name?: unknown; flds?: unknown };
    if (!Array.isArray(model.flds) || model.flds.length === 0 || model.flds.length > MAX_FIELDS) {
      fail("Kiểu thẻ Anki thiếu trường hoặc vượt quá 100 trường.");
    }
    return {
      id,
      name: validText(model.name, MAX_FIELD_NAME_LENGTH, "Tên kiểu thẻ"),
      fields: model.flds.map((field) => {
        if (!field || typeof field !== "object") fail("Tên trường kiểu thẻ Anki không hợp lệ.");
        return validText((field as { name?: unknown }).name, MAX_FIELD_NAME_LENGTH, "Tên trường");
      }),
      notes: [],
    };
  });
  if (!models.length) fail("Cơ sở dữ liệu Anki không có kiểu thẻ nào.");
  return models;
}

function hasTable(db: Database, table: string): boolean {
  return db.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1", [table]).length > 0;
}

function readModernModels(db: Database): ModelRow[] {
  const models = db.exec("SELECT CAST(id AS TEXT), name FROM notetypes ORDER BY id")[0]?.values ?? [];
  const fields = db.exec("SELECT CAST(ntid AS TEXT), ord, name FROM fields ORDER BY ntid, ord")[0]?.values ?? [];
  const byId = new Map<string, ModelRow>();
  for (const row of models) {
    const id = row[0];
    if (typeof id !== "string") fail("Mã kiểu thẻ Anki không hợp lệ.");
    byId.set(id, { id, name: validText(row[1], MAX_FIELD_NAME_LENGTH, "Tên kiểu thẻ"), fields: [], notes: [] });
  }
  for (const [id, , name] of fields) {
    if (typeof id !== "string" || !byId.has(id)) fail("Trường Anki tham chiếu kiểu thẻ không tồn tại.");
    const model = byId.get(id)!;
    if (model.fields.length >= MAX_FIELDS) fail("Kiểu thẻ Anki vượt quá 100 trường.");
    model.fields.push(validText(name, MAX_FIELD_NAME_LENGTH, "Tên trường"));
  }
  if ([...byId.values()].some((model) => model.fields.length === 0)) fail("Cơ sở dữ liệu Anki thiếu trường kiểu thẻ.");
  if (!byId.size) fail("Cơ sở dữ liệu Anki không có kiểu thẻ nào.");
  return [...byId.values()];
}

function noteModelColumn(db: Database): "mid" | "ntid" {
  const columns = db.exec("PRAGMA table_info(notes)")[0]?.values.map((row) => row[1]);
  if (columns?.includes("mid")) return "mid";
  if (columns?.includes("ntid")) return "ntid";
  fail("Cơ sở dữ liệu Anki thiếu mã kiểu thẻ trong bảng ghi chú.");
}

function readNotes(db: Database, models: ModelRow[]): number {
  const count = db.exec("SELECT COUNT(*) FROM notes")[0]?.values[0]?.[0];
  if (typeof count !== "number" || !Number.isSafeInteger(count)) fail("Không đọc được số ghi chú trong gói Anki.");
  if (count > MAX_NOTES) fail("Gói Anki vượt quá 10.000 ghi chú.");
  const encoder = new TextEncoder();
  let outputBytes = encoder.encode(JSON.stringify({
    models: models.map((model) => ({ ...model, notes: [] })),
    noteCount: count,
  })).length;
  if (outputBytes > MAX_OUTPUT_BYTES) fail("Dữ liệu ghi chú Anki vượt quá giới hạn 8 MiB.");
  const byId = new Map(models.map((model) => [model.id, model]));
  const modelColumn = noteModelColumn(db);
  const rows = db.exec(`SELECT CAST(id AS TEXT), CAST(${modelColumn} AS TEXT), flds FROM notes ORDER BY id`)[0]?.values ?? [];
  for (const [id, modelId, rawFields] of rows) {
    if (typeof id !== "string" || typeof modelId !== "string") fail("Ghi chú Anki có mã không hợp lệ.");
    const model = byId.get(modelId);
    if (!model) fail("Ghi chú Anki tham chiếu kiểu thẻ không tồn tại.");
    if (typeof rawFields !== "string") fail("Nội dung ghi chú Anki không hợp lệ.");
    const fields = rawFields.split(UNIT_SEPARATOR);
    if (fields.length !== model.fields.length) fail("Số trường ghi chú không khớp với kiểu thẻ Anki.");
    if (fields.some((field) => field.length > MAX_FIELD_LENGTH)) fail("Trường ghi chú Anki vượt quá 100.000 ký tự.");
    if (fields.some((field) => /\{\{\s*c\d+::/i.test(field))) {
      fail("Gói Anki có ghi chú Cloze; kiểu ghi chú này chưa được hỗ trợ.");
    }
    const note = { id, fields };
    outputBytes += encoder.encode(JSON.stringify(note)).length + (model.notes.length ? 1 : 0);
    if (outputBytes > MAX_OUTPUT_BYTES) fail("Dữ liệu ghi chú Anki vượt quá giới hạn 8 MiB.");
    model.notes.push(note);
  }
  return count;
}

export async function parseAnkiPackage(
  bytes: Uint8Array,
  wasmPath: string | Uint8Array = "/anki/sql-wasm.wasm",
): Promise<AnkiPackage> {
  try {
    if (bytes.length > MAX_ANKI_PACKAGE_BYTES) fail("Tệp Anki vượt quá 50 MiB.");
    const archive = extractDatabase(bytes);
    let databaseBytes = archive.name === "collection.anki21b" ? decompressDatabase(archive.bytes) : archive.bytes;
    if (databaseBytes.length > MAX_DATABASE_BYTES) fail("Cơ sở dữ liệu Anki vượt quá 32 MiB.");
    const config = typeof wasmPath === "string"
      ? { locateFile: () => wasmPath }
      : { wasmBinary: wasmPath.buffer.slice(wasmPath.byteOffset, wasmPath.byteOffset + wasmPath.byteLength) as ArrayBuffer };
    const SQL = await initSqlJs(config);
    const db = new SQL.Database(databaseBytes);
    try {
      const hasModernTables = hasTable(db, "notetypes") || hasTable(db, "fields");
      let models: ModelRow[];
      if (hasModernTables) {
        if (!hasTable(db, "notetypes") || !hasTable(db, "fields") || !hasTable(db, "notes")) {
          fail("Cơ sở dữ liệu Anki thiếu bảng kiểu thẻ, trường hoặc ghi chú.");
        }
        models = readModernModels(db);
      } else {
        if (!hasTable(db, "col") || !hasTable(db, "notes")) fail("Cơ sở dữ liệu Anki thiếu bảng kiểu thẻ hoặc ghi chú.");
        models = readLegacyModels(db);
      }
      const noteCount = readNotes(db, models);
      const result: AnkiPackage = { models, noteCount };
      if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_OUTPUT_BYTES) {
        fail("Dữ liệu ghi chú Anki vượt quá giới hạn 8 MiB.");
      }
      return result;
    } finally {
      db.close();
    }
  } catch (error) {
    if (error instanceof AnkiPackageError) throw error;
    throw new AnkiPackageError("Không thể đọc gói Anki. Hãy kiểm tra tệp rồi thử lại.");
  }
}
