// Run: node scripts/check-word-detail.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const jsx = (type, props) => typeof type === 'function' ? type(props || {}) : ({ type, props: props || {} });
const runtime = { jsx, jsxs: jsx, Fragment: 'fragment' };
const icon = () => null;
const audio = (props) => jsx('button', { 'aria-label': props.label || 'Nghe phát âm' });
const bookmark = () => jsx('button', { 'aria-label': 'Lưu từ vựng' });
const furigana = ({ kanji, reading }) => jsx('ruby', {
  children: [jsx('span', { children: kanji }), reading && jsx('rt', { children: reading })],
});

function load(file, imports) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.equal(diagnostics.length, 0, `${file} transpiles without diagnostics`);
  const mod = { exports: {} };
  const requireMock = (id) => {
    if (id === 'react/jsx-runtime') return runtime;
    if (id === 'next/navigation') return { useRouter: () => ({ replace() {} }) };
    if (id === 'next/link') return { __esModule: true, default: 'a' };
    if (id === 'motion/react') return { motion: { h1: 'h1' } };
    if (id === '@phosphor-icons/react') return { ArrowLeft: icon, BookOpenText: icon, LinkSimple: icon, Repeat: icon };
    if (id === '@/lib/wordRoutes') return { wordHref: () => '/word/test' };
    if (id === '@/lib/browserState') return { termBookmark: (term) => term };
    if (id === '@/components/AudioButton') return { AudioButton: audio };
    if (id === '@/components/ui/BookmarkButton') return { BookmarkButton: bookmark };
    if (id === '@/components/ui/Badge') return { Badge: 'span' };
    if (id === '@/components/ui/Card') return { Card: 'div' };
    if (id === '@/components/ui/Furigana') return { Furigana: furigana };
    if (id === '@/hooks/useDictionary') return { useWordDetail: () => ({ term, status: 'ready' }) };
    if (id === './TatoebaExamples') return { TatoebaExamples: () => null };
    if (id === '@/components/dictionary/ConjugationTable') return { ConjugationTable: () => null };
    if (id === '@/lib/dictionary/sensePresenter') return {
      getCleanSenseLabels: () => [],
      formatSenseRestrictions: () => [],
    };
    if (id === 'react') return { useEffect() {} };
    throw new Error(`Unexpected import ${id}`);
  };
  vm.runInNewContext(outputText, {
    exports: mod.exports,
    require: requireMock,
    module: mod,
  }, { filename: file });
  return mod.exports;
}

const example = (textJa) => ({ id: textJa, textJa, textVi: `dịch ${textJa}`, termSequence: 1 });
const term = {
  id: 'test', surface: '読む', reading: 'よむ', romaji: 'yomu', hanVietStr: 'ĐỘC',
  isCommon: false, related: [], senses: [
    { meaningsVi: ['meaning alpha', 'meaning beta'], partOfSpeech: [], misc: [], appliesToKanji: [], appliesToReadings: [], examples: [example('読む例一'), example('読む例二')] },
    { meaningsVi: ['meaning gamma'], partOfSpeech: [], misc: [], appliesToKanji: [], appliesToReadings: [], examples: [] },
  ],
  examples: [], writtenForms: [], kanjiReadings: [],
};
const WordDetailPage = load('src/app/word/[slug]/WordDetailPage.tsx').default;
const tree = WordDetailPage({ slug: '読む' });

function walk(node, visit, detailsDepth = 0) {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit, detailsDepth));
  if (!node || typeof node !== 'object') return;
  const depth = detailsDepth + (node.type === 'details' ? 1 : 0);
  visit(node, depth);
  walk(node.props?.children, visit, depth);
}

const visibleMeanings = new Set();
let firstExampleDepth;
let extraExampleDepth;
let readingCount = 0;
let actionGroup;
walk(tree, (node, depth) => {
  const text = node.props?.children;
  if (typeof text === 'string') {
    if (text.startsWith('meaning ')) {
      assert.equal(depth, 0, `${text} stays visible outside disclosures`);
      visibleMeanings.add(text);
    }
    if (text === '読む例一') firstExampleDepth = depth;
    if (text === '読む例二') extraExampleDepth = depth;
    if (text === 'よむ') readingCount++;
  }
  if (node.type === 'div' && node.props?.role === 'group' && node.props?.['aria-label'] === 'Thao tác mục từ') actionGroup = node;
});
assert.deepEqual([...visibleMeanings].sort(), ['meaning alpha', 'meaning beta', 'meaning gamma']);
assert.equal(firstExampleDepth, 0, 'first example per sense stays visible');
assert.equal(extraExampleDepth, 1, 'additional sense examples use native disclosure');
assert.equal(readingCount, 1, 'furigana reading is not repeated in the title metadata');
assert.ok(actionGroup, 'title actions are grouped together');
const actions = actionGroup.props.children;
assert.equal(actions.length, 2, 'audio and bookmark actions stay together');
assert.equal(actions[0].type, 'button');
assert.equal(actions[1].type, 'button');
assert.equal(actions[0].props['aria-label'], 'Nghe phát âm');
assert.equal(actions[1].props['aria-label'], 'Lưu từ vựng');

console.log('Word detail hierarchy checks passed.');
