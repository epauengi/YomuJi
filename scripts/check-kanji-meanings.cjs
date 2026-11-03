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
assert.equal(getVietnameseKanjiMeanings(['[khiêu] khinh bạc']).length, 1);
assert.deepEqual(getVietnameseKanjiMeanings(['[tam] ba, 3', '[phi] bay', '[huynh] anh trai', '[não] bộ não', '[mịch] bộ mịch']).map(({ label }) => label), ['ba, 3', 'bay', 'anh trai', 'bộ não']);
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

const crypto = require('node:crypto');
const path = require('node:path');
const reviewed = require('../data/kanji-meanings-reviewed.json');
const manifest = require('../public/dict/manifest.json');
assert.equal(manifest.kanjiRevision, crypto.createHash('sha256').update(JSON.stringify(reviewed)).digest('hex'));
const unseen = new Set(Object.keys(reviewed));
const missing = [];
for (const shard of manifest.shards.filter((item) => item.type === 'kanji')) {
  const bytes = fs.readFileSync(path.join('public/dict/kanji', path.basename(shard.url)));
  assert.equal(bytes.length, shard.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), shard.sha256);
  const records = JSON.parse(bytes).records;
  assert.equal(records.length, shard.recordCount);
  for (const record of records) {
    if (getVietnameseKanjiMeanings(record.meanings).length === 0) {
      missing.push({ literal: record.literal, meanings: record.meanings, raw: record.meaningsRaw, hanViet: record.hanViet, jlpt: record.jlpt, grade: record.grade });
    }
    if (!Object.hasOwn(reviewed, record.literal)) continue;
    assert(unseen.delete(record.literal), `Duplicate Kanji: ${record.literal}`);
    assert.deepEqual(record.meanings, reviewed[record.literal]);
    assert.equal(getVietnameseKanjiMeanings(record.meanings).length, record.meanings.length, record.literal);
  }
}
assert.equal(unseen.size, 0, `Missing Kanji: ${[...unseen].join(', ')}`);
if (process.argv[2] === '--missing-json') console.log(JSON.stringify(missing));
else console.log(`PASS: ${Object.keys(reviewed).length} reviewed Kanji, shard integrity. Missing visible meanings: ${missing.length}.`);
