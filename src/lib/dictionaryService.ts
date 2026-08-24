'use client';

import { useEffect, useState } from 'react';
import type {
  DictionaryManifest,
  DictionaryProgress,
  DictionarySearchResult,
  KanjiDictionarySearchResult,
  KanjiLookupResponse,
  KanjiRecord,
  TermLookupResponse,
  TermRecord,
  JLPTLevel,
  SearchIndexEntry,
  DictionaryShard,
  DictionaryShardPayload,
} from '@/types/dictionary';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

// ── In-Memory Cache ─────────────────────────────────────────────────────────

let globalManifest: DictionaryManifest | null = null;
let globalSearchIndex: SearchIndexEntry[] = [];
const globalTermsMap = new Map<string, TermRecord>();
const globalKanjiMap = new Map<string, KanjiRecord>();
const loadedTermShards = new Set<string>();
const termShardPromises = new Map<string, Promise<void>>();
let isInitialized = false;
let isStaticFallbackReady = false;
let initializationPromise: Promise<void> | null = null;
let cacheHydrationPromise: Promise<void> | null = null;
let staticSyncPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

let globalProgress: DictionaryProgress = {
  status: 'idle',
  message: 'Đang chuẩn bị từ điển...',
  downloadedBytes: 0,
  totalBytes: 0,
  downloadedShards: 0,
  totalShards: 0,
};

function updateProgress(patch: Partial<DictionaryProgress>) {
  globalProgress = { ...globalProgress, ...patch };
  notifyListeners();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu từ điển.';
}

// ── Normalize Query ─────────────────────────────────────────────────────────

export function normalizeQuery(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_.,!?]/g, '');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ── Runtime Validation ──────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDictionaryShard(value: unknown): value is DictionaryShard {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.type === 'string'
    && typeof value.url === 'string'
    && typeof value.bytes === 'number'
    && typeof value.recordCount === 'number';
}

function isDictionaryManifest(value: unknown): value is DictionaryManifest {
  if (!isRecord(value) || !isRecord(value.totals) || !Array.isArray(value.shards)) return false;
  return typeof value.schemaVersion === 'number'
    && typeof value.dataVersion === 'string'
    && typeof value.totals.terms === 'number'
    && typeof value.totals.kanji === 'number'
    && value.shards.every(isDictionaryShard);
}

function isSearchIndexEntry(value: unknown): value is SearchIndexEntry {
  return isRecord(value)
    && typeof value.termId === 'string'
    && typeof value.surface === 'string'
    && typeof value.reading === 'string'
    && Array.isArray(value.meaningsPreview)
    && Array.isArray(value.tokens);
}

function isTermRecord(value: unknown): value is TermRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.surface === 'string'
    && typeof value.reading === 'string'
    && Array.isArray(value.meaningsVi)
    && Array.isArray(value.examples)
    && Array.isArray(value.related);
}

function isKanjiRecord(value: unknown): value is KanjiRecord {
  return isRecord(value)
    && typeof value.literal === 'string'
    && Array.isArray(value.onReadings)
    && Array.isArray(value.kunReadings)
    && Array.isArray(value.hanViet)
    && Array.isArray(value.meanings)
    && Array.isArray(value.strokePaths);
}

function isTermLookupResponse(value: unknown): value is TermLookupResponse {
  return isRecord(value) && (value.term === null || isTermRecord(value.term));
}

function isKanjiLookupResponse(value: unknown): value is KanjiLookupResponse {
  return isRecord(value) && (value.kanji === null || isKanjiRecord(value.kanji));
}

// ── IndexedDB Storage Engine ────────────────────────────────────────────────

const DB_NAME = 'yomuji_dict_v1';
const STORE_NAME = 'dict_cache';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Cache writes are best-effort.
  }
}

// ── Initializer & Static Fallback ───────────────────────────────────────────

function publishKanji(records: KanjiRecord[]) {
  globalKanjiMap.clear();
  records.forEach((record) => globalKanjiMap.set(record.literal, record));
}

