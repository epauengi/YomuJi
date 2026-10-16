// Run: node scripts/check-bookmarks.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', output)((key) => {
    assert(Object.hasOwn(dependencies, key), `Unexpected import ${key}`);
    return dependencies[key];
  }, exports);
  return exports;
}
const routes = load('src/lib/wordRoutes.ts', {
  './word-route-collisions.json': require('../src/lib/word-route-collisions.json'),
});
let raw = JSON.stringify(['食', '食べる', '食']);
let blocked = false;
global.window = new EventTarget();
window.localStorage = {
  getItem() { if (blocked) throw new Error('blocked'); return raw; },
  setItem(key, value) { if (blocked) throw new Error('quota'); raw = value; },
};
const fresh = () => load('src/lib/browserState.ts', { './wordRoutes': routes });
const store = fresh();
let events = 0;
const unsubscribe = store.subscribeToBookmarks(() => events++);
assert.equal(store.readBookmarks().length, 2);
assert.equal(store.readBookmarks()[0].kind, 'legacy');
const term = store.termBookmark({ id: 'jmdict-100', surface: '食', reading: 'しょく', meaningsVi: ['ăn'] });
const kanji = store.kanjiBookmark({ literal: '食', hanViet: ['Thực'], meanings: ['ăn'] });
store.setBookmark(term, true);
store.setBookmark(kanji, true);
assert.equal(JSON.parse(raw).version, 2);
assert.equal(store.readBookmarks().length, 3);
assert.equal(store.readBookmarks().filter((item) => item.surface === '食').length, 2);
store.setBookmark(term, true);
assert.equal(store.readBookmarks().length, 3);
assert(fresh().readBookmarks().some((item) => item.id === term.id));
store.setBookmark(term, false);
assert(!store.readBookmarks().some((item) => item.id === term.id));
assert(store.readBookmarks().some((item) => item.id === kanji.id));
assert.equal(events, 4);
unsubscribe();
store.setBookmark(term, true);
assert.equal(events, 4);
const homograph = { ...term, id: 'term:other', reading: 'じき' };
store.setBookmark(homograph, true);
assert(store.readBookmarks().some((item) => item.id === term.id));
assert(store.readBookmarks().some((item) => item.id === homograph.id));
store.setBookmark(homograph, false);
assert(store.readBookmarks().some((item) => item.id === term.id));
assert.throws(() => store.setBookmark({ ...term, href: 'javascript:alert(1)' }, true));
assert.throws(() => store.setBookmark({ ...term, href: '//evil.test' }, true));
raw = '{broken';
assert.throws(() => store.setBookmark(term, false), /Dữ liệu gốc/);
assert.equal(raw, '{broken');
assert.equal(store.readBookmarkStorageAvailable(), false);
raw = JSON.stringify({ version: 2, items: [{ ...term, href: '/word/x', meanings: [42] }] });
assert.throws(() => fresh().setBookmark(term, true));
assert.equal(JSON.parse(raw).items[0].meanings[0], 42);
raw = JSON.stringify(['古い']);
const fallback = fresh();
fallback.readBookmarks();
blocked = true;
fallback.setBookmark(term, true);
assert.equal(fallback.readBookmarkStorageAvailable(), false);
assert(fallback.readBookmarks().some((item) => item.id === term.id));
assert.equal(raw, JSON.stringify(['古い']));
console.log('PASS legacy migration, identity, persistence, events, removal, unsafe input, corrupt data, storage fallback');
