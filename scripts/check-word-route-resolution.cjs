// Run: node scripts/check-word-route-resolution.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const index = require('../src/lib/dictionary/word-route-index.json');
const manifest = require('../public/dict/manifest.json');
const terms = manifest.shards.filter((shard) => shard.type === 'terms')
  .flatMap((shard) => JSON.parse(fs.readFileSync(path.join(root, 'public', shard.url), 'utf8')).records);
const byId = new Map(terms.map((term) => [term.id, term]));
const repository = {
  async getTermByIdOrSlug(key) {
    return byId.get(key) ?? terms.find((term) => term.surface === key || term.reading === key) ?? null;
  },
};
function load(relative, dependencies) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', output)((key) => {
    assert(Object.hasOwn(dependencies, key), `Unexpected import ${key}`);
    return dependencies[key];
  }, exports);
  return exports;
}
const helpers = load('src/lib/wordRoutes.ts', {
  './word-route-collisions.json': require('../src/lib/word-route-collisions.json'),
});
const { resolveWordRoute } = load('src/lib/dictionary/resolveWordRoute.ts', {
  'server-only': {}, './word-route-index.json': index,
  '@/lib/dictionary': { getDictionaryRepository: () => repository, isDictionaryBackendConfigured: () => true },
  '@/lib/wordRoutes': helpers,
});
(async () => {
  const unique = await resolveWordRoute('食べる');
  assert.equal(unique.term.surface, '食べる');
  const choices = await resolveWordRoute('私');
  assert(choices.alternatives.length > 1);
  for (const term of choices.alternatives) {
    assert.equal((await resolveWordRoute('私', String(term.sequence))).term.id, term.id);
    assert.equal((await resolveWordRoute(term.id)).term.id, term.id);
  }
  assert.equal((await resolveWordRoute('私', '999999999')).term, null);
  assert.equal((await resolveWordRoute('食べる', '999999999')).term, null);
  assert.equal((await resolveWordRoute('てすと')).term.surface, 'テスト');
  assert.equal((await resolveWordRoute('does-not-exist')).term, null);
  assert.equal((await resolveWordRoute('__proto__')).term, null);
  const unavailable = load('src/lib/dictionary/resolveWordRoute.ts', {
    'server-only': {}, './word-route-index.json': index,
    '@/lib/dictionary': { getDictionaryRepository: () => repository, isDictionaryBackendConfigured: () => false },
    '@/lib/wordRoutes': helpers,
  });
  await assert.rejects(unavailable.resolveWordRoute('食べる'), /backend unavailable/);
  console.log('PASS canonical resolution, collisions, exact legacy identity, kana, invalid selector, unknown slug');
})().catch((error) => { console.error(error); process.exitCode = 1; });
