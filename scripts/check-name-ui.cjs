// Run: node scripts/check-name-ui.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function transpile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
}

const flatten = (node) => !node || typeof node !== 'object'
  ? []
  : Array.isArray(node)
    ? node.flatMap(flatten)
    : [node, ...flatten(node.props?.children)];

const expandTree = (node) => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(expandTree);
  if (typeof node.type === 'function') {
    return expandTree(node.type(node.props));
  }
  return [node, ...expandTree(node.props?.children)];
};

const textOf = (node) => expandTree(node)
  .flatMap((n) => (Array.isArray(n.props?.children) ? n.props.children : [n.props?.children]))
  .filter((c) => typeof c === 'string' || typeof c === 'number')
  .map(String)
  .join('');

const sato = {
  surface: '佐藤',
  reading: 'さとう',
  category: 'surname',
  categories: ['surname'],
  categoryLabel: 'Họ',
  categoryLabels: ['Họ'],
  matchType: 'exact-surface',
};

const shibuya = {
  surface: '渋谷',
  reading: 'しぶや',
  category: 'place',
  categories: ['place', 'station'],
  categoryLabel: 'Địa danh',
  categoryLabels: ['Địa danh', 'Nhà ga'],
  matchType: 'exact-surface',
};

// ── 1. HomePage inline name integration ──────────────────────────────────────

function renderHome(query, settledSearch) {
  let stateCall = 0;
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (value) => [stateCall++ === 1 ? settledSearch : value, () => {}],
    useEffect() {},
    useRef: (value) => ({ current: value }),
  };
  const mod = { exports: {} };
  vm.runInNewContext(transpile('src/components/HomePage.tsx'), {
    exports: mod.exports,
    React: react,
    require: (name) => {
      if (name === 'react') return react;
      if (name === 'next/link') return { __esModule: true, default: 'Link' };
      if (name === 'next/navigation') return { useRouter: () => ({ push() {} }) };
      if (name === '@/lib/mockDictionary') return { useDictionary: () => ({ progress: {} }), searchDictionary() {}, searchNameDictionary() {}, getWordOfTheDay() {} };
      if (name === '@/components/AudioButton') return { AudioButton: 'AudioButton' };
      if (name === '@/components/dictionary/TermCard') return { TermCard: 'TermCard' };
      if (name === '@/components/ui/Button') return { Button: 'Button' };
      return new Proxy({}, { get: (_, key) => String(key) });
    },
  });
  return flatten(mod.exports.HomePage({ initialQuery: query }));
}

const landing = renderHome('', null);
assert(!landing.some((n) => n.type === 'NameDictionaryBanner' || n.type === 'NameResults'), 'HomePage landing must not render standalone name banner');

const namesOnly = renderHome('佐藤', { query: '佐藤', attempt: 0, results: [], names: [sato] });
const namesOnlyStatus = namesOnly.find((n) => n.props.role === 'status');
assert.equal(namesOnlyStatus.props.children.join(''), 'Hiển thị 1 tên riêng');
assert(namesOnly.some((n) => n.type === 'h3' && n.props.children.includes('Tên riêng')));
assert(namesOnly.some((n) => n.type === 'AudioButton' && n.props.text === 'さとう'));
assert(!namesOnly.some((n) => n.type === 'Link' && String(n.props.href).startsWith('/word/')), 'Name results must not link to /word');
assert(!namesOnly.some((n) => n.type === 'Button' && n.props.children?.includes('Sửa truy vấn')), 'Non-empty name results must suppress empty error box');

const combined = renderHome('渋谷', {
  query: '渋谷',
  attempt: 0,
  results: [{ term: { id: 't1', surface: '渋谷', sequence: 1 }, matchType: 'exact-surface' }],
  names: [sato, shibuya],
});
assert.equal(combined.find((n) => n.props.role === 'status').props.children.join(''), 'Hiển thị 1 mục từ · 2 tên riêng');
assert.equal(combined.filter((n) => n.type === 'TermCard').length, 1);
assert.equal(combined.filter((n) => n.type === 'AudioButton').length, 2);
assert(textOf(combined).includes('Nhà ga'));

const termsOnly = renderHome('猫', {
  query: '猫',
  attempt: 0,
  results: [{ term: { id: 't2', surface: '猫', sequence: 2 }, matchType: 'exact-surface' }],
  names: [],
});
assert.equal(termsOnly.find((n) => n.props.role === 'status').props.children.join(''), 'Hiển thị 1 mục từ');
assert(!termsOnly.some((n) => n.type === 'h3' && n.props.children?.includes('Tên riêng')), 'Empty name results must not render Tên riêng heading');

