import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import searchNames, {
  NAME_CATEGORY_LABELS,
  clearNameDictionaryCache,
  downloadNameDictionary,
  formatNameCategory,
  getNameDictionaryStatus,
  getNameManifest,
  getNameShardId,
  normalizeNameKey,
  resetNameDictionaryMemoryCache,
} from './nameDictionary';

const PUBLIC_NAMES_DIR = path.resolve(process.cwd(), 'public', 'names');

function createMockCacheStorage() {
  const stores = new Map<string, Map<string, Uint8Array>>();

  const cachesMock = {
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

  return { cachesMock, stores };
}

function createDiskFetch(opts: { online: () => boolean; log: string[] }) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (init?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    opts.log.push(url);
    if (!opts.online()) {
      throw new TypeError('Offline: network unavailable');
    }
    if (!url.startsWith('/names/')) {
      return new Response('Not Found', { status: 404 });
    }
    const rel = url.slice('/names/'.length);
    const fullPath = path.join(PUBLIC_NAMES_DIR, rel);
    if (!fs.existsSync(fullPath)) {
      return new Response('Not Found', { status: 404 });
    }
    const buf = fs.readFileSync(fullPath);
    const contentType = url.endsWith('.json') ? 'application/json' : 'application/gzip';
    return new Response(new Uint8Array(buf), { status: 200, headers: { 'Content-Type': contentType } });
  };
}

