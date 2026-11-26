import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  downloadNameDictionary,
  getNameDictionaryStatus,
  initNameDictionary,
  searchDictionary,
  searchNameDictionary,
} from '../dictionaryService';
import { clearNameDictionaryCache } from '../nameDictionary';

const PUBLIC_NAMES_DIR = path.resolve(process.cwd(), 'public', 'names');

function createMockCacheStorage() {
  const stores = new Map<string, Map<string, Uint8Array>>();
  return {
    async open(name: string) {
      let store = stores.get(name);
      if (!store) {
        store = new Map();
        stores.set(name, store);
      }
      return {
        async match(key: string) {
          const buf = store!.get(key);
          return buf ? new Response(new Uint8Array(buf)) : undefined;
        },
        async put(key: string, res: Response) {
          store!.set(key, new Uint8Array(await res.arrayBuffer()));
        },
        async keys() {
          return Array.from(store!.keys()).map((url) => ({ url: `https://local.test${url}` }));
        },
      };
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
}

function withEnv(
  handler: (ctx: {
    fetchLog: string[];
    setApiHandler: (fn: (url: string, init?: RequestInit) => Promise<Response>) => void;
    setOnline: (online: boolean) => void;
  }) => Promise<void>,
) {
  return async () => {
    const origFetch = globalThis.fetch;
    const origCaches = globalThis.caches;
    const origIdb = globalThis.indexedDB;

    const fetchLog: string[] = [];
    let isOnline = true;
    let apiHandler: (url: string, init?: RequestInit) => Promise<Response> = async () =>
      Response.json({ source: 'api', terms: [], kanji: [] });

    Object.defineProperty(globalThis, 'caches', {
      value: createMockCacheStorage(),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'fetch', {
      value: async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (init?.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        fetchLog.push(url);
        if (url.startsWith('/api/')) {
          if (!isOnline) throw new TypeError('Offline');
          return apiHandler(url, init);
        }
        if (url.startsWith('/names/')) {
          if (!isOnline) throw new TypeError('Offline');
          const rel = url.slice('/names/'.length);
          const fullPath = path.join(PUBLIC_NAMES_DIR, rel);
          if (!fs.existsSync(fullPath)) return new Response('Not Found', { status: 404 });
          const buf = fs.readFileSync(fullPath);
          return new Response(new Uint8Array(buf), {
            status: 200,
            headers: { 'Content-Type': url.endsWith('.json') ? 'application/json' : 'application/gzip' },
          });
        }
        return new Response('Not Found', { status: 404 });
      },
      configurable: true,
      writable: true,
    });

    try {
      await clearNameDictionaryCache();
      await handler({
        fetchLog,
        setApiHandler: (fn) => {
          apiHandler = fn;
        },
        setOnline: (online) => {
          isOnline = online;
        },
      });
    } finally {
      await clearNameDictionaryCache();
      Object.defineProperty(globalThis, 'fetch', { value: origFetch, configurable: true, writable: true });
      Object.defineProperty(globalThis, 'caches', { value: origCaches, configurable: true, writable: true });
      Object.defineProperty(globalThis, 'indexedDB', { value: origIdb, configurable: true, writable: true });
    }
  };
}

test('searchNameDictionary uses /api/search when namesSupported is true and skips local shards', withEnv(async ({ fetchLog, setApiHandler }) => {
  setApiHandler(async () => Response.json({
    source: 'api',
    terms: [],
    kanji: [],
    namesSupported: true,
    names: [
      { surface: '佐藤', reading: 'さとう', category: 'surname', matchType: 'exact-surface' },
      { surface: '佐藤栄作', reading: 'さとうえいさく', category: 'person', matchType: 'prefix-surface' },
    ],
  }));

  const all = await searchNameDictionary('佐藤', undefined, { limit: 10 });
  assert.equal(all.length, 2);
  assert.equal(all[0].surface, '佐藤');
  assert.equal(all[0].categoryLabel, 'Họ');
  assert.equal(fetchLog.some((u) => u.startsWith('/names/')), false);

  const exactOnly = await searchNameDictionary('佐藤', undefined, { includePrefix: false });
  assert.deepEqual(exactOnly.map((e) => e.surface), ['佐藤']);
  assert.equal(fetchLog.some((u) => u.includes('includePrefix=false')), true);

  // Regular dictionary search still accepts extended API responses cleanly
  const dictTerms = await searchDictionary('佐藤', 10);
  assert.deepEqual(dictTerms, []);
}));

test('searchNameDictionary falls back to gz shards when API lacks namesSupported or errors', withEnv(async ({ fetchLog, setApiHandler }) => {
  // Case 1: unextended API (namesSupported undefined)
  setApiHandler(async () => Response.json({ source: 'api', terms: [], kanji: [] }));
  const fromShard = await searchNameDictionary('佐藤', undefined, { includePrefix: false });
  assert.ok(fromShard.some((e) => e.surface === '佐藤' && e.categories.includes('surname')));
  assert.ok(fetchLog.some((u) => u.startsWith('/names/shards/')));

  // Case 2: namesSupported: false
  fetchLog.length = 0;
  setApiHandler(async () => Response.json({ source: 'api', terms: [], kanji: [], namesSupported: false, names: [] }));
  const fromShard2 = await searchNameDictionary('渋谷', undefined, { includePrefix: false });
  assert.ok(fromShard2.some((e) => e.surface === '渋谷'));

  // Case 3: API 503
  setApiHandler(async () => new Response('Unavailable', { status: 503 }));
  const fromShard3 = await searchNameDictionary('新宿駅', undefined, { includePrefix: false });
  assert.ok(fromShard3.some((e) => e.surface === '新宿駅' && e.categories.includes('station')));
}));

test('searchNameDictionary respects AbortSignal without falling back', withEnv(async ({ fetchLog }) => {
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(() => searchNameDictionary('佐藤', ac.signal), (err: unknown) => (err as Error)?.name === 'AbortError');
  assert.equal(fetchLog.length, 0);
}));

test('downloadNameDictionary and status stay separate from main dict shards and support offline search', withEnv(async ({ fetchLog, setOnline }) => {
  const before = await initNameDictionary();
  assert.equal(before.isComplete, false);
  assert.equal(before.totalShards, 64);

  const ticks: Array<[number, number]> = [];
  await downloadNameDictionary((done, total) => ticks.push([done, total]));
  assert.ok(ticks.length > 0);
  assert.deepEqual(ticks[ticks.length - 1], [64, 64]);
  assert.equal(fetchLog.some((u) => u.startsWith('/dict/')), false);

  const after = await getNameDictionaryStatus();
  assert.equal(after.isComplete, true);
  assert.equal(after.cachedShards, 64);

  // Disconnect network and verify offline lookup succeeds from cached gz shards
  setOnline(false);
  const offlineRes = await searchNameDictionary('東京', undefined, { includePrefix: false });
  assert.ok(offlineRes.some((e) => e.surface === '東京'));
}));