// ── 2. SearchInput merged suggestion group & keyboard/click navigation ───────

function renderSearchInput({ query, settledSuggestions, activeIndex = -1 }) {
  const searched = [];
  const pushed = [];
  let currentActive = activeIndex;
  let idCounter = 0;
  // useState order in SearchInput:
  // 0: handwritingOpen, 1: query, 2: isFocused, 3: isComposing, 4: activeIndex, 5: settledSuggestions, 6: checkingExact
  let stateCall = 0;
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useId: () => `id-${idCounter++}`,
    useMemo: (fn) => fn(),
    useEffect() {},
    useRef: (value) => ({ current: value }),
    useState: (initial) => {
      const idx = stateCall++;
      if (idx === 1) return [query, () => {}];
      if (idx === 2) return [true, () => {}];
      if (idx === 4) return [currentActive, (next) => {
        currentActive = typeof next === 'function' ? next(currentActive) : next;
      }];
      if (idx === 5) return [settledSuggestions, () => {}];
      return [initial, () => {}];
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(transpile('src/components/SearchInput.tsx'), {
    exports: mod.exports,
    React: react,
    require: (name) => {
      if (name === 'react') return react;
      if (name === 'next/navigation') return { useRouter: () => ({ push: (href) => pushed.push(href) }), usePathname: () => '/' };
      if (name === '@/lib/dictionaryService') return { lookupWordRoute: async () => ({ term: null }), searchNameDictionary: async () => [] };
      if (name === '@/lib/mockDictionary') return { searchDictionary: async () => [], searchKanjiDictionary: async () => [], useDictionary: () => ({ progress: { source: 'api' } }) };
      if (name === '@/lib/navigation') return { searchHref: (q) => `/?q=${encodeURIComponent(q.trim())}` };
      if (name === '@/lib/wordRoutes') return { exactWordHref: () => undefined, wordHref: (t) => `/word/${t.surface}`, wordSlug: (t) => t.surface };
      if (name === '@/lib/recentSearches') return { recordRecentSearch() {} };
      if (name === '@/lib/dictionary/searchReturn') return { searchResultId: (h) => h, withSearchOrigin: (h) => h };
      if (name === '@/lib/dictionary/formatters') return { formatKanjiMatchType: (m) => m, formatMatchType: (m) => m };
      return new Proxy({}, { get: (_, key) => String(key) });
    },
  });

  const tree = mod.exports.SearchInput({
    initialValue: query,
    onSearch: (q) => searched.push(q),
  });
  return {
    tree,
    nodes: flatten(tree),
    searched,
    pushed,
    getActiveIndex: () => currentActive,
  };
}

// Expand functional SuggestionSection/NameSuggestion/SuggestionPreview components
const si = renderSearchInput({
  query: 'さとう',
  settledSuggestions: {
    query: 'さとう',
    results: [[], [], [sato]],
  },
});
const expandedNodes = expandTree(si.tree);
const groups = expandedNodes.filter((n) => n.type === 'section' && n.props.role === 'group');
assert.equal(groups.length, 2, 'SearchInput must keep exactly 2 sections (Từ vựng + Hán tự), no 3rd section');

const options = expandedNodes.filter((n) => n.type === 'button' && n.props.role === 'option');
assert.equal(options.length, 2, 'Options must include search-all + merged name result');
assert(textOf(options[1]).includes('Tên riêng') && textOf(options[1]).includes('Họ'), 'Name option must carry Tên riêng badge and category');
assert(!expandedNodes.some((n) => n.props?.href && String(n.props.href).startsWith('/word/')), 'No /word href for name suggestion');

options[1].props.onClick();
assert.deepEqual(si.searched, ['佐藤'], 'Clicking name suggestion must search surface via onSearch (/?q=surface)');
assert.deepEqual(si.pushed, [], 'Clicking name suggestion must not push /word detail route');

const siKey = renderSearchInput({
  query: 'さとう',
  activeIndex: 1,
  settledSuggestions: {
    query: 'さとう',
    results: [[], [], [sato]],
  },
});
const inputNode = expandTree(siKey.tree).find((n) => n.type === 'input');
assert.equal(inputNode.props['aria-activedescendant'], 'id-0-name-0');
inputNode.props.onKeyDown({
  key: 'Enter',
  nativeEvent: { isComposing: false },
  preventDefault() {},
});
assert.deepEqual(siKey.searched, ['佐藤'], 'Enter on active name suggestion must search surface via onSearch');
assert.deepEqual(siKey.pushed, [], 'Enter on active name suggestion must not push /word detail route');

console.log('PASS integrated name UI (HomePage inline NameResults + SearchInput merged suggestions & keyboard/click nav)');
