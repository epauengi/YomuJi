const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/lib/dictionary/kanjiMeanings.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(code, sandbox);
const { getVietnameseKanjiMeanings } = sandbox.exports;

const meanings = [
  'challenge',
  `<tc> # ${'nghĩa Hán Nôm dài '.repeat(20)}<tvc>`,
  'thiêu, thiểu, thao (9n) ① gánh; xem 挑 [tiǎo]',
  'x'.repeat(181),
  '<<ccr:eb831189dccd,html,1.0KB>>',
  '[khiêu] chọn lựa, kén chọn',
  '[thao] gánh, gồng',
  '[thao] gánh, gồng',
];
assert.deepEqual(Array.from(getVietnameseKanjiMeanings(meanings)), [
  '[khiêu] chọn lựa, kén chọn',
  '[thao] gánh, gồng',
]);
assert.deepEqual(Array.from(getVietnameseKanjiMeanings(['challenge', 'make love to'])), []);

console.log('PASS: Kanji meanings hide source markup, oversized glosses, non-Vietnamese glosses and duplicates.');
