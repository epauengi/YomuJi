// Run: node scripts/test-navigation.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(name, imports = require) {
  const filename = path.join(__dirname, '../src/lib', name);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`, { filename })(imports, mod, mod.exports);
  return mod.exports;
}

const navigation = load('navigation.ts');
load('navigation.test.ts', (id) => id === './navigation' ? navigation : require(id));
