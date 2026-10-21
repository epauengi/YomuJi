// Run: node scripts/check-review.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync('src/lib/reviewSession.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
new Function('exports', output)(moduleExports);
const { reviewWords, reviewReducer: reduce } = moduleExports;
const word = {
  id: 'term:1', kind: 'term', surface: ' 食べる ', reading: ' たべる ',
  meanings: ['<b>ăn</b>', '[i]dùng bữa[/i]', '  '], href: '/word/taberu',
};
const invalid = [
  { ...word, kind: 'kanji' }, { ...word, kind: 'legacy' },
  { ...word, surface: ' ' }, { ...word, reading: '' },
  { ...word, meanings: ['<b></b>', '[i][/i]'] },
];
const eligible = reviewWords([...invalid, word]);
assert.equal(eligible.length, 1);
assert.equal(eligible[0].surface, '食べる');
assert.equal(eligible[0].reading, 'たべる');
assert.deepEqual(eligible[0].meanings, ['ăn', 'dùng bữa']);
assert.equal(word.meanings[0], '<b>ăn</b>');
const entries = Array.from({ length: 12 }, (_, i) => ({ ...word, id: `term:${i}`, meanings: [`nghĩa ${i}`] }));
let state = reduce(null, { type: 'start', entries });
assert.equal(state.words.length, 10);
assert.deepEqual(state.words.map((item) => item.id), entries.slice(0, 10).map((item) => item.id));
entries[0].meanings[0] = 'changed in another tab';
entries.splice(1, 1);
assert.equal(state.words[0].meanings[0], 'nghĩa 0');
assert.equal(state.words[1].id, 'term:1');
assert.equal(reduce(state, { type: 'answer', remembered: false }), state, 'must reveal first');
assert.equal(reduce(state, { type: 'retry' }), state, 'cannot retry before completion');
for (let i = 0; i < 10; i++) {
  state = reduce(state, { type: 'reveal' });
  state = reduce(state, { type: 'answer', remembered: i !== 0 && i !== 9 });
  assert.equal(state.index, i + 1);
  assert.equal(state.revealed, false);
}
assert.equal(state.words[state.index], undefined);
assert.deepEqual(state.missed.map((item) => item.id), ['term:0', 'term:9']);
assert.equal(reduce(state, { type: 'reveal' }), state);
assert.equal(reduce(state, { type: 'answer', remembered: true }), state);
state = reduce(state, { type: 'retry' });
assert.equal(state.words.length, 2);
assert.equal(state.index, 0);
assert.equal(state.missed.length, 0);
for (let i = 0; i < 2; i++) {
  state = reduce(state, { type: 'reveal' });
  state = reduce(state, { type: 'answer', remembered: true });
}
assert.equal(reduce(state, { type: 'retry' }), state, 'nothing to retry');
assert.equal(reduce(state, { type: 'exit' }), null);
assert.equal(reduce(null, { type: 'start', entries: invalid }), null);
assert.equal(reduce(null, { type: 'reveal' }), null);
console.log('PASS review eligibility, plain text, snapshots, cap, reveal guard, completion, retry, exit');
