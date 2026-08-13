'use client';

import { useEffect, useState } from 'react';
import type {
  DictionaryManifest,
  DictionaryProgress,
  DictionarySearchResult,
  KanjiDictionarySearchResult,
  KanjiRecord,
  TermRecord,
  JLPTLevel,
  SearchIndexEntry,
  DictionaryShardPayload,
} from '@/types/dictionary';

import { isSupabaseConfigured } from '@/lib/supabaseClient';

// ── In-Memory Cache ─────────────────────────────────────────────────────────

let globalManifest: DictionaryManifest | null = null;
let globalSearchIndex: SearchIndexEntry[] = [];
const globalTermsMap = new Map<string, TermRecord>();
const globalKanjiMap = new Map<string, KanjiRecord>();
let isInitialized = false;
let isInitializing = false;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

let globalProgress: DictionaryProgress = {
  status: 'ready',
  message: 'Từ điển sẵn sàng',
  downloadedBytes: 0,
  totalBytes: 0,
  downloadedShards: 0,
  totalShards: 0,
};

function updateProgress(patch: Partial<DictionaryProgress>) {
  globalProgress = { ...globalProgress, ...patch };
  notifyListeners();
}

// ── Normalize Query ─────────────────────────────────────────────────────────

export function normalizeQuery(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove Vietnamese diacritics
    .replace(/[\s\-_.,!?]/g, '');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ── IndexedDB Storage Engine ────────────────────────────────────────────────

const DB_NAME = 'yomuji_dict_v1';
const STORE_NAME = 'dict_cache';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
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
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCached(key: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore cache write errors
  }
}

// ── Initializer & Shard Loader ───────────────────────────────────────────────

export async function initDictionary() {
  if (isInitialized || isInitializing) return;
  isInitializing = true;

  // 1. If Supabase backend is configured, dictionary is ready INSTANTLY (0ms wait)
  if (isSupabaseConfigured) {
    isInitialized = true;
    isInitializing = false;
    updateProgress({
      status: 'ready',
      message: 'Từ điển sẵn sàng (kết nối Supabase Cloud Database)',
    });
    return;
  }

  try {
    // 2. Try loading cached search index from IndexedDB for 0ms instant start
    const cachedManifest = await getCached<DictionaryManifest>('manifest');
    const cachedSearchIndex = await getCached<SearchIndexEntry[]>('searchIndex');
    const cachedKanji = await getCached<KanjiRecord[]>('kanjiRecords');

    if (cachedManifest && cachedSearchIndex && cachedSearchIndex.length > 0) {
      globalManifest = cachedManifest;
      globalSearchIndex = cachedSearchIndex;

      if (cachedKanji) {
        cachedKanji.forEach((k) => globalKanjiMap.set(k.literal, k));
      }

      isInitialized = true;
      isInitializing = false;

      updateProgress({
        status: 'ready',
        message: `Từ điển sẵn sàng! (${globalSearchIndex.length.toLocaleString()} từ vựng, ${globalKanjiMap.size.toLocaleString()} Kanji)`,
        dataVersion: cachedManifest.dataVersion,
      });

      // Background refresh check
      fetchManifestAndSync().catch(console.error);
      return;
    }

    // 3. Fast Parallel Download flow
    await fetchManifestAndSync();
  } catch (err) {
    console.error('Dictionary init error:', err);
    updateProgress({
      status: 'ready',
      message: 'Từ điển sẵn sàng.',
    });
    isInitialized = true;
    isInitializing = false;
  }
}

