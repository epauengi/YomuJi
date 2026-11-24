// Run: node scripts/check-lookup-controls.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadTsx(filePath, mocks = {}, reactMock = null) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (specifier) => {
    if (specifier === 'react' && reactMock) return reactMock;
    if (specifier in mocks) return mocks[specifier];
    return new Proxy({}, { get: (_, key) => String(key) });
  };
  new Function('require', 'exports', 'module', 'React', output)(req, mod.exports, mod, reactMock);
  return mod.exports;
}

function makeReactHarness(stateOverrides = {}, refOverrides = {}) {
  let stateIndex = 0;
  let refIndex = 0;
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }),
    useState: (initial) => {
      const idx = stateIndex++;
      const resolved = typeof initial === 'function' ? initial() : initial;
      return [idx in stateOverrides ? stateOverrides[idx] : resolved, () => {}];
    },
    useMemo: (fn) => fn(),
    useEffect() {},
    useRef: (value) => {
      const idx = refIndex++;
      return idx in refOverrides ? refOverrides[idx] : { current: value };
    },
  };
  return {
    react,
    reset() {
      stateIndex = 0;
      refIndex = 0;
    },
  };
}

const flatten = (node) =>
  !node || typeof node !== 'object'
    ? []
    : Array.isArray(node)
      ? node.flatMap(flatten)
      : [node, ...flatten(node.props?.children)];

// 1. GrammarExplorer checks against real grammar dataset
const grammarItems = JSON.parse(fs.readFileSync('public/dict/meta/grammar-points.json', 'utf8'));
const countsByLevel = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
for (const item of grammarItems) countsByLevel[item.level] += 1;
const fullGrammarResponse = { items: grammarItems, total: grammarItems.length, countsByLevel };

const tagsMod = loadTsx('src/lib/grammar/tags.ts');
const grammarHarness = makeReactHarness();
const grammarMod = loadTsx(
  'src/components/grammar/GrammarExplorer.tsx',
  {
    'next/navigation': {
      useRouter: () => ({ replace() {} }),
      useSearchParams: () => new URLSearchParams(),
    },
    '@/types/grammar': { GRAMMAR_LEVELS: ['N5', 'N4', 'N3', 'N2', 'N1'] },
    '@/lib/grammar/tags': tagsMod,
    './GrammarDetailCard': {
      GrammarDetailCard: 'GrammarDetailCard',
      GrammarLevelPill: 'GrammarLevelPill',
    },
    './GrammarText': { GrammarText: 'GrammarText' },
  },
  grammarHarness.react,
);

// Grouped tags cover every featured tag with no duplicates
const groupedTags = grammarMod.GRAMMAR_TAG_GROUPS.flatMap((g) => g.tags);
assert.equal(new Set(groupedTags).size, groupedTags.length, 'no duplicate tags across groups');
assert.deepEqual(
  [...groupedTags].sort(),
  [...tagsMod.FEATURED_GRAMMAR_TAGS].sort(),
  'grouped topic filters cover all FEATURED_GRAMMAR_TAGS',
);

// Pagination clamping & deep-link page lookup
assert.equal(grammarMod.clampGrammarPage(0, 526), 1);
assert.equal(grammarMod.clampGrammarPage(-5, 526), 1);
assert.equal(grammarMod.clampGrammarPage(Number.NaN, 526), 1);
assert.equal(grammarMod.clampGrammarPage(99, 10), 1);
assert.equal(grammarMod.clampGrammarPage(99, 0), 1);
assert.equal(grammarMod.clampGrammarPage(99, 526), Math.ceil(526 / grammarMod.GRAMMAR_PAGE_SIZE));
const deepTarget = grammarItems[75];
const expectedDeepPage = Math.floor(75 / grammarMod.GRAMMAR_PAGE_SIZE) + 1;
assert.equal(grammarMod.findGrammarPage(grammarItems, deepTarget.slug), expectedDeepPage);
assert.equal(grammarMod.findGrammarPage(grammarItems, 'non-existent'), 1);

