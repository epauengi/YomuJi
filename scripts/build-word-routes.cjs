// Run: node scripts/build-word-routes.cjs [--check]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'dict/manifest.json'), 'utf8'));
const check = process.argv.includes('--check');
assert(process.argv.slice(2).every((arg) => arg === '--check'), 'Usage: node scripts/build-word-routes.cjs [--check]');

// Use the shared implementation, not a second copy of the slug policy.
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/wordRoutes.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function loadHelpers(collisions) {
  const exports = {};
  new Function('require', 'exports', compiled)((name) => {
    assert.equal(name, './word-route-collisions.json');
    return collisions;
  }, exports);
  return exports;
}
const { wordSlug, wordSequence } = loadHelpers([]);
const groups = new Map();
const ids = new Set();
const sequences = new Set();
let total = 0;
const shards = manifest.shards.filter((shard) => shard.type === 'terms');
assert.equal(shards.length, manifest.totals.termShards, 'Manifest term shard count');
for (const shard of shards) {
  const filename = path.resolve(publicDir, '.' + shard.url);
  assert(filename.startsWith(publicDir + path.sep), `Invalid shard path: ${shard.url}`);
  const payload = JSON.parse(fs.readFileSync(filename, 'utf8'));
  assert.equal(payload.type, 'terms');
  assert.equal(payload.records.length, shard.recordCount, `Shard count: ${shard.url}`);
  for (const { id, sequence, surface, reading } of payload.records) {
    assert.equal(typeof id, 'string');
    assert.equal(typeof surface, 'string');
    assert.equal(typeof reading, 'string');
    assert.equal(wordSequence(id), sequence, `Sequence suffix: ${id}`);
    assert(!ids.has(id), `Duplicate ID: ${id}`);
    assert(!sequences.has(sequence), `Duplicate sequence: ${sequence}`);
    ids.add(id);
    sequences.add(sequence);
    const slug = wordSlug({ surface, reading });
    assert(slug, `Empty slug: ${id}`);
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push({ id, sequence, surface, reading });
    total++;
  }
}
assert.equal(total, manifest.totals.terms, 'Manifest term total');

const slugs = [...groups.keys()].sort();
const collisions = slugs.filter((slug) => groups.get(slug).length > 1);
const index = Object.create(null);
for (const slug of slugs) {
  const terms = groups.get(slug);
  if (terms.length > 1 || terms[0].surface !== slug) {
    index[slug] = terms.sort((a, b) => a.sequence - b.sequence).map((term) => term.id);
  }
}

// Every term has a unique canonical URL and resolves to its unchanged ID.
const { wordHref } = loadHelpers(collisions);
const hrefs = new Set();
for (const [slug, terms] of groups) {
  for (const term of terms) {
    const href = wordHref(term);
    assert(!hrefs.has(href), `Duplicate canonical URL: ${href}`);
    hrefs.add(href);
    assert.equal(href, `/word/${encodeURIComponent(slug)}${terms.length > 1 ? `?id=${term.sequence}` : ''}`);
    if (index[slug]) {
      const matches = index[slug].filter((id) => terms.length === 1 || wordSequence(id) === term.sequence);
      assert.deepEqual(matches, [term.id], `Sparse lookup: ${term.id}`);
    } else {
      assert.equal(terms.length, 1);
      assert.equal(slug, term.surface, `Surface fallback: ${term.id}`);
    }
  }
}

for (const [relativePath, value] of [
  ['src/lib/word-route-collisions.json', collisions],
  ['src/lib/dictionary/word-route-index.json', index],
]) {
  const filename = path.join(root, relativePath);
  const content = JSON.stringify(value) + '\n';
  if (check) {
    assert(fs.existsSync(filename), `Missing generated file: ${relativePath}`);
    assert.equal(fs.readFileSync(filename, 'utf8'), content, `Stale generated file: ${relativePath}`);
  } else {
    fs.writeFileSync(filename, content);
  }
  console.log(`${relativePath}: ${Buffer.byteLength(content)} bytes`);
}
console.log(`${check ? 'Checked' : 'Generated'} ${total} unique routes; ${collisions.length} collision slugs; ${Object.keys(index).length} sparse entries.`);