async function fetchManifestAndSync() {
  const res = await fetch('/dict/manifest.json');
  if (!res.ok) throw new Error('Failed to fetch manifest');
  const manifest: DictionaryManifest = await res.json();
  globalManifest = manifest;
  await setCached('manifest', manifest);

  const searchShards = manifest.shards.filter((s) => s.type === 'search');
  const kanjiShards = manifest.shards.filter((s) => s.type === 'kanji');

  // Load Search Shards in parallel batches of 10 for ultra-fast download (~300ms total)
  const newSearchIndex: SearchIndexEntry[] = [];
  const BATCH_SIZE = 10;
  for (let i = 0; i < searchShards.length; i += BATCH_SIZE) {
    const chunk = searchShards.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      chunk.map(async (shard) => {
        try {
          const sRes = await fetch(shard.url);
          if (sRes.ok) {
            const payload: DictionaryShardPayload<SearchIndexEntry> = await sRes.json();
            return payload.records;
          }
        } catch (e) {
          console.error(e);
        }
        return [];
      })
    );
    results.forEach((recs) => newSearchIndex.push(...recs));

    // Enable instant search after first batch is loaded
    if (newSearchIndex.length > 0 && !isInitialized) {
      globalSearchIndex = newSearchIndex;
      isInitialized = true;
      updateProgress({
        status: 'ready',
        message: 'Từ điển sẵn sàng tra cứu!',
      });
    }
  }

  globalSearchIndex = newSearchIndex;
  await setCached('searchIndex', newSearchIndex);

  // Load Kanji Shards in parallel
  const kanjiResults = await Promise.all(
    kanjiShards.map(async (shard) => {
      try {
        const sRes = await fetch(shard.url);
        if (sRes.ok) {
          const payload: DictionaryShardPayload<KanjiRecord> = await sRes.json();
          return payload.records;
        }
      } catch (e) {
        console.error(e);
      }
      return [];
    })
  );

  kanjiResults.forEach((records) => {
    records.forEach((k) => globalKanjiMap.set(k.literal, k));
  });

  await setCached('kanjiRecords', Array.from(globalKanjiMap.values()));

  isInitialized = true;
  isInitializing = false;

  updateProgress({
    status: 'ready',
    message: `Từ điển sẵn sàng! (${globalSearchIndex.length.toLocaleString()} từ vựng, ${globalKanjiMap.size.toLocaleString()} Kanji)`,
    dataVersion: manifest.dataVersion,
  });
}

// ── Custom Hook: useDictionary ───────────────────────────────────────────────

