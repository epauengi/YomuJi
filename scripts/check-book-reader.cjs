const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/lib/bookReaderStorage.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(code, { exports: mod.exports, module: mod, Storage: Object }, { filename: 'bookReaderStorage.ts' });
const storage = mod.exports;
const key = 'yomuji_book_reader_v1:aozora';
const original = '{broken';
const data = new Map([[key, original]]);
const fakeStorage = {
  get length() { return data.size; },
  key(index) { return [...data.keys()][index] ?? null; },
  getItem(name) { return data.get(name) ?? null; },
  setItem(name, value) { data.set(name, value); },
};

assert.equal(storage.parseBookReaderPrefs(null).status, 'empty');
assert.equal(storage.parseBookReaderPrefs(original).status, 'corrupt');
assert.equal(storage.readBookReaderPrefs(fakeStorage, key, 'aozora').status, 'corrupt');
assert.equal(storage.writeBookReaderPrefs(fakeStorage, key, 'aozora', { saved: true }), 'corrupt');
assert.equal(data.get(key), original, 'corrupt record must remain untouched');
assert.equal(storage.scanSavedBookRecords(fakeStorage, 'yomuji_book_reader_v1:').status, 'corrupt');

data.set(key, JSON.stringify({ size: 23, saved: false }));
assert.equal(storage.writeBookReaderPrefs(fakeStorage, key, 'aozora', { size: 23, saved: true }), 'ok');
assert.equal(storage.scanSavedBookRecords(fakeStorage, 'yomuji_book_reader_v1:').status, 'ok');

const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, get length() { throw new Error('denied'); } };
assert.equal(storage.readBookReaderPrefs(denied, key, 'aozora').status, 'unavailable');
assert.equal(storage.writeBookReaderPrefs(denied, key, 'aozora', { saved: true }), 'unavailable');
assert.equal(storage.scanSavedBookRecords(denied, 'yomuji_book_reader_v1:').status, 'unavailable');

const metadataKey = 'yomuji_book_metadata_v1:aozora';
data.set(key, JSON.stringify({ size: 23, saved: false }));
const cachedBook = { slug: 'aozora', title: 'Aozora', japaneseTitle: '青空', author: 'Author', romanizedAuthor: 'Author' };
assert.equal(storage.writeBookMetadataCache(fakeStorage, 'yomuji_book_metadata_v1:', 'aozora', cachedBook), true);
assert.equal(JSON.parse(data.get(key)).saved, false, 'metadata cache must not mutate saved-book record');
assert.equal(JSON.parse(data.get(metadataKey)).saved, undefined, 'metadata-only key must not contain saved state');
assert.equal(storage.readBookMetadataCache(fakeStorage, 'yomuji_book_metadata_v1:', 'aozora').value.book.title, 'Aozora', 'legacy saved record can resolve from cached metadata');

const reader = fs.readFileSync('src/components/books/BookReader.tsx', 'utf8');
const headerStart = reader.indexOf('<header className="sticky top-16');
const headerEnd = reader.indexOf('</header>', headerStart);
assert.ok(headerStart >= 0 && headerEnd > headerStart, 'reader toolbar header must exist');
assert.match(reader.slice(headerStart, headerEnd), /role="alert"[\s\S]*Thử đọc lại/, 'storage recovery alert must be adjacent to reader controls');
const savedPage = fs.readFileSync('src/app/books/saved/page.tsx', 'utf8');
assert.match(savedPage, /readBookMetadataCache\(window\.localStorage, METADATA_PREFIX, slug\)/, 'saved list must use separate metadata cache for offline legacy books');
console.log('PASS: empty/corrupt/denied storage, preservation, saved scan, confirmed writes, isolated metadata cache.');
