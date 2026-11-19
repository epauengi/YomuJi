const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const { outputText } = ts.transpileModule(fs.readFileSync('src/lib/readerLookup.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const food = { id: '1', surface: '食べる', reading: 'たべる', meaningsVi: ['ăn'], partOfSpeech: ['v1'], sequence: 1 };
const canEat = { id: '2', surface: '食べられる', reading: 'たべられる', meaningsVi: ['có thể ăn được'], partOfSpeech: ['v1'], sequence: 2 };
const search = new Map([
  ['食べる', [food, { ...food, id: 'phrase', surface: '一口食べる', reading: 'ひとくちたべる' }]],
  ['食べられる', [canEat]],
]);
let conjugation = async () => ({ baseForm: '食べられる', entries: [{ sequence: 2 }] });
const mod = { exports: {} };
new Function('require', 'exports', outputText)((name) => {
  if (name === './conjugationClient') return { getConjugation: (...args) => conjugation(...args) };
  if (name === './dictionaryService') return { searchDictionary: async (q, _, signal) => {
    signal.throwIfAborted();
    return (search.get(q) || []).map((term) => ({ term }));
  } };
  if (name === '../types/kotoba') return { isConjugationQuery: (q) => /\p{sc=Hiragana}/u.test(q) };
  throw new Error(`Unexpected import: ${name}`);
}, mod.exports);

(async () => {
  const controller = new AbortController();
  const lookup = (q) => mod.exports.lookupReaderWord(q, controller.signal);
  assert.deepEqual(await lookup('食べられなかった'), [food, canEat]);
  assert.deepEqual(await lookup('食べる'), [food]);
  assert.deepEqual(await lookup('烏'), []);
  conjugation = async () => { throw new Error('service unavailable'); };
  assert.deepEqual(await lookup('食べられなかった'), [food]);
  await assert.rejects(lookup('消えた'), /service unavailable/);
  controller.abort();
  await assert.rejects(lookup('食べられなかった'), { name: 'AbortError' });
  console.log('PASS: exact matches, base form, alternatives, empty, network failure, abort.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
