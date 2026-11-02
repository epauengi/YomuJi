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
const { attachKanjiMeaningExamples, formatKanjiHanViet, getVietnameseKanjiMeanings } = sandbox.exports;

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
const clean = getVietnameseKanjiMeanings(meanings);
assert.deepEqual(clean.map(({ label }) => label), ['chọn lựa, kén chọn', 'gánh, gồng']);
assert.deepEqual(getVietnameseKanjiMeanings(['challenge', 'make love to']), []);
assert.deepEqual(formatKanjiHanViet(['THỰC TỰ', 'Thực', 'Tự']), ['THỰC', 'TỰ']);
const foodMeanings = attachKanjiMeaningExamples(
  getVietnameseKanjiMeanings(['[thực] ăn', '[thực] đồ ăn', '[thực] lộc']),
  [
    { surface: '食事', reading: 'しょくじ', meaningsVi: ['bữa ăn', 'bữa tối'] },
    { surface: '食品', reading: 'しょくひん', meaningsVi: ['món ăn', 'sản phẩm thực phẩm'] },
    { surface: '食', reading: 'しょく', meaningsVi: ['ăn'] },
  ],
  '食',
).map(({ label, examples }) => ({ label, examples }));
assert.equal(foodMeanings[0].examples.length, 2);
assert.equal(foodMeanings[0].examples[0].surface, '食事');
assert.equal(foodMeanings[0].examples[1].surface, '食品');
assert.equal(foodMeanings[1].examples.length, 1);
assert.equal(foodMeanings[1].examples[0].meaning, 'món ăn');
assert.equal(foodMeanings[2].examples.length, 0);

console.log('PASS: compact unique meanings, unique Hán Việt and verified compound examples.');
