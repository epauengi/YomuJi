// Run: node scripts/check-home-history.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', output)((key) => {
    assert(Object.hasOwn(dependencies, key), `Unexpected import ${key} in ${file}`);
    return dependencies[key];
  }, exports);
  return exports;
}

let stored = JSON.stringify(['old', 'remove', 'third']);
let blockedOperation = null;
const events = new EventTarget();
global.window = Object.assign(events, {
  localStorage: {
    getItem() {
      if (blockedOperation === 'read') throw new Error('blocked read');
      return stored;
    },
    setItem(_key, value) {
      if (blockedOperation === 'write') throw new Error('blocked write');
      stored = value;
    },
    removeItem() {
      if (blockedOperation === 'remove') throw new Error('blocked remove');
      stored = null;
    },
  },
});

const history = load('src/lib/recentSearches.ts');
const home = load('src/components/HomePage.tsx', {
  react: { useCallback() {}, useEffect() {}, useRef() {}, useState() {} },
  'react/jsx-runtime': { jsx() {}, jsxs() {}, Fragment: Symbol('Fragment') },
  'next/link': {},
  'next/navigation': { useRouter() {} },
  '@phosphor-icons/react': {},
  'motion/react': { motion: new Proxy({}, { get: (_, key) => key }) },
  sonner: { toast: { error() {}, success() {} } },
  '@/components/SearchInput': {},
  '@/components/dictionary/TermCard': {},
  '@/components/dictionary/ConjugationAnalysis': {},
  '@/components/ui/TiltCard': {},
  '@/components/ui/BookmarkButton': {},
  '@/components/AudioButton': {},
  '@/components/dictionary/InteractiveJapaneseReader': {},
  '@/lib/mockDictionary': {},
  '@/lib/tts': {},
  '@/lib/navigation': {},
  '@/lib/wordRoutes': {},
  '@/lib/browserState': {},
  '@/lib/recentSearches': history,
});

async function check() {
  assert.deepEqual(history.removeRecentSearches('remove'), {
    searches: ['old', 'third'],
    removed: ['remove'],
  });
  stored = JSON.stringify(['new search', 'newer search']);
  assert.deepEqual(history.restoreRecentSearches(['remove']), ['new search', 'newer search', 'remove']);
  assert.equal(JSON.parse(stored).length, 3);

  blockedOperation = 'remove';
  const beforeFailure = stored;
  assert.throws(() => history.removeRecentSearches(), /blocked remove/);
  assert.equal(stored, beforeFailure, 'failed deletion must preserve stored history');
  blockedOperation = 'write';
  assert.throws(() => history.restoreRecentSearches(['unsafe']), /blocked write/);
  assert.equal(stored, beforeFailure, 'failed undo must preserve stored history');
  blockedOperation = 'read';
  assert.throws(() => history.restoreRecentSearches(['unsafe']), /blocked read/);
  assert.equal(stored, beforeFailure, 'failed read must not overwrite stored history');
  blockedOperation = null;

  let timeoutCallback;
  let fetchCount = 0;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalFetch = global.fetch;
  global.setTimeout = (callback) => { timeoutCallback = callback; return 1; };
  global.clearTimeout = () => {};
  global.fetch = (_url, options) => {
    fetchCount += 1;
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  };
  try {
    const timedOut = home.fetchRandomWikiArticle(new AbortController().signal);
    timeoutCallback();
    const fallback = await timedOut;
    assert(fallback && fallback.extract.length > 30, 'timeout should return existing fallback article');
    assert.equal(fetchCount, 1, 'timeout should not retry');

    const external = new AbortController();
    const cancelled = home.fetchRandomWikiArticle(external.signal);
    external.abort();
    assert.equal(await cancelled, null, 'external cancellation should not use fallback');
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    global.fetch = originalFetch;
  }

  console.log('PASS bounded Wikipedia timeout/cancellation and history delete/undo storage safety');
}

check().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
