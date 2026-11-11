const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const initSqlJs = require("sql.js");
const { zipSync } = require("fflate");
const { zstdCompressSync } = require("node:zlib");

const root = path.resolve(__dirname, "..");
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
const sourcePath = path.join(root, "src/lib/ankiPackage.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = new Module(sourcePath, module);
compiled.filename = sourcePath;
compiled.paths = Module._nodeModulePaths(path.dirname(sourcePath));
compiled._compile(ts.transpile(source, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  esModuleInterop: true,
}), sourcePath);
const { parseAnkiPackage, MAX_ANKI_PACKAGE_BYTES } = compiled.exports;

async function database(modern, noteFields = "表\u001fkana\u001fmeaning") {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  if (modern) {
    db.run("CREATE TABLE notetypes(id INTEGER PRIMARY KEY, name TEXT)");
    db.run("CREATE TABLE fields(ntid INTEGER, ord INTEGER, name TEXT)");
    db.run("CREATE TABLE notes(id INTEGER, ntid INTEGER, flds TEXT)");
    db.run("INSERT INTO notetypes VALUES(9007199254740993, '単語')");
    db.run("INSERT INTO fields VALUES(9007199254740993, 0, '表'), (9007199254740993, 1, 'かな'), (9007199254740993, 2, '意味')");
    db.run("INSERT INTO notes VALUES(12345678901234567, 9007199254740993, ?)", [noteFields]);
  } else {
    db.run("CREATE TABLE col(models TEXT)");
    db.run("CREATE TABLE notes(id INTEGER, mid INTEGER, flds TEXT)");
    db.run("INSERT INTO col VALUES(?)", [JSON.stringify({
      "42": { name: "単語", flds: [{ name: "表" }, { name: "かな" }, { name: "意味" }] },
    })]);
    db.run("INSERT INTO notes VALUES(123, 42, ?)", [noteFields]);
  }
  const bytes = db.export();
  db.close();
  return bytes;
}

function packageBytes(entries) {
  return zipSync(Object.fromEntries(Object.entries(entries).map(([name, bytes]) => [name, new Uint8Array(bytes)])));
}

async function rejects(bytes, pattern) {
  await assert.rejects(parseAnkiPackage(bytes, wasmPath), (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

(async () => {
  const legacyDatabase = await database(false);
  const legacy = packageBytes({ "collection.anki2": legacyDatabase });
  const legacyResult = await parseAnkiPackage(legacy, wasmPath);
  assert.equal(legacyResult.noteCount, 1);
  assert.deepEqual(legacyResult.models[0], {
    id: "42",
    name: "単語",
    fields: ["表", "かな", "意味"],
    notes: [{ id: "123", fields: ["表", "kana", "meaning"] }],
  });

  const modernDatabase = await database(true);
  const modernCompressed = zstdCompressSync(modernDatabase);
  const frameDescriptor = modernCompressed[4];
  const contentSizeLength = (frameDescriptor >>> 6) === 0
    ? ((frameDescriptor & 0x20) ? 1 : 0)
    : 2 ** (frameDescriptor >>> 6);
  assert.equal(contentSizeLength, 2);
  const modern = packageBytes({
    "collection.anki2": legacyDatabase,
    "collection.anki21": legacyDatabase,
    "collection.anki21b": modernCompressed,
  });
  const modernResult = await parseAnkiPackage(modern, wasmPath);
  assert.equal(modernResult.noteCount, 1);
  assert.equal(modernResult.models[0].id, "9007199254740993");
  assert.equal(modernResult.models[0].notes[0].id, "12345678901234567");
  assert.deepEqual(modernResult.models[0].notes[0].fields, ["表", "kana", "meaning"]);

  await rejects(packageBytes({ "collection.anki2": await database(false, "{{c1::表}}\u001fkana\u001fmeaning") }), /Cloze/);
  await rejects(packageBytes({ "collection.anki2": new Uint8Array([1, 2, 3]) }), /không thể đọc|thiếu bảng/i);
  await rejects(packageBytes({ "collection.anki2": new Uint8Array([0]) }), /không thể đọc|thiếu bảng/i);
  await rejects(packageBytes({ "collection.anki21b": new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0, 0x80]) }), /32 MiB/);
  await rejects(packageBytes({ "collection.anki21b": new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0xa0, 1, 0, 0, 2]) }), /32 MiB/);
  await rejects(packageBytes({
    "collection.anki21b": Buffer.concat([modernCompressed, modernCompressed]),
  }), /nhiều khung/);
  await rejects(new Uint8Array(MAX_ANKI_PACKAGE_BYTES + 1), /50 MiB/);

  const SQL = await initSqlJs();
  const brokenDb = new SQL.Database();
  brokenDb.run("CREATE TABLE notes(id INTEGER, flds TEXT)");
  const brokenDatabase = brokenDb.export();
  brokenDb.close();
  await rejects(packageBytes({ "collection.anki2": brokenDatabase }), /thiếu bảng/i);

  const bombDb = new SQL.Database();
  bombDb.run("CREATE TABLE payload(data BLOB)");
  bombDb.run("INSERT INTO payload VALUES(zeroblob(33554433))");
  const bombDatabase = bombDb.export();
  bombDb.close();
  const bombPackage = zipSync({ "collection.anki2": [bombDatabase, { level: 9 }] });
  assert.ok(bombDatabase.length > 32 * 1024 * 1024);
  assert.ok(bombPackage.length < 32 * 1024 * 1024);
  await rejects(bombPackage, /vượt quá giới hạn kích thước/);

  if (process.env.ANKI_FIXTURE_DIR) {
    fs.mkdirSync(process.env.ANKI_FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.ANKI_FIXTURE_DIR, "anki-legacy.apkg"), legacy);
    fs.writeFileSync(path.join(process.env.ANKI_FIXTURE_DIR, "anki-modern.apkg"), modern);
  }
  console.log("Anki package checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