function withTestEnv(fn: (ctx: { setOnline: (v: boolean) => void; fetchLog: string[] }) => Promise<void>) {
  return async () => {
    const origFetch = globalThis.fetch;
    const origCaches = globalThis.caches;
    const origIdb = globalThis.indexedDB;

    let isOnline = true;
    const fetchLog: string[] = [];
    const { cachesMock } = createMockCacheStorage();

    Object.defineProperty(globalThis, 'fetch', {
      value: createDiskFetch({ online: () => isOnline, log: fetchLog }),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'caches', {
      value: cachesMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      await clearNameDictionaryCache();
      await fn({
        setOnline: (v: boolean) => {
          isOnline = v;
        },
        fetchLog,
      });
    } finally {
      await clearNameDictionaryCache();
      Object.defineProperty(globalThis, 'fetch', { value: origFetch, configurable: true, writable: true });
      Object.defineProperty(globalThis, 'caches', { value: origCaches, configurable: true, writable: true });
      Object.defineProperty(globalThis, 'indexedDB', { value: origIdb, configurable: true, writable: true });
    }
  };
}

test('manifest and official EDRDG license metadata exist and are complete', withTestEnv(async () => {
  const manifest = await getNameManifest();
  assert.ok(manifest, 'manifest should load');
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.license, 'CC BY-SA 4.0');
  assert.match(manifest.source, /EDRDG/i);
  assert.match(manifest.attribution, /EDRDG/);
  assert.equal(manifest.shardCount, 32);
  assert.equal(manifest.shards.length, 64);
  assert.ok(manifest.totalEntries > 500_000, `expected >500k entries, got ${manifest.totalEntries}`);

  for (const cat of ['surname', 'given', 'fem', 'masc', 'person', 'place', 'station'] as const) {
    assert.ok(manifest.categories[cat] > 0, `expected >0 entries for ${cat}`);
    assert.ok(NAME_CATEGORY_LABELS[cat].length > 0);
    assert.equal(formatNameCategory(cat), NAME_CATEGORY_LABELS[cat]);
  }

  const licenseTxt = fs.readFileSync(path.join(PUBLIC_NAMES_DIR, 'LICENSE.txt'), 'utf8');
  assert.match(licenseTxt, /CC BY-SA 4\.0/);
  assert.match(licenseTxt, /EDRDG/);
}));

test('real JMnedict exact & prefix lookups cover surname, given/fem/masc, person, place, station, and kana', withTestEnv(async ({ fetchLog }) => {
  // Non-Japanese queries perform zero network fetches.
  assert.deepEqual(await searchNames(''), []);
  assert.deepEqual(await searchNames('Tokyo'), []);
  assert.equal(fetchLog.length, 0);

  // Surname + place (exact kanji) — fetches exactly 1 shard.
  const sato = await searchNames('佐藤');
  assert.equal(fetchLog.length, 1);
  assert.ok(sato.length > 0);
  assert.equal(sato[0].surface, '佐藤');
  assert.equal(sato[0].reading, 'さとう');
  assert.equal(sato[0].matchType, 'exact-surface');
  assert.ok(sato[0].categories.includes('surname'));
  assert.ok(sato[0].categoryLabels.includes('Họ'));

  // Full personal name (with space normalization).
  const yamada = await searchNames('山田 太郎');
  const yamadaHit = yamada.find((e) => e.surface === '山田太郎' && e.reading === 'やまだたろう');
  assert.ok(yamadaHit, 'expected 山田太郎');
  assert.equal(yamadaHit.category, 'person');
  assert.equal(yamadaHit.categoryLabel, 'Họ tên');

  // Station (exact kanji + exact kana).
  const shinjukuSta = await searchNames('新宿駅');
  assert.equal(shinjukuSta[0]?.surface, '新宿駅');
  assert.equal(shinjukuSta[0]?.reading, 'しんじゅくえき');
  assert.equal(shinjukuSta[0]?.category, 'station');
  assert.equal(shinjukuSta[0]?.categoryLabel, 'Nhà ga');

  const shinjukuStaKana = await searchNames('しんじゅくえき');
  assert.ok(shinjukuStaKana.some((e) => e.surface === '新宿駅' && e.category === 'station'));

  // Place + prefix ranking: exact 新宿 comes before prefix 新宿駅.
  const shinjuku = await searchNames('新宿', undefined, { limit: 20 });
  assert.equal(shinjuku[0]?.surface, '新宿');
  assert.equal(shinjuku[0]?.reading, 'しんじゅく');
  assert.ok(shinjuku[0]?.categories.includes('place'));
  assert.ok(shinjuku.some((e) => e.surface === '新宿駅' && e.matchType === 'prefix-surface'));

  // Exact-only mode excludes prefix matches.
  const shinjukuExact = await searchNames('新宿', undefined, { includePrefix: false });
  assert.ok(shinjukuExact.length > 0);
  assert.ok(shinjukuExact.every((e) => e.surface === '新宿'));

  // Hiragana & Katakana exact lookup finds kanji surname + kana female given name.
  const satoKana = await searchNames('サトウ', undefined, { limit: 30 });
  assert.ok(satoKana.some((e) => e.surface === '佐藤' && e.reading === 'さとう' && e.matchType === 'exact-reading'));

  const sakura = await searchNames('さくら', undefined, { limit: 30 });
  assert.ok(sakura.some((e) => e.surface === 'さくら' && e.categories.includes('fem')));

  // Male given name & unspecified given name.
  const taro = await searchNames('太郎', undefined, { limit: 30 });
  assert.ok(taro.some((e) => e.reading === 'たろう' && e.categories.includes('masc')));

  const haru = await searchNames('春', undefined, { limit: 30 });
  assert.ok(haru.some((e) => e.categories.includes('given') || e.categories.includes('fem')));
}));

test('lazy-cached shard works offline; uncached offline shard throws while loaded no-match returns []', withTestEnv(async ({ setOnline, fetchLog }) => {
  const onlineRes = await searchNames('東京');
  assert.ok(onlineRes.some((e) => e.surface === '東京' && e.reading === 'とうきょう'));
  assert.equal(fetchLog.length, 1);

  // Genuine no-match on a loaded shard returns [].
  const noMatch = await searchNames('東鬱鬱鬱鬱鬱');
  assert.deepEqual(noMatch, []);

  // Pick a surface whose shard differs from 東京's shard.
  const tokyoShard = getNameShardId('s', normalizeNameKey('東京'));
  const uncachedQuery = getNameShardId('s', normalizeNameKey('京都')) !== tokyoShard ? '京都' : '大阪';
  assert.notEqual(getNameShardId('s', normalizeNameKey(uncachedQuery)), tokyoShard);

  // Simulate cold reload while completely offline.
  resetNameDictionaryMemoryCache();
  setOnline(false);
  fetchLog.length = 0;

  const offlineHit = await searchNames('東京');
  assert.ok(offlineHit.some((e) => e.surface === '東京' && e.reading === 'とうきょう'));
  assert.equal(fetchLog.length, 0, 'cached shard should not touch network offline');

  await assert.rejects(
    () => searchNames(uncachedQuery),
    (err: unknown) => err instanceof Error && /Không thể tải dữ liệu tên riêng/.test(err.message),
  );
}));

test('downloadNameDictionary caches all 64 shards for full offline lookup and respects AbortSignal', withTestEnv(async ({ setOnline, fetchLog }) => {
  const progress: Array<[number, number]> = [];
  await downloadNameDictionary((done, total) => {
    progress.push([done, total]);
  });

  assert.ok(progress.length >= 64);
  assert.deepEqual(progress[progress.length - 1], [64, 64]);

  const status = await getNameDictionaryStatus();
  assert.equal(status.cachedShards, 64);
  assert.equal(status.totalShards, 64);
  assert.equal(status.isComplete, true);
  assert.ok(status.totalBytes > 7_000_000);

  // Go completely offline and clear RAM cache; arbitrary unseen buckets must still work.
  resetNameDictionaryMemoryCache();
  setOnline(false);
  fetchLog.length = 0;

  const osaka = await searchNames('大阪');
  assert.ok(osaka.some((e) => e.surface === '大阪' && e.reading === 'おおさか'));

  const fuji = await searchNames('富士山');
  assert.ok(fuji.some((e) => e.surface === '富士山' && e.reading === 'ふじさん'));

  const shibuyaSta = await searchNames('渋谷駅');
  assert.ok(shibuyaSta.some((e) => e.surface === '渋谷駅' && e.category === 'station'));

  const tokyoKana = await searchNames('とうきょう');
  assert.ok(tokyoKana.some((e) => e.surface === '東京' && e.reading === 'とうきょう'));

  assert.equal(fetchLog.length, 0, 'full offline lookups must make zero network requests');

  // AbortSignal rejects cleanly before any work.
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(() => searchNames('東京', ac.signal), (err: unknown) => (err as Error)?.name === 'AbortError');
}));

function createMockIndexedDB(opts: { failPut?: boolean; initial?: Record<string, unknown> } = {}) {
  const data = new Map<string, unknown>(Object.entries(opts.initial ?? {}));
  return {
    data,
    open() {
      const req: Record<string, unknown> = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({}),
        close: () => {},
        transaction(_store: string, mode: string) {
          const tx: Record<string, unknown> = { oncomplete: null, onerror: null, onabort: null };
          return Object.assign(tx, {
            objectStore() {
              return {
                get(key: string) {
                  const r: Record<string, unknown> = { result: undefined, onsuccess: null, onerror: null };
                  queueMicrotask(() => {
                    r.result = data.get(key);
                    (r.onsuccess as (() => void) | null)?.();
                  });
                  return r;
                },
                getAllKeys() {
                  const r: Record<string, unknown> = { result: [], onsuccess: null, onerror: null };
                  queueMicrotask(() => {
                    r.result = Array.from(data.keys());
                    (r.onsuccess as (() => void) | null)?.();
                  });
                  return r;
                },
                put(value: unknown, key: string) {
                  queueMicrotask(() => {
                    if (opts.failPut && mode === 'readwrite') {
                      (tx.onerror as (() => void) | null)?.();
                      return;
                    }
                    data.set(key, value);
                    (tx.oncomplete as (() => void) | null)?.();
                  });
                },
                clear() {
                  queueMicrotask(() => {
                    data.clear();
                    (tx.oncomplete as (() => void) | null)?.();
                  });
                },
              };
            },
          });
        },
      };
      queueMicrotask(() => {
        req.result = db;
        (req.onsuccess as (() => void) | null)?.();
      });
      return req;
    },
  };
}

