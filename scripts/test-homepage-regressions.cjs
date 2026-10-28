// Run: node scripts/test-homepage-regressions.cjs
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');

// 1. RootShell must not mount or import global blocking offline prompt
const rootShell = read('src/components/RootShell.tsx');
assert(
  !rootShell.includes('OfflineDictionaryPrompt'),
  'RootShell must not import or render OfflineDictionaryPrompt'
);

// 2. Settings must still provide offline dictionary download
const settings = read('src/app/settings/page.tsx');
assert(
  settings.includes('downloadOfflineDictionary'),
  'Settings must import/call downloadOfflineDictionary'
);
assert(
  /t\u1EA3i d\u1EEF li\u1EC7u offline/i.test(settings),
  'Settings UI must retain offline download action'
);

// 3. Headings hierarchy and semantic tags across homepage & reader
const homePage = read('src/components/HomePage.tsx');
const reader = read('src/components/dictionary/InteractiveJapaneseReader.tsx');

assert(
  /<h1\b/i.test(homePage),
  'HomePage must provide a primary h1 heading'
);
assert(
  /<h2\b[^>]*>[^<]*<Sparkle\b[^>]*\/>\s*T\u1EEB v\u1EF1ng h\u00F4m nay\s*<\/h2>/i.test(homePage),
  'Word-of-the-day section label must be an h2'
);
assert(/<motion\.h3\b/i.test(homePage), 'Word of the day must remain an h3');
assert(
  /<h2\b[^>]*>[\s\S]*?B\u00E0i \u0111\u1ECDc ng\u1EABu nhi\u00EAn[\s\S]*?<\/h2>/i.test(reader) && /<h3\b/i.test(reader),
  'Random article section and article title must use h2 and h3'
);

// 4. Random article reader badge/label must not be labeled as today-only
assert(
  !reader.includes('B\u00E0i \u0111\u1ECDc h\u00F4m nay'),
  'Reader badge must not use misleading "B\u00E0i \u0111\u1ECDc h\u00F4m nay" label for random articles'
);
assert(
  /ng\u1EABu nhi\u00EAn|random/i.test(reader),
  'Reader must indicate random article source in badge/label'
);
assert(
  /aria-label="\u0110\u1ECDc b\u00E0i kh\u00E1c[^\"]*ng\u1EABu nhi\u00EAn/i.test(reader),
  'Refresh button accessible name must include its visible label and indicate randomness'
);

// 5. Minimum 44px touch target on interactive links
const minHitPattern = /\b(min-h-11|min-h-\[44px\]|h-11|h-\[44px\])\b/;

// 5a. Wikipedia external link in reader
const wikiLinkMatch = reader.match(/<a\b[^>]*href=\{url\}[^>]*>/) || reader.match(/<a\b[^>]*wikipedia[^>]*>/i);
assert(
  wikiLinkMatch && minHitPattern.test(wikiLinkMatch[0]),
  'Reader Wikipedia link must provide at least 44px hit size (e.g. min-h-11)'
);

// 5b. Word of the day detail link in HomePage
const wordDetailLinkMatch = homePage.match(/<Link\b[^>]*href=\{wordHref\(wordOfTheDay\)\}[^>]*>/)
  || homePage.match(/<Link\b[^>]*>[\s\S]*?Xem chi ti\u1EBFt/i);
assert(
  wordDetailLinkMatch && minHitPattern.test(wordDetailLinkMatch[0]),
  'HomePage word-of-the-day detail link must provide at least 44px hit size (e.g. min-h-11)'
);

// 6. Hero decorative motion removed from HomePage
assert(
  !homePage.includes('handleMouseMove') && !homePage.includes('mousePos'),
  'Hero mouse parallax motion handlers must be removed from HomePage'
);
assert(
  !/\banimate-orb-\d\b/.test(homePage) && !/\banimate-kanji-(slow|rev)\b/.test(homePage),
  'Hero decorative orb and kanji floating animations must be removed from HomePage'
);

