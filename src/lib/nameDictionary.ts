import { gunzipSync } from 'fflate';

export type NameCategory =
  | 'surname'
  | 'given'
  | 'fem'
  | 'masc'
  | 'person'
  | 'place'
  | 'station';

export type NameMatchType =
  | 'exact-surface'
  | 'exact-reading'
  | 'prefix-surface'
  | 'prefix-reading';

export interface NameEntry {
  surface: string;
  reading: string;
  category: NameCategory;
  categories: NameCategory[];
  categoryLabel: string;
  categoryLabels: string[];
  matchType: NameMatchType;
}

export interface SearchNamesOptions {
  limit?: number;
  includePrefix?: boolean;
}

export interface NameShardMeta {
  id: string;
  kind: 's' | 'r';
  bucket: number;
  url: string;
  bytes: number;
  entries: number;
  sha256: string;
}

export interface NameDictionaryManifest {
  schemaVersion: number;
  dataVersion: string;
  source: string;
  sourceUrl: string;
  sourceDate: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  basePath: string;
  shardCount: number;
  totalEntries: number;
  totalBytes: number;
  categories: Record<NameCategory, number>;
  shards: NameShardMeta[];
}

export interface NameDictionaryStatus {
  cachedShards: number;
  totalShards: number;
  totalBytes: number;
  isComplete: boolean;
  dataVersion: string | null;
}

export const NAME_CATEGORY_LABELS: Record<NameCategory, string> = {
  surname: 'Họ',
  given: 'Tên',
  fem: 'Tên nữ',
  masc: 'Tên nam',
  person: 'Họ tên',
  place: 'Địa danh',
  station: 'Nhà ga',
};

const CATEGORY_ORDER: readonly NameCategory[] = [
  'surname',
  'given',
  'fem',
  'masc',
  'person',
  'place',
  'station',
];

const CATEGORY_BIT: Record<NameCategory, number> = {
  surname: 1,
  given: 2,
  fem: 4,
  masc: 8,
  person: 16,
  place: 32,
  station: 64,
};

const SHARD_COUNT = 32;
const DEFAULT_LIMIT = 30;
const MAX_MEMORY_SHARDS = 12;
const DOWNLOAD_CONCURRENCY = 4;
const BASE_PATH = '/names';
const MANIFEST_URL = `${BASE_PATH}/manifest.json`;

const IDB_NAME = 'yomuji_names_v1';
const IDB_STORE = 'shards';
const CACHE_NAME = 'yomuji-names-v1';
const MANIFEST_STORAGE_KEY = 'manifest';

const KANA_ONLY_RE = /^[\u3040-\u309F\u30FC]+$/;
const HAS_JAPANESE_RE = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\u3005\u3006\u309D\u309E\u30FD\u30FE]/;

interface ParsedShardRow {
  surface: string;
  reading: string;
  normSurface: string;
  normReading: string;
  mask: number;
}

// ponytail: fixed 12-shard LRU in RAM (~3-4 MB ceiling); raise or move to worker if shard count grows.
const memoryShards = new Map<string, ParsedShardRow[]>();
const inFlightShards = new Map<string, Promise<ParsedShardRow[] | null>>();
let cachedManifest: NameDictionaryManifest | null = null;

export function formatNameCategory(category: NameCategory): string {
  return NAME_CATEGORY_LABELS[category];
}

export function normalizeNameKey(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s・･]+/g, '')
    .replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function getNameShardId(kind: 's' | 'r', normalizedKey: string, shardCount = SHARD_COUNT): string {
  const cp = normalizedKey.codePointAt(0) ?? 0;
  const bucket = cp % shardCount;
  return `${kind}-${String(bucket).padStart(2, '0')}`;
}

function shardUrl(shardId: string): string {
  return `${BASE_PATH}/shards/${shardId}.tsv.gz`;
}

function shardStorageKey(shardId: string): string {
  return `shard:${shardId}`;
}

function decodeCategories(mask: number): NameCategory[] {
  const out: NameCategory[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (mask & CATEGORY_BIT[cat]) out.push(cat);
  }
  return out;
}

function createAbortError(): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException('Operation aborted.', 'AbortError')
    : Object.assign(new Error('Operation aborted.'), { name: 'AbortError' });
}

function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

// ── Persistent Storage (IndexedDB primary, Cache Storage fallback) ───────────

function hasIndexedDB(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
}

