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
const booksModule = load('src/data/books.ts');
const booksPageSource = fs.readFileSync('src/app/books/[slug]/page.tsx', 'utf8');

function createElement(type, props) {
  return { type, props: props || {} };
}

function collectNodes(node, out = []) {
  if (node == null || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const child of node) collectNodes(child, out);
    return out;
  }
  if (typeof node === 'object') {
    out.push(node);
    collectNodes(node.props?.children, out);
  }
  return out;
}

function collectText(node, out = []) {
  if (node == null || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  if (typeof node === 'object') {
    collectText(node.props?.children, out);
  }
  return out;
}

function renderHomeWithWotd(wordOfTheDay) {
  let stateIndex = 0;
  const stateOverrides = {
    5: wordOfTheDay,
    6: false,
    7: null,
  };
  const home = load('src/components/HomePage.tsx', {
    react: {
      useEffect() {},
      useRef: (initial) => ({ current: initial }),
      useState: (initial) => {
        const idx = stateIndex++;
        return [Object.hasOwn(stateOverrides, idx) ? stateOverrides[idx] : initial, () => {}];
      },
    },
    'react/jsx-runtime': { jsx: createElement, jsxs: createElement, Fragment: Symbol('Fragment') },
    'next/link': { __esModule: true, default: 'Link' },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@phosphor-icons/react': new Proxy({}, { get: (_, key) => String(key) }),
    sonner: { toast: { error() {}, success() {} } },
    '@/components/SearchInput': { SearchInput: 'SearchInput' },
    '@/components/dictionary/TermCard': { TermCard: 'TermCard' },
    '@/components/dictionary/ConjugationAnalysis': { ConjugationAnalysis: 'ConjugationAnalysis' },
    '@/components/dictionary/SentenceAnalysis': { SentenceAnalysis: 'SentenceAnalysis' },
    '@/components/dictionary/NameResults': { NameDictionaryBanner: 'NameDictionaryBanner', NameResults: 'NameResults' },
    '@/components/ui/BookmarkButton': { BookmarkButton: 'BookmarkButton' },
    '@/components/ui/Button': { Button: 'Button' },
    '@/components/AudioButton': { AudioButton: 'AudioButton' },
    '@/lib/mockDictionary': { useDictionary: () => ({ progress: {} }), searchDictionary() {}, getWordOfTheDay() {} },
    '@/lib/navigation': { searchHref: (q) => `/?q=${q}` },
    '@/lib/wordRoutes': { wordHref: (t) => `/word/${t.surface}` },
    '@/lib/browserState': { termBookmark: (t) => t },
    '@/lib/recentSearches': history,
    '@/data/books': booksModule,
  });
  return home.HomePage({ initialQuery: '' });
}

async function check() {
  assert.deepEqual(history.removeRecentSearches('remove'), {
    searches: ['old', 'third'],
    removed: ['remove'],
  });
  stored = JSON.stringify(['new search', 'newer search']);
  assert.deepEqual(history.restoreRecentSearches(['remove']), ['new search', 'newer search', 'remove']);
  assert.equal(JSON.parse(stored).length, 3);
  stored = JSON.stringify(['n1', 's2']);
  assert.deepEqual(history.restoreRecentSearches(['s1', 's2', 's3']), ['n1', 's2', 's1', 's3']);
  stored = JSON.stringify(['x1', 'x2', 'x3']);
  assert.deepEqual(history.restoreRecentSearches(['1', '2', '3', '4', '5', '6', '7', '8']), ['x1', 'x2', 'x3', '1', '2', '3', '4', '5']);
  assert.equal(JSON.parse(stored).length, 8);
  stored = JSON.stringify(['old']);

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

  // Duplicate kana reading must be hidden on Word of the Day when reading === surface
  const kanaTree = renderHomeWithWotd({
    id: 'kana-1',
    surface: 'ありがとう',
    reading: 'ありがとう',
    meaningsVi: ['cảm ơn'],
    isCommon: true,
    examples: [],
  });
  const kanaText = collectText(kanaTree);
  assert.equal(
    kanaText.filter((text) => text === 'ありがとう').length,
    1,
    'Word of the day must hide duplicate reading when equal to surface'
  );

  // Distinct reading must still render when reading !== surface
  const kanjiTree = renderHomeWithWotd({
    id: 'kanji-1',
    surface: '勉強',
    reading: 'べんきょう',
    meaningsVi: ['học tập'],
    isCommon: true,
    examples: [],
  });
  const kanjiText = collectText(kanjiTree);
  assert(kanjiText.includes('勉強') && kanjiText.includes('べんきょう'), 'Word of the day must display reading when distinct from surface');

  // Featured Aozora excerpt link must point to a real curated book with an excerpt and matching #excerpt anchor
  const nodes = collectNodes(kanaTree);
  const excerptLink = nodes.find(
    (node) => node.type === 'Link' && typeof node.props?.href === 'string' && node.props.href.endsWith('#excerpt')
  );
  assert(excerptLink, 'HomePage must render curated book excerpt link ending with #excerpt');
  const slugMatch = excerptLink.props.href.match(/^\/books\/([^/#]+)#excerpt$/);
  assert(slugMatch, `Unexpected book excerpt href: ${excerptLink.props.href}`);
  const referencedBook = booksModule.getBook(slugMatch[1]);
  assert(referencedBook && referencedBook.excerpt.trim().length > 0, `Curated book ${slugMatch[1]} must exist with non-empty excerpt`);
  assert(booksPageSource.includes('id="excerpt"'), 'Book detail page must expose id="excerpt" anchor');

  console.log('PASS history delete/undo storage safety, duplicate WOTD suppression, and curated book excerpt anchor');
}

check().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