// 7. Hero static decoration and palette preserved against baseline
const baseline = cp.execSync('git show HEAD:src/components/HomePage.tsx', { encoding: 'utf8' });
const extractHero = (code) => {
  const match = code.match(/<section[^>]*bg-\[#123b36\][\s\S]*?<\/section>/);
  return match ? match[0].trim().replace(/\r\n/g, '\n') : null;
};
assert.equal(extractHero(baseline), extractHero(homePage), 'Hero section markup must match git baseline');
assert(homePage.includes("char: '\u5B66'") && homePage.includes("char: '\u65E5'"), 'Hero must preserve static decorative kanji');

// 8. Daily-word loading/error/retry/success state and stable slot
assert(
  !/<div[^>]*grid[^>]*>\s*\{wordOfTheDay\s*&&/i.test(homePage),
  'Word-of-the-day slot must be stable and unconditionally rendered in bento grid'
);
assert(
  homePage.includes('role="status"') && homePage.includes('role="alert"'),
  'HomePage word slot must support loading status and error alert states'
);
assert(
  /onClick=\{handleRetryWord\}[\s\S]*?>\s*Th\u1EED l\u1EA1i\s*<\/button>/i.test(homePage),
  'HomePage must offer a retry button to reload daily word on error'
);

const sIdx = homePage.indexOf('let active = true;');
const eIdx = homePage.indexOf('return () => {', sIdx);
assert(sIdx !== -1 && eIdx !== -1, 'Daily word effect structure must exist');
const effectCode = homePage.slice(sIdx, eIdx);
const transEffect = ts.transpileModule(
  'function runWordEffect(getWordOfTheDay, setWordOfTheDay, setWordLoading, setWordError) { ' + effectCode + ' }',
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText;

const effectVm = { console: { ...console, error: () => {} } };
vm.createContext(effectVm);
vm.runInContext(transEffect + '; this.runWordEffect = runWordEffect;', effectVm);

async function testWordEffect(fetcher) {
  let state = { term: null, loading: false, error: null };
  effectVm.runWordEffect(
    fetcher,
    (t) => { state.term = t; },
    (l) => { state.loading = l; },
    (e) => { state.error = e; }
  );
  await new Promise((r) => setTimeout(r, 10));
  return state;
}

// 9. Sonner history undo merge preserving newer queries (8 cap)
assert(homePage.includes("from 'sonner'"), 'HomePage must import toast from sonner');
const onClickMatch = homePage.match(/onClick:\s*\(\)\s*=>\s*\{([\s\S]*?setRecentSearches\(merged\);[\s\S]*?)\}/);
assert(onClickMatch, 'Must find sonner undo onClick handler in HomePage');

const transUndo = ts.transpileModule(
  'function undo(snapshot, readStoredRecentSearches, setRecentSearches) { ' + onClickMatch[1] + ' }',
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText;

let savedStorage = null;
let currentSearches = null;
const mockStorage = { setItem: (k, v) => { savedStorage = JSON.parse(v); } };
const undoVm = {
  Array,
  Set,
  JSON,
  console: { ...console, error: () => {} },
  localStorage: mockStorage,
  toast: { error: () => {} },
  window: {
    localStorage: mockStorage,
    dispatchEvent: () => true,
  },
  dispatchEvent: () => true,
  CustomEvent: class CustomEvent { constructor(name, detail) { this.name = name; this.detail = detail; } },
  Event: class Event { constructor(name) { this.name = name; } },
};
vm.createContext(undoVm);
vm.runInContext(transUndo + '; this.undo = undo;', undoVm);

(async () => {
  // Test daily-word states: success, rejection, undefined, retry
  const ok = await testWordEffect(() => Promise.resolve({ surface: '\u732B' }));
  assert.equal(ok.loading, false);
  assert.equal(ok.error, null);
  assert.equal(ok.term?.surface, '\u732B');

  const rej = await testWordEffect(() => Promise.reject(new Error('network error')));
  assert.equal(rej.loading, false);
  assert(rej.error && rej.error.includes('Ch\u01B0a th\u1EC3 t\u1EA3i'));
  assert.equal(rej.term, null);

  const undef = await testWordEffect(() => Promise.resolve(undefined));
  assert.equal(undef.loading, false);
  assert(undef.error && undef.error.includes('Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u'));
  assert.equal(undef.term, null);

  const retried = await testWordEffect(() => Promise.resolve({ surface: '\u72AC' }));
  assert.equal(retried.loading, false);
  assert.equal(retried.error, null);
  assert.equal(retried.term?.surface, '\u72AC');

  // Test Sonner undo merge: preserve newer searches & deduplicate
  undoVm.undo(['s1', 's2', 's3'], () => ['n1', 's2'], (m) => { currentSearches = m; });
  assert.deepEqual(Array.from(currentSearches), ['n1', 's2', 's1', 's3']);
  assert.deepEqual(Array.from(savedStorage), ['n1', 's2', 's1', 's3']);

  // Test Sonner undo merge: cap at 8
  undoVm.undo(['1', '2', '3', '4', '5', '6', '7', '8'], () => ['x1', 'x2', 'x3'], (m) => { currentSearches = m; });
  assert.deepEqual(Array.from(currentSearches), ['x1', 'x2', 'x3', '1', '2', '3', '4', '5']);
  assert.equal(currentSearches.length, 8);
  assert.deepEqual(Array.from(savedStorage), ['x1', 'x2', 'x3', '1', '2', '3', '4', '5']);

  console.log('PASS homepage regressions: offline prompt removed, settings download preserved, headings semantic, 44px links, random reader label, hero motion removed, hero git baseline preserved, daily-word states & retry, sonner history undo merge (8 cap)');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