function hasCacheStorage(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.caches !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = globalThis.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise<T | null>((resolve) => {
      const tx = db!.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

async function idbPut(key: string, value: unknown): Promise<boolean> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise<boolean>((resolve) => {
      const tx = db!.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

async function idbKeys(): Promise<string[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise<string[]>((resolve) => {
      const tx = db!.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result as unknown[]).filter((k): k is string => typeof k === 'string'));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

async function idbClear(): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db!.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Best-effort clear.
  } finally {
    db?.close();
  }
}

async function readStoredShardBytes(shardId: string): Promise<Uint8Array | null> {
  if (hasIndexedDB()) {
    const raw = await idbGet<Uint8Array | ArrayBuffer>(shardStorageKey(shardId));
    if (raw instanceof Uint8Array) return raw;
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  }
  if (hasCacheStorage()) {
    try {
      const cache = await globalThis.caches.open(CACHE_NAME);
      const res = await cache.match(shardUrl(shardId));
      if (res) return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

async function writeStoredShardBytes(shardId: string, bytes: Uint8Array): Promise<boolean> {
  if (hasIndexedDB() && (await idbPut(shardStorageKey(shardId), bytes))) {
    return true;
  }
  if (hasCacheStorage()) {
    try {
      const cache = await globalThis.caches.open(CACHE_NAME);
      const copy = new Uint8Array(bytes);
      await cache.put(shardUrl(shardId), new Response(copy, { headers: { 'Content-Type': 'application/gzip' } }));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function readStoredManifest(): Promise<NameDictionaryManifest | null> {
  if (hasIndexedDB()) {
    const manifest = await idbGet<NameDictionaryManifest>(MANIFEST_STORAGE_KEY);
    if (manifest && isManifest(manifest)) return manifest;
  }
  if (hasCacheStorage()) {
    try {
      const cache = await globalThis.caches.open(CACHE_NAME);
      const res = await cache.match(MANIFEST_URL);
      if (res) {
        const parsed: unknown = await res.json();
        if (isManifest(parsed)) return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function writeStoredManifest(manifest: NameDictionaryManifest): Promise<boolean> {
  if (hasIndexedDB() && (await idbPut(MANIFEST_STORAGE_KEY, manifest))) {
    return true;
  }
  if (hasCacheStorage()) {
    try {
      const cache = await globalThis.caches.open(CACHE_NAME);
      await cache.put(
        MANIFEST_URL,
        new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }),
      );
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function listCachedShardIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  if (hasIndexedDB()) {
    for (const key of await idbKeys()) {
      if (key.startsWith('shard:')) ids.add(key.slice(6));
    }
  }
  if (hasCacheStorage()) {
    try {
      const cache = await globalThis.caches.open(CACHE_NAME);
      const reqs = await cache.keys();
      for (const req of reqs) {
        const match = req.url.match(/\/([sr]-\d{2})\.tsv\.gz$/);
        if (match) ids.add(match[1]);
      }
    } catch {
      // Ignore cache read error.
    }
  }
  return ids;
}

function isManifest(value: unknown): value is NameDictionaryManifest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.schemaVersion === 'number' &&
    typeof v.dataVersion === 'string' &&
    typeof v.shardCount === 'number' &&
    typeof v.totalEntries === 'number' &&
    typeof v.totalBytes === 'number' &&
    Array.isArray(v.shards)
  );
}

// ── Decompression & Parsing ──────────────────────────────────────────────────

async function gunzipText(bytes: Uint8Array): Promise<string> {
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return new TextDecoder().decode(bytes);

  if (typeof DecompressionStream !== 'undefined') {
    try {
      const copy = new Uint8Array(bytes);
      const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    } catch {
      // Fall back to fflate when stream decompression is unavailable/fails.
    }
  }
  return new TextDecoder().decode(gunzipSync(bytes));
}

function parseShardTsv(tsv: string): ParsedShardRow[] {
  if (!tsv) return [];
  const lines = tsv.split('\n');
  const rows: ParsedShardRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const t1 = line.indexOf('\t');
    if (t1 === -1) continue;
    const t2 = line.indexOf('\t', t1 + 1);
    if (t2 === -1) continue;
    const surface = line.slice(0, t1);
    const reading = line.slice(t1 + 1, t2) || surface;
    const mask = Number(line.slice(t2 + 1));
    if (!surface || !Number.isFinite(mask) || mask <= 0) continue;
    rows.push({
      surface,
      reading,
      normSurface: normalizeNameKey(surface),
      normReading: normalizeNameKey(reading),
      mask,
    });
  }
  return rows;
}

function getMemoryShard(shardId: string): ParsedShardRow[] | null {
  const existing = memoryShards.get(shardId);
  if (!existing) return null;
  memoryShards.delete(shardId);
  memoryShards.set(shardId, existing);
  return existing;
}

function setMemoryShard(shardId: string, rows: ParsedShardRow[]): void {
  memoryShards.delete(shardId);
  memoryShards.set(shardId, rows);
  if (memoryShards.size > MAX_MEMORY_SHARDS) {
    const oldest = memoryShards.keys().next().value;
    if (oldest !== undefined) memoryShards.delete(oldest);
  }
}

async function fetchShardBytes(shardId: string): Promise<Uint8Array | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(shardUrl(shardId));
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadShard(shardId: string, signal?: AbortSignal): Promise<ParsedShardRow[] | null> {
  signal?.throwIfAborted();
  const fromMem = getMemoryShard(shardId);
  if (fromMem) return fromMem;

  let pending = inFlightShards.get(shardId);
  if (!pending) {
    pending = (async () => {
      let bytes = await readStoredShardBytes(shardId);
      if (!bytes) {
        bytes = await fetchShardBytes(shardId);
        if (!bytes) return null;
        await writeStoredShardBytes(shardId, bytes);
      }
      const text = await gunzipText(bytes);
      const rows = parseShardTsv(text);
      setMemoryShard(shardId, rows);
      return rows;
    })().finally(() => {
      inFlightShards.delete(shardId);
    });
    inFlightShards.set(shardId, pending);
  }

  return raceAbort(pending, signal);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getNameManifest(signal?: AbortSignal): Promise<NameDictionaryManifest | null> {
  signal?.throwIfAborted();
  if (cachedManifest) return cachedManifest;

  const stored = await readStoredManifest();
  if (typeof fetch === 'function') {
    try {
      const res = await fetch(MANIFEST_URL, { signal });
      if (res.ok) {
        const parsed: unknown = await res.json();
        if (isManifest(parsed)) {
          if (stored && stored.dataVersion !== parsed.dataVersion) {
            await clearNameDictionaryCache();
          }
          cachedManifest = parsed;
          await writeStoredManifest(parsed);
          return parsed;
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  if (stored) cachedManifest = stored;
  return stored;
}

export async function getNameDictionaryStatus(signal?: AbortSignal): Promise<NameDictionaryStatus> {
  const manifest = await getNameManifest(signal);
  const cachedIds = await listCachedShardIds();
  const totalShards = manifest ? manifest.shards.length : SHARD_COUNT * 2;
  const cachedShards = manifest
    ? manifest.shards.filter((s) => cachedIds.has(s.id)).length
    : cachedIds.size;

  return {
    cachedShards,
    totalShards,
    totalBytes: manifest?.totalBytes ?? 0,
    isComplete: totalShards > 0 && cachedShards >= totalShards,
    dataVersion: manifest?.dataVersion ?? null,
  };
}

export async function downloadNameDictionary(
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const manifest = await getNameManifest(signal);
  if (!manifest) {
    throw new Error('Không thể tải manifest từ điển tên riêng.');
  }

  const manifestPersisted = await writeStoredManifest(manifest);
  if (!manifestPersisted) {
    throw new Error('Không thể lưu dữ liệu tên riêng vào bộ nhớ trình duyệt.');
  }

  const total = manifest.shards.length;
  const cachedIds = await listCachedShardIds();
  const missing = manifest.shards.filter((s) => !cachedIds.has(s.id));
  let done = total - missing.length;
  onProgress?.(done, total);

  if (missing.length > 0) {
    let cursor = 0;
    const workerCount = Math.min(DOWNLOAD_CONCURRENCY, missing.length);

    async function worker() {
      while (cursor < missing.length) {
        signal?.throwIfAborted();
        const shard = missing[cursor++];
        const res = await fetch(shard.url, { signal });
        if (!res.ok) {
          throw new Error(`Không thể tải shard tên riêng ${shard.id} (${res.status}).`);
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        signal?.throwIfAborted();
        const persisted = await writeStoredShardBytes(shard.id, bytes);
        if (!persisted) {
          throw new Error('Không thể lưu dữ liệu tên riêng vào bộ nhớ trình duyệt.');
        }
        done++;
        onProgress?.(done, total);
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  signal?.throwIfAborted();
  const persistedManifest = await readStoredManifest();
  const persistedIds = await listCachedShardIds();
  const allShardsPersisted = manifest.shards.every((s) => persistedIds.has(s.id));
  if (!persistedManifest || persistedManifest.dataVersion !== manifest.dataVersion || !allShardsPersisted) {
    throw new Error('Không thể xác minh dữ liệu tên riêng đã lưu offline trong bộ nhớ trình duyệt.');
  }
}

export async function searchNames(
  query: string,
  signal?: AbortSignal,
  options?: SearchNamesOptions,
): Promise<NameEntry[]> {
  signal?.throwIfAborted();
  const rawTrimmed = query.trim().normalize('NFKC');
  const normQuery = normalizeNameKey(rawTrimmed);
  if (!normQuery || !HAS_JAPANESE_RE.test(rawTrimmed)) return [];

  const limit = Math.max(1, options?.limit ?? DEFAULT_LIMIT);
  const isKana = KANA_ONLY_RE.test(normQuery);
  const allowPrefix = (options?.includePrefix ?? true) && (isKana ? normQuery.length >= 2 : normQuery.length >= 1);

  const shardId = getNameShardId(isKana ? 'r' : 's', normQuery);
  const rows = await loadShard(shardId, signal);
  signal?.throwIfAborted();
  if (rows === null) {
    throw new Error('Không thể tải dữ liệu tên riêng. Kiểm tra kết nối mạng hoặc tải dữ liệu tên riêng offline.');
  }
  if (rows.length === 0) return [];

  const matches: Array<{
    row: ParsedShardRow;
    tier: number;
    matchType: NameMatchType;
    matchedLen: number;
    categories: NameCategory[];
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let tier = -1;
    let matchType: NameMatchType = 'exact-surface';
    let matchedLen = 0;

    if (row.surface.normalize('NFKC') === rawTrimmed) {
      tier = 0;
      matchType = 'exact-surface';
      matchedLen = row.normSurface.length;
    } else if (row.normSurface === normQuery) {
      tier = 1;
      matchType = 'exact-surface';
      matchedLen = row.normSurface.length;
    } else if (isKana && row.normReading === normQuery) {
      tier = 2;
      matchType = 'exact-reading';
      matchedLen = row.normReading.length;
    } else if (allowPrefix) {
      if (row.normSurface.startsWith(normQuery)) {
        tier = 3;
        matchType = 'prefix-surface';
        matchedLen = row.normSurface.length;
      } else if (isKana && row.normReading.startsWith(normQuery)) {
        tier = 4;
        matchType = 'prefix-reading';
        matchedLen = row.normReading.length;
      }
    }

    if (tier === -1) continue;
    const categories = decodeCategories(row.mask);
    if (categories.length === 0) continue;
    matches.push({ row, tier, matchType, matchedLen, categories });
  }

  matches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tier >= 3 && a.matchedLen !== b.matchedLen) return a.matchedLen - b.matchedLen;
    if (a.categories.length !== b.categories.length) return b.categories.length - a.categories.length;
    if (a.row.surface.length !== b.row.surface.length) return a.row.surface.length - b.row.surface.length;
    if (a.row.reading.length !== b.row.reading.length) return a.row.reading.length - b.row.reading.length;
    if (a.row.surface !== b.row.surface) return a.row.surface < b.row.surface ? -1 : 1;
    return a.row.reading < b.row.reading ? -1 : a.row.reading > b.row.reading ? 1 : 0;
  });

  return matches.slice(0, limit).map(({ row, matchType, categories }) => ({
    surface: row.surface,
    reading: row.reading,
    category: categories[0],
    categories,
    categoryLabel: NAME_CATEGORY_LABELS[categories[0]],
    categoryLabels: categories.map((c) => NAME_CATEGORY_LABELS[c]),
    matchType,
  }));
}

export function resetNameDictionaryMemoryCache(): void {
  memoryShards.clear();
  inFlightShards.clear();
  cachedManifest = null;
}

export async function clearNameDictionaryCache(): Promise<void> {
  resetNameDictionaryMemoryCache();
  if (hasIndexedDB()) {
    await idbClear();
  }
  if (hasCacheStorage()) {
    try {
      await globalThis.caches.delete(CACHE_NAME);
    } catch {
      // Ignore cache delete failure.
    }
  }
}

export default searchNames;