// Initial render button budget & pagination controls
grammarHarness.reset();
const initialGrammarTree = flatten(
  grammarMod.GrammarExplorer({ initialData: fullGrammarResponse }),
);
const initialGrammarButtons = initialGrammarTree.filter((n) => n.type === 'button');
const initialRows = initialGrammarTree.filter(
  (n) => n.type === 'button' && typeof n.props.onClick === 'function' && n.props.className?.includes('px-4 py-3.5'),
);
assert.equal(initialRows.length, grammarMod.GRAMMAR_PAGE_SIZE, 'renders one page of grammar rows');
assert(
  initialGrammarButtons.length <= 36,
  `expected <= 36 buttons in GrammarExplorer, got ${initialGrammarButtons.length}`,
);
const topicSelect = initialGrammarTree.find((n) => n.type === 'select' && n.props.id === 'grammar-topic-filter');
assert(topicSelect, 'renders native topic <select>');
const optgroups = flatten(topicSelect).filter((n) => n.type === 'optgroup');
assert.equal(optgroups.length, grammarMod.GRAMMAR_TAG_GROUPS.length);
const pageSelect = initialGrammarTree.find((n) => n.type === 'select' && n.props.id === 'grammar-page-select');
assert(pageSelect, 'renders native page <select>');
assert.equal(
  flatten(pageSelect).filter((n) => n.type === 'option').length,
  Math.ceil(grammarItems.length / grammarMod.GRAMMAR_PAGE_SIZE),
);

// Deep-linked grammar selection (e.g. from SentenceAnalysis) lands on target page + keeps selection
grammarHarness.reset();
const deepLinkedTree = flatten(
  grammarMod.GrammarExplorer({
    initialData: fullGrammarResponse,
    initialSelected: deepTarget.slug,
    initialTag: 'passive',
  }),
);
const activeDeepRow = deepLinkedTree.find((n) => n.type === 'button' && n.props['aria-current'] === 'true');
assert(activeDeepRow, 'deep-linked item is visible and marked aria-current on initial page');
const detailCards = deepLinkedTree.filter((n) => n.type === 'GrammarDetailCard');
assert(detailCards.length === 2 && detailCards.every((c) => c.props.grammar.id === deepTarget.id));
const deepPageSelect = deepLinkedTree.find((n) => n.type === 'select' && n.props.id === 'grammar-page-select');
assert.equal(deepPageSelect.props.value, expectedDeepPage);
const customTagOption = flatten(
  deepLinkedTree.find((n) => n.type === 'select' && n.props.id === 'grammar-topic-filter'),
).find((n) => n.type === 'option' && n.props.value === 'passive');
assert(customTagOption, 'non-featured URL tag remains visible in topic <select>');

// Small result set omits pagination nav
grammarHarness.reset();
const smallGrammarTree = flatten(
  grammarMod.GrammarExplorer({
    initialData: { items: grammarItems.slice(0, 5), total: 5, countsByLevel },
  }),
);
assert(
  !smallGrammarTree.some((n) => n.type === 'nav' && n.props['aria-label'] === 'Phân trang ngữ pháp'),
  'no pagination nav when results fit on one page',
);

// 2. KanjiComponentSearch checks against real KanjiVG index
const kanjiIndex = JSON.parse(fs.readFileSync('public/dict/meta/kanji-components.json', 'utf8'));
// State indices in KanjiComponentSearch: 0=data, 1=error, 2=selected, 3=minStrokes, 4=maxStrokes, 5=showAllParts, 6=partStrokeFilter, 7=openStrokes
const kanjiHarness = makeReactHarness({ 0: kanjiIndex });
const kanjiMod = loadTsx(
  'src/components/dictionary/KanjiComponentSearch.tsx',
  { 'next/link': { __esModule: true, default: 'Link' } },
  kanjiHarness.react,
);

kanjiHarness.reset();
const kanjiInitialTree = flatten(kanjiMod.KanjiComponentSearch());
const kanjiDetails = kanjiInitialTree.filter((n) => n.type === 'details');
const kanjiButtons = kanjiInitialTree.filter((n) => n.type === 'button');
const kanjiPartButtons = kanjiButtons.filter((n) => typeof n.props['aria-pressed'] === 'boolean');
assert.equal(kanjiDetails.length, 16, 'renders all 16 common stroke groups as native <details>');
assert.equal(kanjiPartButtons.length, 7, 'mounts only the default open 1-stroke group (7 buttons)');
assert(kanjiButtons.length <= 10, `expected <= 10 initial buttons on Kanji page, got ${kanjiButtons.length}`);
const strokeSelect = kanjiInitialTree.find(
  (n) => n.type === 'select' && n.props['aria-label'] === 'Lọc thành phần theo số nét',
);
assert(strokeSelect, 'renders native stroke-group <select>');
assert.equal(flatten(strokeSelect).filter((n) => n.type === 'option').length, 17, 'all + 16 stroke groups');

