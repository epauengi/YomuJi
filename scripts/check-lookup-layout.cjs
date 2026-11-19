// Run: node scripts/check-lookup-layout.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/components/HomePage.tsx', 'utf8');
const mod = { exports: {} };
let settledSearch = null;
let stateCall = 0;
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState: (value) => [stateCall++ === 1 ? settledSearch : value, () => {}],
  useEffect() {},
  useRef: (value) => ({ current: value }),
  useCallback: (fn) => fn,
};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, {
  exports: mod.exports,
  React: react,
  require: (name) => name === 'react' ? react : name === 'next/navigation'
    ? { useRouter: () => ({ push() {} }) }
    : name === '@/lib/mockDictionary' ? { useDictionary: () => ({ progress: {} }) }
    : new Proxy({}, { get: (_, key) => key }),
});
const flatten = (node) => !node || typeof node !== 'object' ? []
  : Array.isArray(node) ? node.flatMap(flatten)
    : [node, ...flatten(node.props?.children)];
function render(query, settled = null) {
  stateCall = 0;
  settledSearch = settled;
  return flatten(mod.exports.HomePage({ initialQuery: query }));
}
for (const query of ['', '   ', '猫']) {
  const nodes = render(query);
  const active = !!query.trim();
  const hero = nodes.find((node) => node.type === 'section');
  assert(hero.props.className.includes(active ? 'py-4' : 'py-10'));
  assert.equal(hero.props.className.includes('bg-[#123b36]'), !active);
  assert.equal(nodes.find((node) => node.type === 'h1').props.className === 'sr-only', active);
  assert.equal(nodes.some((node) => node.props.children?.includes('Thử tìm:')), !active);
  const inputs = nodes.filter((node) => node.type === 'SearchInput');
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].props.placeholder, 'Tra từ hoặc Kanji');
  assert(nodes.some((node) => node.props.id === inputs[0].props.describedBy));
  assert.equal(nodes.some((node) => node.props.children?.includes('Đang tra trong từ điển…')), active);
  assert(!nodes.some((node) => node.props.children?.includes('Hiển thị 0 mục từ')));
}
function status(nodes) {
  return nodes.find((node) => node.props.role === 'status').props.children[0];
}
const failed = render('猫', { query: '猫', attempt: 0, results: null });
assert.equal(status(failed), 'Chưa thể tra cứu.');
assert(failed.some((node) => node.type === 'Button' && node.props.children.includes('Thử lại')));
const empty = render('猫', { query: '猫', attempt: 0, results: [] });
assert.equal(status(empty), 'Không tìm thấy mục từ phù hợp.');
assert(empty.some((node) => node.type === 'Button' && node.props.children.includes('Sửa truy vấn')));
const results = [{ term: { id: '1', surface: '猫', sequence: 1 } }];
assert.equal(status(render('猫', { query: '猫', attempt: 0, results })), 'Hiển thị 1 mục từ');
assert.equal(status(render('猫', { query: '日', attempt: 0, results })), 'Đang tra trong từ điển…');
assert.equal(status(render('猫', { query: '猫', attempt: -1, results })), 'Đang tra trong từ điển…');
console.log('PASS lookup layout and request-keyed loading, success, empty, and error states');