export function useDictionary() {
  const [progress, setProgress] = useState<DictionaryProgress>(globalProgress);

  useEffect(() => {
    initDictionary();
    const handleUpdate = () => setProgress(globalProgress);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  return {
    isReady: progress.status === 'ready' || isInitialized,
    progress,
    manifest: globalManifest,
    retry: () => {
      isInitialized = false;
      isInitializing = false;
      initDictionary();
    },
  };
}

// ── Search & Retrieval Public APIs ──────────────────────────────────────────

export async function searchDictionary(query: string, limit = 50): Promise<DictionarySearchResult[]> {
  const trimmed = query.trim();
  const normalized = normalizeQuery(trimmed);

  if (!normalized) {
    return getPopularTerms(limit);
  }

  // 1. Try server API route (Supabase PostgreSQL backend)
  try {
    const apiRes = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && Array.isArray(data.terms) && data.terms.length > 0) {
        return data.terms;
      }
    }
  } catch (e) {
    // API not reachable or offline, fallback to client-side search index
  }

  if (globalSearchIndex.length === 0) {
    await initDictionary();
  }

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

    const isMeaningMatch = entry.meaningsPreview.some((m) => normalizeQuery(m).includes(normalized));
    const isTokenMatch = entry.tokens.some((t) => normalizeQuery(t).includes(normalized));

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
      matchType = 'partial';
    }

    if (score > 0) {
      const termRecord: TermRecord = globalTermsMap.get(entry.termId) || {
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

      results.push({ term: termRecord, score, matchType });
    }

    if (results.length >= limit * 3) break;
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function searchKanjiDictionary(query: string, limit = 8): Promise<KanjiDictionarySearchResult[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const results: KanjiDictionarySearchResult[] = [];

  for (const kanji of globalKanjiMap.values()) {
    const normLiteral = normalizeQuery(kanji.literal);
    const normHanViet = kanji.hanViet.map(normalizeQuery);
    const normOn = kanji.onReadings.map(normalizeQuery);
    const normKun = kanji.kunReadings.map(normalizeQuery);
    const normMeanings = kanji.meanings.map(normalizeQuery);

    const isExactKanji = normLiteral === normalized;
    const isHanVietMatch = normHanViet.some((hv) => hv === normalized || hv.startsWith(normalized));
    const isReadingMatch = [...normOn, ...normKun].some((r) => r.startsWith(normalized));
    const isMeaningMatch = normMeanings.some((m) => m.includes(normalized));

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
      matchType = 'partial';
    }

    if (score > 0) {
      results.push({ kanji, score, matchType });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function findTerm(id: string): Promise<TermRecord | undefined> {
  const decoded = decodeURIComponent(id).trim();

  // 1. Check in-memory map
  if (globalTermsMap.has(decoded)) return globalTermsMap.get(decoded);

  // 2. Search index lookup by ID, surface or reading
  const matchIndex = globalSearchIndex.find(
    (e) => e.termId === decoded || e.surface === decoded || e.reading === decoded
  );

  if (matchIndex) {
    // Lazy load term shard containing this term
    const shardIndex = Math.floor(globalSearchIndex.indexOf(matchIndex) / 2000) + 1;
    const shardUrl = `/dict/terms/shard-${String(shardIndex).padStart(4, '0')}.json`;

    try {
      const res = await fetch(shardUrl);
      if (res.ok) {
        const payload: DictionaryShardPayload<TermRecord> = await res.json();
        payload.records.forEach((t) => globalTermsMap.set(t.id, t));
        return globalTermsMap.get(matchIndex.termId) || globalTermsMap.get(decoded);
      }
    } catch (e) {
      console.error('Failed to load term shard:', e);
    }

    return {
      id: matchIndex.termId,
      sequence: matchIndex.sequence,
      surface: matchIndex.surface,
      reading: matchIndex.reading,
      romaji: matchIndex.romaji,
      meaningsVi: matchIndex.meaningsPreview,
      glossesRaw: matchIndex.meaningsPreview,
      partOfSpeech: matchIndex.partOfSpeech,
      tags: matchIndex.tags,
      score: matchIndex.score,
      isCommon: matchIndex.isCommon,
      kanji: matchIndex.kanji,
      examples: [],
      related: [],
      searchAliases: [matchIndex.surface, matchIndex.reading, matchIndex.romaji],
      source: { jmdict: true },
    };
  }

  return undefined;
}

export async function findKanji(literal: string): Promise<KanjiRecord | undefined> {
  const decoded = decodeURIComponent(literal).trim();
  return globalKanjiMap.get(decoded);
}

export async function getPopularTerms(limit = 12): Promise<DictionarySearchResult[]> {
  if (globalSearchIndex.length === 0) {
    await initDictionary();
  }

  return globalSearchIndex
    .filter((e) => e.isCommon)
    .slice(0, limit)
    .map((e) => ({
      term: globalTermsMap.get(e.termId) || {
        id: e.termId,
        sequence: e.sequence,
        surface: e.surface,
        reading: e.reading,
        romaji: e.romaji,
        meaningsVi: e.meaningsPreview,
        glossesRaw: e.meaningsPreview,
        partOfSpeech: e.partOfSpeech,
        tags: e.tags,
        score: e.score,
        isCommon: e.isCommon,
        kanji: e.kanji,
        examples: [],
        related: [],
        searchAliases: [e.surface, e.reading, e.romaji],
        source: { jmdict: true },
      },
      score: e.score,
      matchType: 'partial' as const,
    }));
}

export async function getWordOfTheDay(): Promise<TermRecord> {
  if (globalSearchIndex.length === 0) {
    await initDictionary();
  }
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const commonEntries = globalSearchIndex.filter((e) => e.isCommon && e.surface.length >= 2);
  const selected = commonEntries[dayOfYear % (commonEntries.length || 1)] || globalSearchIndex[0];

  if (!selected) {
    return {
      id: 'nihon',
      sequence: 1,
      surface: '日本',
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

  const term = await findTerm(selected.termId);
  return (
    term || {
      id: selected.termId,
      sequence: selected.sequence,
      surface: selected.surface,
      reading: selected.reading,
      romaji: selected.romaji,
      meaningsVi: selected.meaningsPreview,
      glossesRaw: selected.meaningsPreview,
      partOfSpeech: selected.partOfSpeech,
      tags: selected.tags,
      score: selected.score,
      isCommon: selected.isCommon,
      kanji: selected.kanji,
      examples: [],
      related: [],
      searchAliases: [selected.surface, selected.reading],
      source: { jmdict: true },
    }
  );
}

export async function getKanjiByLevel(level?: JLPTLevel): Promise<KanjiRecord[]> {
  const allKanji = Array.from(globalKanjiMap.values());
  if (!level) return allKanji;
  return allKanji.filter((k) => k.jlpt === level);
}

export async function getCompoundsForKanji(literal: string, limit = 12): Promise<TermRecord[]> {
  const matches = globalSearchIndex.filter((e) => e.kanji.includes(literal)).slice(0, limit);
  const terms: TermRecord[] = [];
  for (const m of matches) {
    const term = await findTerm(m.termId);
    if (term) terms.push(term);
  }
  return terms;
}
