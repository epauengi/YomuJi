// Run: node scripts/check-new-features.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadTs(filePath, mocks = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', output)((specifier) => mocks[specifier] ?? {}, exports);
  return exports;
}

const { chunkJapanese } = loadTs('src/components/books/PasteLookup.tsx');
const { intersectComponents } = loadTs('src/components/dictionary/KanjiComponentSearch.tsx');

// P1 paste chunking keeps inflected verbs together while separating particles.
const chunks = chunkJapanese('昨日は忙しくて、ご飯を食べられなかった。').filter((c) => c.word).map((c) => c.text);
assert.deepEqual(chunks, ['昨日', 'は', '忙しくて', 'ご飯', 'を', '食べられなかった']);
assert.deepEqual(
  chunkJapanese('学校へ行きませんでした').filter((c) => c.word).map((c) => c.text),
  ['学校', 'へ', '行きませんでした'],
);

// P1 Kanji multi-component + stroke filter using generated KanjiVG index.
const index = JSON.parse(fs.readFileSync('public/dict/meta/kanji-components.json', 'utf8'));
assert(index.coverage.withComponents > 6000, 'KanjiVG coverage must be verified');
const sei = intersectComponents(index, ['氵', '青'], null, null);
const seiChars = sei.matched.map((id) => index.kanji[id][0]);
assert(seiChars.includes('清'), '氵 + 青 must include 清');
const sei11 = intersectComponents(index, ['氵', '青'], 11, 11).matched.map((id) => index.kanji[id][0]);
assert.deepEqual(sei11, ['清'], '氵 + 青 with 11 strokes narrows to 清');
assert.equal(intersectComponents(index, ['氵', '青'], 1, 5).matched.length, 0);

console.log('PASS paste segmentation + kanji component intersection');
