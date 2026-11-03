// Apply reviewed KANJIDIC2 translations to the existing static dictionary.
// PREVIOUS_REVIEWED_KANJI may point to the previous reviewed JSON when correcting an existing translation.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const dict = path.join(root, 'public/dict');
const manifestPath = path.join(dict, 'manifest.json');
const reviewed = JSON.parse(fs.readFileSync(path.join(root, 'data/kanji-meanings-reviewed.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const source = fs.readFileSync(path.join(root, 'src/lib/dictionary/kanjiMeanings.ts'), 'utf8');
const sandbox = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const visible = sandbox.exports.getVietnameseKanjiMeanings;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const previousReviewedPath = process.env.PREVIOUS_REVIEWED_KANJI;
const previousReviewed = previousReviewedPath ? JSON.parse(fs.readFileSync(previousReviewedPath, 'utf8')) : {};
const pending = new Set(Object.keys(reviewed));
const files = [];
let updated = 0;

for (const shard of manifest.shards.filter((item) => item.type === 'kanji')) {
  assert.match(shard.url, /^\/dict\/kanji\/[\w-]+\.json$/);
  const filename = path.join(dict, 'kanji', path.basename(shard.url));
  const original = fs.readFileSync(filename, 'utf8');
  assert.equal(sha256(original), shard.sha256, `Shard checksum mismatch: ${shard.id}`);
  const payload = JSON.parse(original);
  assert.equal(payload.records.length, shard.recordCount, shard.id);
  let changed = false;
  for (const record of payload.records) {
    if (!Object.hasOwn(reviewed, record.literal)) continue;
    assert(pending.delete(record.literal), `Duplicate Kanji: ${record.literal}`);
    const meanings = reviewed[record.literal];
    assert(Array.isArray(meanings) && meanings.length && meanings.every((value) => typeof value === 'string' && value.trim()), record.literal);
    assert.equal(visible(meanings).length, meanings.length, `Hidden translation: ${record.literal}`);
    if (JSON.stringify(record.meanings) === JSON.stringify(meanings)) continue;
    assert(visible(record.meanings).length === 0 || (Object.hasOwn(previousReviewed, record.literal) && JSON.stringify(record.meanings) === JSON.stringify(previousReviewed[record.literal])), `Refusing to overwrite existing Vietnamese: ${record.literal}`);
    record.meanings = meanings;
    updated++;
    changed = true;
  }
  if (changed) {
    const content = JSON.stringify(payload);
    shard.bytes = Buffer.byteLength(content);
    shard.sha256 = sha256(content);
    files.push({ filename, content });
  }
}
assert.equal(pending.size, 0, `Missing Kanji: ${[...pending].join(', ')}`);
manifest.kanjiRevision = sha256(JSON.stringify(reviewed));
manifest.generatedAt = new Date().toISOString();
if (!manifest.attribution.some((source) => source.name === 'KANJIDIC2 — Vietnamese meaning translations')) {
  manifest.attribution.push({ name: 'KANJIDIC2 — Vietnamese meaning translations', sourcePath: 'https://www.edrdg.org/wiki/KANJIDIC_Project.html', license: 'CC BY-SA 4.0', note: '© James William Breen and EDRDG; Vietnamese translations by YomuJi.' });
}
if (!manifest.attribution.some((source) => source.name === 'Kanji meaning reference sources')) {
  manifest.attribution.push({ name: 'Kanji meaning reference sources', sourcePath: '/legal', note: 'See the legal page for sources consulted and their license information.' });
}
for (const file of files) fs.writeFileSync(file.filename, file.content);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Updated ${updated} reviewed Kanji in ${files.length} shards.`);
