// Run: node scripts/check-search-return.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const source = readFileSync(resolve(__dirname, '../src/lib', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  new Function('require', 'exports', outputText)((key) => imports[key], exports);
  return exports;
}

const { readSearchOrigin, withSearchOrigin, searchReturnHref, searchResultId } = load('dictionary/searchReturn.ts', {
  '@/lib/navigation': load('navigation.ts'),
});
const base = 'https://example.test';
const canonical = `/word/${encodeURIComponent('私')}?id=123`;
const query = '私 & tiếng Việt + #';
const result = searchResultId(canonical, 'base');
const detail = new URL(withSearchOrigin(canonical, { query, result }), base);
assert.equal(detail.searchParams.get('id'), '123');
assert.equal(detail.hash, '');
const origin = readSearchOrigin(detail.searchParams.get('from'), detail.searchParams.get('result'));
assert.deepEqual(origin, { query, result });
const back = new URL(searchReturnHref(origin), base);
assert.equal(back.pathname, '/');
assert.equal(back.searchParams.get('q'), query);
assert.equal(back.searchParams.get('focus'), result);
assert.notEqual(searchResultId(canonical), result);
assert.notEqual(searchResultId(canonical), searchResultId(canonical.replace('123', '456')));
assert.equal(withSearchOrigin(canonical), canonical);
assert.equal(readSearchOrigin(['私', '食'], result), undefined);
assert.equal(readSearchOrigin('   ', result), undefined);
assert.equal(searchReturnHref({ query: '   ' }), '/');
assert.equal(searchReturnHref(readSearchOrigin(' 食 ', ['unexpected'])), '/?q=%E9%A3%9F&focus=results');
console.log('PASS search return context, collision IDs, escaping, direct visits and heading fallback');
