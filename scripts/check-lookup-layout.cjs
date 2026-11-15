// Run: node scripts/check-lookup-layout.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/components/HomePage.tsx', 'utf8');
const mod = { exports: {} };
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState: (value) => [value, () => {}],
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
for (const query of ['', '   ', '猫']) {
  const nodes = flatten(mod.exports.HomePage({ initialQuery: query }));
  const active = !!query.trim();
  const hero = nodes.find((node) => node.type === 'section');
  assert(hero.props.className.includes(active ? 'py-4' : 'py-10'));
  assert.equal(hero.props.className.includes('bg-[#123b36]'), !active);
  assert.equal(nodes.find((node) => node.type === 'h1').props.className === 'sr-only', active);
  assert.equal(nodes.some((node) => node.props.children?.includes('Thử tìm:')), !active);
  assert.equal(nodes.filter((node) => node.type === 'SearchInput').length, 1);
}
console.log('PASS lookup layout: entry/whitespace hero preserved, active query compact, suggestions hidden, search retained');
