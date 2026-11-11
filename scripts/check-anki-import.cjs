// Run: node scripts/check-anki-import.cjs
// Plain-text DOM boundary stub only. HTML safety is checked in the real browser.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const api = {};
new Function('exports', ts.transpileModule(readFileSync('src/lib/ankiImport.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(api);
global.document = { createElement() { let text; return { set innerHTML(value) { assert(!/[<>]/.test(value), 'stub accepts plain text only'); text = value; }, content: { querySelectorAll() { return []; }, get textContent() { return text; } } }; } };
const model = { id: '1', name: 'Japanese', fields: ['Word', 'Reading', 'Meaning'], notes: [{ id: '2', fields: [' 日本 ', 'にほん', 'Nhật Bản'] }] };
const mapping = { word: 0, reading: 1, meaning: 2 };
const deck = api.buildImportedDeck(model, mapping, ' Bộ nhập ');
assert.equal(deck.name, 'Bộ nhập');
assert.equal(deck.sample, false);
assert.equal(deck.cards[0].word, '日本');
assert.equal(deck.cards[0].dueAt, 0);
assert.equal(deck.cards[0].reviewedAt, null);
assert.equal(deck.cards[0].known, null);
assert.notEqual(api.buildImportedDeck(model, mapping, 'A').id, deck.id);
assert.equal(api.buildImportedDeck(model, { ...mapping, reading: -1 }, 'A').cards[0].reading, '');
for (const bad of [{ ...mapping, word: -1 }, { ...mapping, word: 3 }, { ...mapping, meaning: 0 }, { ...mapping, reading: 0 }, { ...mapping, word: 0.5 }]) assert.throws(() => api.buildImportedDeck(model, bad, 'A'));
for (const title of ['', ' ', 'x'.repeat(81)]) assert.throws(() => api.buildImportedDeck(model, mapping, title));
for (const fields of [[' ', '', 'nghĩa'], ['語', '', ' '], ['x'.repeat(101), '', 'nghĩa'], ['語', 'x'.repeat(201), 'nghĩa'], ['語', '', 'x'.repeat(1001)]]) {
  assert.throws(() => api.buildImportedDeck({ ...model, notes: [...model.notes, { id: '3', fields }] }, mapping, 'A'), /Ghi chú 2/);
}
assert.throws(() => api.buildImportedDeck({ ...model, notes: [] }, mapping, 'A'));
assert.throws(() => api.buildImportedDeck({ ...model, notes: Array(10001).fill(model.notes[0]) }, mapping, 'A'));
assert.equal(model.notes[0].fields[0], ' 日本 ', 'source must not mutate');
console.log('PASS mapping, required fields, limits, all-or-nothing conversion, fresh IDs, reset scheduling; HTML checks require browser');
