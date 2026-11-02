// ponytail: in-memory sidecar cache validates 196k terms in single pass without per-term IO; upgrade to streaming if RAM < 512MB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const dictDir = path.join(rootDir, 'public', 'dict');
const manifestPath = path.join(dictDir, 'manifest.json');

assert(fs.existsSync(manifestPath), `Manifest missing: ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.schemaVersion, 1, 'Manifest schemaVersion');
assert.equal(manifest.dataVersion, '1.1.0', 'Manifest dataVersion');
assert.equal(manifest.totals.terms, 196583, 'Manifest terms total');
assert.equal(manifest.totals.examples, 31571, 'Manifest examples total');
assert.equal(manifest.totals.termShards, 99, 'Manifest termShards total');

const termShardManifests = manifest.shards.filter((s) => s.type === 'terms');
assert.equal(termShardManifests.length, manifest.totals.termShards, 'Term shards manifest count');

const sensesDir = path.join(dictDir, 'senses', manifest.dataVersion);
assert(fs.existsSync(sensesDir), `Senses directory missing: ${sensesDir}`);

const sidecarFiles = fs.readdirSync(sensesDir).filter((file) => file.endsWith('.json'));
assert.equal(sidecarFiles.length, 187, 'Sidecar bucket files count');

// Read each bucket sidecar once into memory to avoid per-term reread
const sidecarBuckets = new Map();
let totalSidecarRecords = 0;

for (const file of sidecarFiles) {
  const bucketId = parseInt(path.basename(file, '.json'), 10);
  assert(Number.isInteger(bucketId), `Invalid bucket filename: ${file}`);

  const payload = JSON.parse(fs.readFileSync(path.join(sensesDir, file), 'utf8'));
  assert.equal(payload.schemaVersion, 1, `Bucket ${file} schemaVersion`);
  assert.equal(payload.dataVersion, manifest.dataVersion, `Bucket ${file} dataVersion`);
  assert(payload.records && typeof payload.records === 'object', `Bucket ${file} records object`);

  for (const [seqStr, rec] of Object.entries(payload.records)) {
    const seq = Number(seqStr);
    assert(Number.isInteger(seq) && seq > 0, `Invalid sequence in bucket ${file}: ${seqStr}`);
    assert.equal(Math.floor(seq / 10000), bucketId, `Sequence ${seq} mismatched bucket ${bucketId}`);
    assert(typeof rec.id === 'string' && rec.id.length > 0, `Invalid sidecar id for ${seq}`);
    assert(Array.isArray(rec.senses), `Sidecar senses missing for ${seq}`);
    totalSidecarRecords++;
  }

  sidecarBuckets.set(bucketId, payload.records);
}

assert.equal(totalSidecarRecords, manifest.totals.terms, 'Total sidecar records matches terms total');

// Scan all term shards once: verify term records, uniqueness, sidecar parity, target terms, and examples
const termIds = new Set();
const termSeqs = new Set();
const exampleIds = new Set();
let totalTerms = 0;
let totalTermExamples = 0;

let utsuTerm = null;
let ikuTerm = null;
let jouzuTerm = null;

for (const shardInfo of termShardManifests) {
  const shardPath = path.join(dictDir, shardInfo.url.replace(/^\/dict\//, ''));
  assert(fs.existsSync(shardPath), `Shard missing: ${shardPath}`);

  const shardData = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  assert.equal(shardData.schemaVersion, 1, `Shard ${shardInfo.id} schemaVersion`);
  assert.equal(shardData.dataVersion, manifest.dataVersion, `Shard ${shardInfo.id} dataVersion`);
  assert.equal(shardData.type, 'terms', `Shard ${shardInfo.id} type`);
  assert.equal(shardData.records.length, shardInfo.recordCount, `Shard ${shardInfo.id} recordCount`);

  for (const term of shardData.records) {
    totalTerms++;

    assert(typeof term.id === 'string' && term.id.length > 0, `Invalid term id at sequence ${term.sequence}`);
    assert(!termIds.has(term.id), `Duplicate term id: ${term.id}`);
    termIds.add(term.id);

    assert(Number.isInteger(term.sequence) && term.sequence > 0, `Invalid term sequence: ${term.sequence}`);
    assert(!termSeqs.has(term.sequence), `Duplicate term sequence: ${term.sequence}`);
    termSeqs.add(term.sequence);

    // Verify sidecar record identity and identical forms/senses
    const bucket = Math.floor(term.sequence / 10000);
    const bucketRecords = sidecarBuckets.get(bucket);
    assert(bucketRecords, `Bucket ${bucket} not found for term ${term.sequence}`);

    const sidecarRec = bucketRecords[String(term.sequence)];
    assert(sidecarRec, `Missing sidecar entry for term ${term.sequence}`);
    assert.equal(sidecarRec.id, term.id, `ID mismatch for ${term.sequence}`);
    assert.deepEqual(sidecarRec.writtenForms, term.writtenForms, `writtenForms mismatch for ${term.sequence}`);
    assert.deepEqual(sidecarRec.readingForms, term.readingForms, `readingForms mismatch for ${term.sequence}`);
    assert.deepEqual(sidecarRec.senses, term.senses, `senses mismatch for ${term.sequence}`);

    // Track examples
    if (term.examples && term.examples.length > 0) {
      totalTermExamples += term.examples.length;
      for (const ex of term.examples) {
        assert(typeof ex.id === 'string' && ex.id.length > 0, `Invalid example id in term ${term.sequence}`);
        exampleIds.add(ex.id);
      }
    }

    if (term.sequence === 1408810) utsuTerm = term;
    if (term.sequence === 1578850) ikuTerm = term;
    if (term.sequence === 1580400) jouzuTerm = term;
  }
}

assert.equal(totalTerms, manifest.totals.terms, 'Processed term count matches manifest');
assert.equal(termIds.size, manifest.totals.terms, 'All term IDs unique');
assert.equal(termSeqs.size, manifest.totals.terms, 'All term sequences unique');

// 2) 打つ 1408810: exactly 15 senses, first contains 10 glosses and first example Japanese expected
assert(utsuTerm, 'Term 打つ (1408810) not found');
assert.equal(utsuTerm.senses.length, 15, '打つ senses count');
assert.equal(utsuTerm.senses[0].meaningsVi.length, 10, '打つ first sense glosses count');
assert.equal(
  utsuTerm.senses[0].examples[0]?.textJa,
  '階段から落ちて背中を強く打ちました。',
  '打つ first sense first example Japanese'
);

// 3) 行く 1578850: restriction 逝く on meaning 'chết'
assert(ikuTerm, 'Term 行く (1578850) not found');
const chetSense = ikuTerm.senses.find((s) => s.meaningsVi.some((m) => m.toLowerCase().includes('chết')));
assert(chetSense, 'Going term sense containing meaning "chết" not found');
assert.deepEqual(chetSense.appliesToKanji, ['逝く'], '逝く restriction on meaning "chết"');

// 4) 上手 1580400: senses restricted to かみて and うわて
assert(jouzuTerm, 'Term 上手 (1580400) not found');
const kamiteSenses = jouzuTerm.senses.filter((s) => s.appliesToReadings.includes('かみて'));
const uwateSenses = jouzuTerm.senses.filter((s) => s.appliesToReadings.includes('うわて'));
assert(kamiteSenses.length >= 1, '上手 has sense restricted to かみて');
assert(uwateSenses.length >= 1, '上手 has sense restricted to うわて');
assert.deepEqual(
  jouzuTerm.senses.map((s) => s.appliesToReadings),
  [[], ['かみて'], ['かみて'], ['うわて'], ['うわて']],
  '上手 appliesToReadings restrictions pattern'
);

// 5) all 31,571 examples retained
assert.equal(totalTermExamples, 31571, 'Total examples retained count');
assert.equal(exampleIds.size, 31571, 'All example IDs unique');

console.log('PASS: check-omoha-data validated 196,583 terms, 187 sidecars, 31,571 examples, and semantic restrictions.');