// Selecting stroke group 8 opens it directly, exposes 青, and keeps results AFTER picker in DOM order
const kanjiStroke8Harness = makeReactHarness({ 0: kanjiIndex, 2: ['氵'], 6: '8' });
const kanjiStroke8Mod = loadTsx(
  'src/components/dictionary/KanjiComponentSearch.tsx',
  { 'next/link': { __esModule: true, default: 'Link' } },
  kanjiStroke8Harness.react,
);
kanjiStroke8Harness.reset();
const stroke8Tree = flatten(kanjiStroke8Mod.KanjiComponentSearch());
assert(
  stroke8Tree.some((n) => n.type === 'button' && n.props.children?.includes('青')),
  'filtering to 8 nét directly exposes 青',
);
const chipIdx = stroke8Tree.findIndex(
  (n) => n.type === 'button' && n.props['aria-label'] === 'Bỏ chọn thành phần 氵',
);
const statusIdx = stroke8Tree.findIndex((n) => n.props?.role === 'status');
const pickerIdx = stroke8Tree.findIndex(
  (n) => n.type === 'section' && n.props['aria-label'] === 'Chọn thành phần Kanji',
);
const resultsIdx = stroke8Tree.findIndex(
  (n) => n.type === 'section' && n.props['aria-labelledby'] === 'kanji-results-heading',
);
const firstResultLinkIdx = stroke8Tree.findIndex((n) => n.type === 'Link');
assert(chipIdx >= 0, 'active selection 氵 remains visible and removable');
assert(statusIdx >= 0 && statusIdx < pickerIdx, 'live status count stays above picker');
assert(chipIdx < pickerIdx, 'selected chip control stays above picker');
assert(pickerIdx >= 0 && resultsIdx > pickerIdx, 'results section renders after picker in DOM order');
assert(firstResultLinkIdx > pickerIdx, 'no result links sit between filter chips and picker');
assert(
  stroke8Tree.some((n) => n.type === 'h2' && n.props.id === 'kanji-results-heading'),
  'results section keeps Kết quả Kanji heading',
);

// Removing a focused picker part that gets filtered out hands focus to stroke select instead of dropping focus
const rarePart = kanjiIndex.components.find((entry) => entry[2].length < 15);
assert(rarePart, 'dataset has a rare part (<15 matches) to test unmount focus retention');
assert.equal(
  kanjiMod.willPartRemainVisible(kanjiIndex, rarePart[0], [], null, null, false),
  false,
  'rare part unmounts when unselected with showAllParts=false',
);
assert.equal(
  kanjiMod.willPartRemainVisible(kanjiIndex, '氵', [], 30, 34, false),
  false,
  'part with 0 matches under active stroke range unmounts when unselected',
);
assert.equal(
  kanjiMod.willPartRemainVisible(kanjiIndex, '氵', [], null, null, false),
  true,
  'common part stays visible when unselected without excluding filter',
);
let focusedStrokeSelect = false;
const rareHarness = makeReactHarness(
  { 0: kanjiIndex, 2: [rarePart[0]], 6: String(rarePart[1]) },
  { 1: { current: { focus: () => { focusedStrokeSelect = true; } } } },
);
const rareMod = loadTsx(
  'src/components/dictionary/KanjiComponentSearch.tsx',
  { 'next/link': { __esModule: true, default: 'Link' } },
  rareHarness.react,
);
rareHarness.reset();
const rareTree = flatten(rareMod.KanjiComponentSearch());
const rareBtn = rareTree.find(
  (n) => n.type === 'button' && n.props['aria-pressed'] === true && n.props.children?.includes(rarePart[0]),
);
assert(rareBtn, 'selected rare part renders in filtered stroke group');
rareBtn.props.onClick();
assert.equal(focusedStrokeSelect, true, 'unselecting a filtered-out part moves focus to stroke select');

// Helper unit checks for empty filtered stroke group + intersection
const sampleGroups = [[1, ['一']], [8, ['青']]];
assert.deepEqual(kanjiMod.filterStrokeGroups(sampleGroups, 8), [[8, ['青']]]);
assert.deepEqual(kanjiMod.filterStrokeGroups(sampleGroups, 15), []);
assert.deepEqual(
  kanjiMod.getVisibleStrokeComponents(sampleGroups, new Set([1]), null).map((g) => [g.strokes, g.open]),
  [[1, true], [8, false]],
);
assert.deepEqual(
  kanjiMod.getVisibleStrokeComponents(sampleGroups, new Set(), 8).map((g) => [g.strokes, g.open]),
  [[8, true]],
);

console.log(
  `PASS lookup controls: grammar buttons=${initialGrammarButtons.length} (rows=${initialRows.length}/526), kanji buttons=${kanjiButtons.length} (parts=${kanjiPartButtons.length}/299, disclosures=${kanjiDetails.length})`,
);
