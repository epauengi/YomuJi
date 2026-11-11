// Run: node scripts/check-flashcards.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mockData = require('../src/data/mockData.ts');

const source = fs.readFileSync('src/lib/flashcards.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flashcards = {};
new Function('require', 'exports', output)((specifier) => {
  assert.equal(specifier, '../data/mockData');
  return mockData;
}, flashcards);

async function main() {
  let raw = null;
  let writes = 0;
  let failRead = false;
  let failWrite = false;
  let lockQueue = Promise.resolve();
  const locks = {
    request(key, callback) {
      assert.equal(key, flashcards.STORAGE_KEY);
      const result = lockQueue.then(callback);
      lockQueue = result.catch(() => {});
      return result;
    },
  };
  const localStorage = {
  getItem(key) {
    assert.equal(key, flashcards.STORAGE_KEY);
    if (failRead) throw new Error('denied');
    return raw;
  },
  setItem(key, value) {
    assert.equal(key, flashcards.STORAGE_KEY);
    if (failWrite) throw new Error('quota');
    raw = value;
    writes += 1;
  },
  };
  global.window = { localStorage };
  Object.defineProperty(global, 'navigator', { configurable: true, value: { locks } });

  const firstLoad = flashcards.loadFlashcards();
assert.equal(firstLoad.raw, null);
assert.deepEqual(firstLoad.data.decks.map((deck) => deck.id), ['n3-july', 'jlpt-n5', 'business-jp', 'travel-jp']);
assert(firstLoad.data.decks.every((deck) => deck.sample));
assert.equal(firstLoad.data.decks.reduce((count, deck) => count + deck.cards.length, 0), mockData.demoWords.length);
assert(firstLoad.data.decks.flatMap((deck) => deck.cards).every((card) => card.dueAt === 0 && card.reviewedAt === null && card.known === null));
assert.equal(writes, 0, 'loading sample must not write');

  const valid = firstLoad.data;
const encoded = JSON.stringify(valid);
assert.deepEqual(flashcards.parseFlashcards(encoded), valid);
const limits = structuredClone(valid);
limits.decks[0].name = 'n'.repeat(80);
limits.decks[0].description = 'd'.repeat(300);
limits.decks[0].cards[0] = {
  ...limits.decks[0].cards[0], word: 'w'.repeat(100), reading: '', meaning: 'm'.repeat(1000),
  dueAt: 0, reviewedAt: 0,
};
assert.deepEqual(flashcards.parseFlashcards(JSON.stringify(limits)), limits);
limits.decks[0].cards[0].reading = 'r'.repeat(200);
assert.deepEqual(flashcards.parseFlashcards(JSON.stringify(limits)), limits);
for (const invalid of [
  '{',
  JSON.stringify({ version: 2, decks: [] }),
  JSON.stringify({ ...valid, extra: true }),
  JSON.stringify({ ...valid, decks: [{ ...valid.decks[0], cards: [{ ...valid.decks[0].cards[0], dueAt: null }] }] }),
  JSON.stringify({ ...valid, decks: [{ ...valid.decks[0], name: 'x'.repeat(81) }] }),
  JSON.stringify({ ...valid, decks: [{ ...valid.decks[0], cards: [{ ...valid.decks[0].cards[0], dueAt: -1 }] }] }),
  JSON.stringify({ ...valid, decks: [{ ...valid.decks[0], cards: [{ ...valid.decks[0].cards[0], dueAt: 8640000000000001 }] }] }),
  JSON.stringify({ ...valid, decks: [{ ...valid.decks[0], cards: [...valid.decks[0].cards, valid.decks[0].cards[0]] }] }),
  JSON.stringify({ ...valid, decks: [{ ...valid.decks[0], id: valid.decks[0].cards[0].id }] }),
]) assert.throws(() => flashcards.parseFlashcards(invalid), /Dữ liệu|Phiên bản|Mã|Thời gian/u);

const card = valid.decks[0].cards[0];
assert.deepEqual(flashcards.gradeCard(card, true, 0), {
  ...card, reviewedAt: 0, known: true, dueAt: 24 * 60 * 60 * 1000,
});
assert.deepEqual(flashcards.gradeCard(card, false, 100), {
  ...card, reviewedAt: 100, known: false, dueAt: 100 + 10 * 60 * 1000,
});
assert.throws(() => flashcards.gradeCard(card, true, Infinity), /Thời gian/u);
assert.throws(() => flashcards.gradeCard(card, false, 8640000000000000), /Thời gian/u);

const savedRaw = await flashcards.saveFlashcards(valid, null);
assert.equal(raw, savedRaw);
assert.equal(writes, 1);
const loaded = flashcards.loadFlashcards();
assert.deepEqual(loaded.data, valid);
assert.equal(loaded.raw, savedRaw);

const originalRaw = raw;
failWrite = true;
await assert.rejects(flashcards.saveFlashcards(valid, raw), /Không thể lưu/u);
assert.equal(raw, originalRaw, 'quota failure must preserve stored data');
failWrite = false;

const previousRaw = raw;
raw = JSON.stringify({ version: 1, decks: [] });
const writesBeforeConflict = writes;
await assert.rejects(flashcards.saveFlashcards(valid, previousRaw), /thay đổi ở thẻ khác/u);
assert.equal(writes, writesBeforeConflict, 'conflicting save must not write');

failRead = true;
assert.throws(() => flashcards.loadFlashcards(), /Không thể đọc/u);
await assert.rejects(flashcards.saveFlashcards(valid, raw), /Không thể đọc/u);
assert.equal(writes, writesBeforeConflict);
failRead = false;

global.window = { get localStorage() { throw new Error('denied'); } };
assert.throws(() => flashcards.loadFlashcards(), /Không thể truy cập/u);
await assert.rejects(flashcards.saveFlashcards(valid, raw), /Không thể truy cập/u);

  global.window = { localStorage };
  const raceBase = JSON.stringify(valid);
  raw = raceBase;
  const firstEdit = structuredClone(valid);
  firstEdit.decks[0].name = 'First tab';
  const secondEdit = structuredClone(valid);
  secondEdit.decks[0].name = 'Second tab';
  const beforeRaceWrites = writes;
  const race = await Promise.allSettled([
    flashcards.saveFlashcards(firstEdit, raceBase),
    flashcards.saveFlashcards(secondEdit, raceBase),
  ]);
  assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(race.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(writes, beforeRaceWrites + 1, 'serialized compare-and-set permits only one competing write');
  const winner = race.find((result) => result.status === 'fulfilled');
  assert.equal(raw, winner.value);
  assert(['First tab', 'Second tab'].includes(flashcards.parseFlashcards(raw).decks[0].name));

  Object.defineProperty(global, 'navigator', { configurable: true, value: {} });
  await assert.rejects(flashcards.saveFlashcards(valid, raw), /không hỗ trợ khóa/u);
  assert.equal(writes, beforeRaceWrites + 1, 'missing Web Locks must not write');

  console.log('PASS schema, bounds, sample load, storage failures, locked conflict detection, grading schedule');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