function isCompleteSearchCache(manifest: DictionaryManifest, value: unknown): value is SearchIndexEntry[] {
  return Array.isArray(value)
    && value.length === manifest.totals.terms
    && value.every(isSearchIndexEntry);
}

function isCompleteKanjiCache(manifest: DictionaryManifest, value: unknown): value is KanjiRecord[] {
  return Array.isArray(value)
    && value.length === manifest.totals.kanji
    && value.every(isKanjiRecord);
}

async function hydrateCachedDictionary() {
  if (cacheHydrationPromise) return cacheHydrationPromise;

  cacheHydrationPromise = (async () => {
    const [manifestValue, searchValue, kanjiValue] = await Promise.all([
      getCached<unknown>('manifest'),
      getCached<unknown>('searchIndex'),
      getCached<unknown>('kanjiRecords'),
    ]);

    if (!isDictionaryManifest(manifestValue)) return;

    globalManifest = manifestValue;
    if (isCompleteSearchCache(manifestValue, searchValue)) {
      globalSearchIndex = searchValue;
      isInitialized = true;
    }
    if (isCompleteKanjiCache(manifestValue, kanjiValue)) publishKanji(kanjiValue);
    isStaticFallbackReady = globalSearchIndex.length === manifestValue.totals.terms
      && globalKanjiMap.size === manifestValue.totals.kanji;
  })().finally(() => {
    cacheHydrationPromise = null;
  });

  return cacheHydrationPromise;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không thể tải ${url} (${response.status})`);
  return response.json() as Promise<unknown>;
}

async function loadShardRecords<T>(
  shards: DictionaryShard[],
  validate: (value: unknown) => value is T,
  onLoaded: (shard: DictionaryShard) => void,
): Promise<T[]> {
  const records: T[] = [];
  const batchSize = 8;

  for (let index = 0; index < shards.length; index += batchSize) {
    const batch = shards.slice(index, index + batchSize);
    const payloads = await Promise.all(batch.map(async (shard) => {
      const value = await fetchJson(shard.url);
      if (!isRecord(value) || !Array.isArray(value.records)) {
        throw new Error(`Dữ liệu không hợp lệ: ${shard.id}`);
      }

      const payload = value as unknown as DictionaryShardPayload<unknown>;
      if (payload.records.length !== shard.recordCount || !payload.records.every(validate)) {
        throw new Error(`Dữ liệu không đầy đủ: ${shard.id}`);
      }

      onLoaded(shard);
      return payload.records as T[];
    }));
    payloads.forEach((payload) => records.push(...payload));
  }

  return records;
}

async function syncStaticDictionary() {
  const manifestValue = await fetchJson('/dict/manifest.json');
  if (!isDictionaryManifest(manifestValue)) throw new Error('Manifest từ điển không hợp lệ.');
  const manifest = manifestValue;

  if (
    isStaticFallbackReady
    && globalManifest?.dataVersion === manifest.dataVersion
    && globalSearchIndex.length === manifest.totals.terms
    && globalKanjiMap.size === manifest.totals.kanji
  ) {
    globalManifest = manifest;
    updateProgress({
      status: 'ready',
      message: `Từ điển sẵn sàng (${manifest.totals.terms.toLocaleString('vi-VN')} mục từ, ${manifest.totals.kanji.toLocaleString('vi-VN')} Kanji)`,
      dataVersion: manifest.dataVersion,
      error: undefined,
    });
    return;
  }

  const searchShards = manifest.shards.filter((shard) => shard.type === 'search');
  const kanjiShards = manifest.shards.filter((shard) => shard.type === 'kanji');
  const totalShards = searchShards.length + kanjiShards.length;
  const totalBytes = [...searchShards, ...kanjiShards].reduce((sum, shard) => sum + shard.bytes, 0);
  let downloadedShards = 0;
  let downloadedBytes = 0;

  updateProgress({
    status: 'downloading',
    message: 'Đang tải dữ liệu từ điển dự phòng...',
    downloadedBytes: 0,
    totalBytes,
    downloadedShards: 0,
    totalShards,
    error: undefined,
  });

  const onLoaded = (shard: DictionaryShard) => {
    downloadedShards += 1;
    downloadedBytes += shard.bytes;
    updateProgress({ downloadedShards, downloadedBytes });
  };

  const searchRecords = await loadShardRecords(searchShards, isSearchIndexEntry, onLoaded);
  const kanjiRecords = await loadShardRecords(kanjiShards, isKanjiRecord, onLoaded);

  if (searchRecords.length !== manifest.totals.terms || kanjiRecords.length !== manifest.totals.kanji) {
    throw new Error('Dữ liệu từ điển dự phòng chưa đầy đủ.');
  }

  updateProgress({ status: 'indexing', message: 'Đang hoàn tất chỉ mục từ điển...' });

  const previousVersion = globalManifest?.dataVersion;
  globalManifest = manifest;
  globalSearchIndex = searchRecords;
  publishKanji(kanjiRecords);
  isInitialized = true;
  isStaticFallbackReady = true;

  if (previousVersion && previousVersion !== manifest.dataVersion) {
    globalTermsMap.clear();
    loadedTermShards.clear();
    termShardPromises.clear();
  }

  await Promise.all([
    setCached('manifest', manifest),
    setCached('searchIndex', searchRecords),
    setCached('kanjiRecords', kanjiRecords),
  ]);

  updateProgress({
    status: 'ready',
    message: `Từ điển sẵn sàng (${searchRecords.length.toLocaleString('vi-VN')} mục từ, ${kanjiRecords.length.toLocaleString('vi-VN')} Kanji)`,
    dataVersion: manifest.dataVersion,
    downloadedBytes,
    downloadedShards,
    error: undefined,
  });
}

function startStaticSync() {
  if (staticSyncPromise) return staticSyncPromise;

  staticSyncPromise = syncStaticDictionary()
    .catch((error: unknown) => {
      const message = getErrorMessage(error);
      if (isInitialized) {
        updateProgress({
          status: 'ready',
          message: 'Tra cứu trực tuyến sẵn sàng; dữ liệu dự phòng chưa tải được.',
          error: message,
        });
      } else {
        updateProgress({ status: 'error', message: 'Không thể tải từ điển.', error: message });
      }
      throw error;
    })
    .finally(() => {
      staticSyncPromise = null;
    });

  return staticSyncPromise;
}

export function initDictionary(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    updateProgress({ status: 'checking', message: 'Đang kiểm tra dữ liệu từ điển...', error: undefined });

    if (isSupabaseConfigured) {
      isInitialized = true;
      updateProgress({
        status: 'ready',
        message: 'Từ điển trực tuyến sẵn sàng.',
        error: undefined,
      });
      return;
    }

    await hydrateCachedDictionary();
    if (isInitialized) {
      updateProgress({
        status: 'ready',
        message: isStaticFallbackReady
          ? `Từ điển sẵn sàng (${globalSearchIndex.length.toLocaleString('vi-VN')} mục từ, ${globalKanjiMap.size.toLocaleString('vi-VN')} Kanji)`
          : `Chỉ mục tra cứu sẵn sàng (${globalSearchIndex.length.toLocaleString('vi-VN')} mục từ)`,
        dataVersion: globalManifest?.dataVersion,
        error: undefined,
      });
      void startStaticSync().catch((error: unknown) => console.error('Dictionary refresh error:', error));
      return;
    }

    await startStaticSync();
  })()
    .catch((error: unknown) => {
      if (!isInitialized && globalProgress.status !== 'error') {
        updateProgress({ status: 'error', message: 'Không thể tải từ điển.', error: getErrorMessage(error) });
      }
      throw error;
    })
    .finally(() => {
      initializationPromise = null;
    });

  return initializationPromise;
}

async function ensureStaticDictionaryReady() {
  if (isStaticFallbackReady) return;

  await hydrateCachedDictionary();
  if (isStaticFallbackReady) return;

  await startStaticSync();
  if (!isStaticFallbackReady) throw new Error('Dữ liệu từ điển dự phòng chưa sẵn sàng.');
}

// ── Custom Hook: useDictionary ──────────────────────────────────────────────

export function useDictionary() {
  const [progress, setProgress] = useState<DictionaryProgress>(globalProgress);

  useEffect(() => {
    const handleUpdate = () => setProgress(globalProgress);
    listeners.add(handleUpdate);
    void initDictionary().catch(() => {});
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  return {
    isReady: isInitialized,
    progress,
    manifest: globalManifest,
    retry: () => {
      initializationPromise = null;
      if (globalProgress.status === 'error') isInitialized = false;
      void initDictionary().catch(() => {});
    },
  };
}

// ── Search & Retrieval Public APIs ─────────────────────────────────────────

export async function searchDictionary(query: string, limit = 50): Promise<DictionarySearchResult[]> {
  const trimmed = query.trim();
  const normalized = normalizeQuery(trimmed);

  if (!normalized) return getPopularTerms(limit);

  try {
    const apiResponse = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
    if (apiResponse.ok) {
      const value: unknown = await apiResponse.json();
      if (isRecord(value) && Array.isArray(value.terms) && value.terms.length > 0) {
        return value.terms as DictionarySearchResult[];
      }
    }
  } catch {
    // Network failure falls through to the static index.
  }

  if (globalSearchIndex.length === 0) await ensureStaticDictionaryReady();

  const results: DictionarySearchResult[] = [];

  for (const entry of globalSearchIndex) {
    const normSurface = normalizeQuery(entry.surface);
    const normReading = normalizeQuery(entry.reading);
    const normRomaji = normalizeQuery(entry.romaji);
    const isExactSurface = normSurface === normalized;
    const isExactReading = normReading === normalized;
    const isExactRomaji = normRomaji === normalized;
    const isPrefixSurface = normSurface.startsWith(normalized);
    const isPrefixReading = normReading.startsWith(normalized);
    const isMeaningMatch = entry.meaningsPreview.some((meaning) => normalizeQuery(meaning).includes(normalized));
    const isTokenMatch = entry.tokens.some((token) => normalizeQuery(token).includes(normalized));
    let score = 0;
    let matchType: DictionarySearchResult['matchType'] = 'partial';

    if (isExactSurface) {
      score = 20000 + entry.score;
      matchType = 'exact-surface';
    } else if (isExactReading) {
      score = 15000 + entry.score;
      matchType = 'exact-reading';
    } else if (isExactRomaji) {
      score = 12000 + entry.score;
      matchType = 'exact-romaji';
    } else if (isPrefixSurface || isPrefixReading) {
      score = 8000 + entry.score;
      matchType = 'prefix';
    } else if (isMeaningMatch || isTokenMatch) {
      score = 2000 + entry.score;
    }

    if (score > 0) {
      const termRecord = globalTermsMap.get(entry.termId) ?? termFromSearchEntry(entry);
      results.push({ term: termRecord, score, matchType });
    }

    if (results.length >= limit * 3) break;
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function searchKanjiDictionary(query: string, limit = 8): Promise<KanjiDictionarySearchResult[]> {
  const trimmed = query.trim();
  const normalized = normalizeQuery(trimmed);
  if (!normalized) return [];

  try {
    const apiResponse = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
    if (apiResponse.ok) {
      const value: unknown = await apiResponse.json();
      if (isRecord(value) && Array.isArray(value.kanji) && value.kanji.length > 0) {
        return value.kanji as KanjiDictionarySearchResult[];
      }
    }
  } catch {
    // Network failure falls through to the static index.
  }

  if (globalKanjiMap.size === 0) await ensureStaticDictionaryReady();

  const results: KanjiDictionarySearchResult[] = [];
  for (const kanji of globalKanjiMap.values()) {
    const normLiteral = normalizeQuery(kanji.literal);
    const normHanViet = kanji.hanViet.map(normalizeQuery);
    const normOn = kanji.onReadings.map(normalizeQuery);
    const normKun = kanji.kunReadings.map(normalizeQuery);
    const normMeanings = kanji.meanings.map(normalizeQuery);
    const isExactKanji = normLiteral === normalized;
    const isHanVietMatch = normHanViet.some((value) => value === normalized || value.startsWith(normalized));
    const isReadingMatch = [...normOn, ...normKun].some((value) => value.startsWith(normalized));
    const isMeaningMatch = normMeanings.some((value) => value.includes(normalized));
    let score = 0;
    let matchType: KanjiDictionarySearchResult['matchType'] = 'partial';

    if (isExactKanji) {
      score = 20000;
      matchType = 'exact-kanji';
    } else if (isHanVietMatch) {
      score = 15000;
      matchType = 'han-viet';
    } else if (isReadingMatch) {
      score = 10000;
      matchType = 'prefix';
    } else if (isMeaningMatch) {
      score = 5000;
    }

    if (score > 0) results.push({ kanji, score, matchType });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

function termFromSearchEntry(entry: SearchIndexEntry): TermRecord {
  return {
    id: entry.termId,
    sequence: entry.sequence,
    surface: entry.surface,
    reading: entry.reading,
    romaji: entry.romaji,
    meaningsVi: entry.meaningsPreview,
    glossesRaw: entry.meaningsPreview,
    partOfSpeech: entry.partOfSpeech,
    tags: entry.tags,
    score: entry.score,
    isCommon: entry.isCommon,
    kanji: entry.kanji,
    examples: [],
    related: [],
    searchAliases: [entry.surface, entry.reading, entry.romaji],
    source: { jmdict: true },
  };
}

function getTermShardForPosition(position: number) {
  const termShards = globalManifest?.shards.filter((shard) => shard.type === 'terms') ?? [];
  let start = 0;
  for (const shard of termShards) {
    if (position < start + shard.recordCount) return shard;
    start += shard.recordCount;
  }
  return undefined;
}

async function loadTermShard(shard: DictionaryShard) {
  if (loadedTermShards.has(shard.url)) return;
  const existing = termShardPromises.get(shard.url);
  if (existing) return existing;

  const promise = (async () => {
    const value = await fetchJson(shard.url);
    if (!isRecord(value) || !Array.isArray(value.records)
      || value.records.length !== shard.recordCount
      || !value.records.every(isTermRecord)) {
      throw new Error(`Dữ liệu mục từ không đầy đủ: ${shard.id}`);
    }
    value.records.forEach((term) => globalTermsMap.set(term.id, term));
    loadedTermShards.add(shard.url);
  })().finally(() => {
    termShardPromises.delete(shard.url);
  });

  termShardPromises.set(shard.url, promise);
  return promise;
}

async function findLocalTerm(key: string): Promise<TermRecord | undefined> {
  const memoryHit = globalTermsMap.get(key);
  if (memoryHit) return memoryHit;

  const position = globalSearchIndex.findIndex(
    (entry) => entry.termId === key || entry.surface === key || entry.reading === key,
  );
  if (position < 0) return undefined;

  const entry = globalSearchIndex[position];
  const cachedEntry = globalTermsMap.get(entry.termId);
  if (cachedEntry) return cachedEntry;

  const shard = getTermShardForPosition(position);
  if (!shard) throw new Error('Không xác định được phân đoạn mục từ.');
  await loadTermShard(shard);

  const term = globalTermsMap.get(entry.termId);
  if (!term) throw new Error(`Không tìm thấy ${entry.termId} trong phân đoạn đã tải.`);
  return term;
}

function findLocalKanji(literal: string) {
  return globalKanjiMap.get(literal);
}

async function requestTermFromApi(key: string, signal?: AbortSignal) {
  try {
    const response = await fetch(`/api/word/${encodeURIComponent(key)}`, { signal });
    if (!response.ok) return undefined;
    const value: unknown = await response.json();
    return isTermLookupResponse(value) && value.term ? value.term : undefined;
  } catch (error) {
    if (signal?.aborted) throw error;
    return undefined;
  }
}

async function requestKanjiFromApi(literal: string, signal?: AbortSignal) {
  try {
    const response = await fetch(`/api/kanji/${encodeURIComponent(literal)}`, { signal });
    if (!response.ok) return undefined;
    const value: unknown = await response.json();
    return isKanjiLookupResponse(value) && value.kanji ? value.kanji : undefined;
  } catch (error) {
    if (signal?.aborted) throw error;
    return undefined;
  }
}

export async function findTerm(id: string, signal?: AbortSignal): Promise<TermRecord | undefined> {
  const key = id.trim();
  if (!key) return undefined;

  const memoryHit = globalTermsMap.get(key);
  if (memoryHit) return memoryHit;

  const apiTerm = await requestTermFromApi(key, signal);
  if (apiTerm) {
    globalTermsMap.set(apiTerm.id, apiTerm);
    return apiTerm;
  }

  await ensureStaticDictionaryReady();
  signal?.throwIfAborted();
  return findLocalTerm(key);
}

export async function findKanji(literal: string, signal?: AbortSignal): Promise<KanjiRecord | undefined> {
  const key = literal.trim();
  if (!key) return undefined;

  const memoryHit = findLocalKanji(key);
  if (memoryHit) return memoryHit;

  const apiKanji = await requestKanjiFromApi(key, signal);
  if (apiKanji) {
    globalKanjiMap.set(apiKanji.literal, apiKanji);
    return apiKanji;
  }

  await ensureStaticDictionaryReady();
  signal?.throwIfAborted();
  return findLocalKanji(key);
}

export async function getPopularTerms(limit = 12): Promise<DictionarySearchResult[]> {
  if (globalSearchIndex.length === 0) await ensureStaticDictionaryReady();

  return globalSearchIndex
    .filter((entry) => entry.isCommon)
    .slice(0, limit)
    .map((entry) => ({
      term: globalTermsMap.get(entry.termId) ?? termFromSearchEntry(entry),
      score: entry.score,
      matchType: 'partial' as const,
    }));
}

const DAILY_WORD_POOL = [
  '日本', '勉強', '学校', '生活', '友達', '人間', '社会', '自由', '世界', '家族',
  '元気', '希望', '未来', '旅行', '文化', '愛', '平和', '桜', '自然', '歴史',
  '音楽', '季節', '感謝', '挑戦',
];

export async function getWordOfTheDay(): Promise<TermRecord> {
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const selectedSlug = DAILY_WORD_POOL[daysSinceEpoch % DAILY_WORD_POOL.length];
  const term = await findTerm(selectedSlug);
  if (term) return term;

  return {
    id: selectedSlug,
    sequence: 1,
    surface: selectedSlug,
    reading: 'にほん',
    romaji: 'nihon',
    meaningsVi: ['Nhật Bản'],
    glossesRaw: ['Japan'],
    partOfSpeech: ['n'],
    tags: ['P'],
    score: 1000,
    isCommon: true,
    kanji: ['日', '本'],
    examples: [{ id: 'ex-1', termSequence: 1, textJa: '日本は美しい国です。', textVi: 'Nhật Bản là một đất nước xinh đẹp.' }],
    related: [],
    searchAliases: ['日本', 'にほん'],
    source: { jmdict: true },
  };
}

export async function getKanjiByLevel(level?: JLPTLevel): Promise<KanjiRecord[]> {
  if (globalKanjiMap.size === 0) await ensureStaticDictionaryReady();
  const allKanji = Array.from(globalKanjiMap.values());
  return level ? allKanji.filter((kanji) => kanji.jlpt === level) : allKanji;
}

export async function getCompoundsForKanji(literal: string, limit = 12): Promise<TermRecord[]> {
  if (globalSearchIndex.length === 0) await ensureStaticDictionaryReady();
  const matches = globalSearchIndex.filter((entry) => entry.kanji.includes(literal)).slice(0, limit);
  const terms: TermRecord[] = [];

  for (const match of matches) {
    const term = await findLocalTerm(match.termId);
    if (term) terms.push(term);
  }

  return terms;
}
