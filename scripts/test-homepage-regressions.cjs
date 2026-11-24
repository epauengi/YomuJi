// Run: node scripts/test-homepage-regressions.cjs
const assert = require('node:assert/strict');
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

// 3. Headings hierarchy and semantic tags across homepage
const homePage = read('src/components/HomePage.tsx');

assert(
  /<h1\b/i.test(homePage),
  'HomePage must provide a primary h1 heading'
);
assert(
  /<h2\b[^>]*>[^<]*<Sparkle\b[^>]*\/>\s*T\u1EEB v\u1EF1ng h\u00F4m nay\s*<\/h2>/i.test(homePage),
  'Word-of-the-day section label must be an h2'
);
assert(/<h3\b[^>]*>\s*\{wordOfTheDay\.surface\}\s*<\/h3>/i.test(homePage), 'Word of the day must remain an h3');
assert(
  /<h2\b[^>]*>[\s\S]*?Đọc thử từ tủ sách[\s\S]*?<\/h2>/i.test(homePage)
    && /<h3\b[^>]*>\s*\{featuredBook\.japaneseTitle\}\s*<\/h3>/i.test(homePage),
  'Featured Aozora excerpt section and title must use h2 and h3'
);

// 4. Flat Home surfaces, curated local Aozora excerpt, and no random Wikipedia fetch
assert(!homePage.includes('TiltCard'), 'HomePage must use flat surfaces without TiltCard');
assert(
  !homePage.includes('InteractiveJapaneseReader') && !homePage.includes('wikipedia.org'),
  'HomePage must replace random Wikipedia reader with local Aozora excerpt'
);
assert(
  homePage.includes("from '@/data/books'") && homePage.includes('#excerpt'),
  'HomePage must reference local curated book data and link to #excerpt'
);
assert(
  /wordOfTheDay\.reading\s*!==\s*wordOfTheDay\.surface/.test(homePage),
  'HomePage must hide duplicate kana reading when equal to surface'
);

// 5. Minimum 44px touch target on interactive links
const minHitPattern = /\b(min-h-11|min-h-\[44px\]|h-11|h-\[44px\])\b/;

// 5a. Featured book excerpt link in HomePage
const excerptLinkMatch = homePage.match(/<Link\b[^>]*href=\{`\/books\/\$\{featuredBook\.slug\}#excerpt`\}[^>]*>/);
assert(
  excerptLinkMatch && minHitPattern.test(excerptLinkMatch[0]),
  'HomePage curated book excerpt link must provide at least 44px hit size (e.g. min-h-11)'
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

// 7. Entry hero preserved; active-query state intentionally compact.
require('./check-lookup-layout.cjs');
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

const effectVm = { console: { ...console, error: () => {} }, AbortController, setTimeout, clearTimeout };
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

// 9. Undo now delegates persistence to recentSearches; exercise that implementation.
assert(homePage.includes("from 'sonner'"), 'HomePage must import toast from sonner');
assert(homePage.includes('setRecentSearches(restoreRecentSearches(removed))'), 'Undo must restore persisted history');
require('node:child_process').execFileSync(process.execPath, ['scripts/check-home-history.cjs'], { cwd: root, stdio: 'inherit' });

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

  console.log('PASS homepage regressions: offline prompt removed, settings download preserved, headings semantic, 44px links, flat surfaces & curated Aozora excerpt, duplicate WOTD suppression, hero motion removed, entry hero preserved and active query compact, daily-word states & retry, sonner history undo merge (8 cap)');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