test('storage unavailable or failing writes reject downloadNameDictionary while online searchNames still works', withTestEnv(async () => {
  // 1. No storage at all (neither IDB nor Cache Storage).
  Object.defineProperty(globalThis, 'caches', { value: undefined, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });

  const onlineHit = await searchNames('佐藤');
  assert.ok(onlineHit.some((e) => e.surface === '佐藤' && e.reading === 'さとう'));

  await assert.rejects(
    () => downloadNameDictionary(),
    (err: unknown) => err instanceof Error && /bộ nhớ trình duyệt/.test(err.message),
  );

  // 2. Cache Storage put throws (e.g. QuotaExceededError).
  resetNameDictionaryMemoryCache();
  Object.defineProperty(globalThis, 'caches', {
    value: {
      async open() {
        return {
          async match() { return undefined; },
          async put() { throw new Error('QuotaExceededError'); },
          async keys() { return []; },
        };
      },
      async delete() { return true; },
    },
    configurable: true,
    writable: true,
  });

  const onlineHit2 = await searchNames('東京');
  assert.ok(onlineHit2.some((e) => e.surface === '東京' && e.reading === 'とうきょう'));

  await assert.rejects(
    () => downloadNameDictionary(),
    (err: unknown) => err instanceof Error && /bộ nhớ trình duyệt/.test(err.message),
  );

  // 3. Silent drop storage (put resolves without saving): post-download verification rejects.
  resetNameDictionaryMemoryCache();
  Object.defineProperty(globalThis, 'caches', {
    value: {
      async open() {
        return {
          async match() { return undefined; },
          async put() {},
          async keys() { return []; },
        };
      },
      async delete() { return true; },
    },
    configurable: true,
    writable: true,
  });

  await assert.rejects(
    () => downloadNameDictionary(),
    (err: unknown) => err instanceof Error && /xác minh/.test(err.message),
  );
}));

test('failed IDB writes fall back to Cache Storage and status merges IDs across both stores', withTestEnv(async ({ setOnline, fetchLog }) => {
  const failingIdb = createMockIndexedDB({ failPut: true });
  Object.defineProperty(globalThis, 'indexedDB', { value: failingIdb, configurable: true, writable: true });

  await downloadNameDictionary();

  // Seed one shard key in IDB too to ensure ID merging works when both stores hold keys.
  failingIdb.data.set('shard:s-00', new Uint8Array([1]));
  const status = await getNameDictionaryStatus();
  assert.equal(status.cachedShards, 64);
  assert.equal(status.isComplete, true);

  // Verify offline lookup works from Cache Storage fallback after RAM reset.
  resetNameDictionaryMemoryCache();
  setOnline(false);
  fetchLog.length = 0;

  const hit = await searchNames('新宿駅');
  assert.ok(hit.some((e) => e.surface === '新宿駅' && e.category === 'station'));
  assert.equal(fetchLog.length, 0);
}));
