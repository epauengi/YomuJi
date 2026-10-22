const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('src/lib/bookCovers.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(code, {
  exports: moduleExports,
  module: { exports: moduleExports },

  require: (name) => {
    if (name === 'server-only') return {};
    if (name === '@/data/books') return {};
    throw new Error(`Unexpected import: ${name}`);
  },
}, { filename: 'src/lib/bookCovers.ts' });

const { mapOpenLibraryCovers } = moduleExports;
const books = [
  { slug: 'right-author', japaneseTitle: '注文の多い料理店', author: '宮沢賢治' },
  { slug: 'quoted-title', japaneseTitle: '『注文の多い料理店』序', author: '宮沢賢治' },
  { slug: 'wrong-author', japaneseTitle: '注文の多い料理店', author: '太宰治' },
  { slug: 'unique-title', japaneseTitle: '走れメロス', author: '太宰治' },
  { slug: 'ambiguous', japaneseTitle: '注文の多い料理店', author: '作者' },
  { slug: 'no-match', japaneseTitle: '未登録の作品', author: '作者' },
];
const docs = [
  { title: '注文の多い料理店', author_name: ['宮澤賢治'], cover_i: 123 },
  { title: '注文の多い料理店', author_name: ['別の作者'], cover_i: 456 },
  { title: '注文の多い料理店', cover_i: 457 },
  { title: '『注文の多い料理店』序', author_name: ['宮澤賢治'], cover_i: 458 },
  { title: '走れメロス', author_name: ['太宰 治'], cover_i: 789 },
  { title: '作品', author_name: ['他の作者'], cover_i: 999 },
];
const covers = mapOpenLibraryCovers(books, docs);
assert.deepEqual({ ...covers }, {
  'right-author': 'https://covers.openlibrary.org/b/id/123-M.jpg?default=false',
  'unique-title': 'https://covers.openlibrary.org/b/id/789-M.jpg?default=false',
  'quoted-title': 'https://covers.openlibrary.org/b/id/458-M.jpg?default=false',
});
console.log('PASS: exact title, author matching, and generated-cover fallback.');
