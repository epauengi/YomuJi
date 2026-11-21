// Build compact pitch-accent sidecar (public/dict/meta/pitch-accents.json) from Kanjium accents.txt.
// Usage: node scripts/build-pitch-accents.cjs [--input <path-to-accents.txt>]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_URL = 'https://raw.githubusercontent.com/mifunetoshiro/kanjium/master/data/source_files/raw/accents.txt';
const OUT_FILE = path.join(ROOT, 'public/dict/meta/pitch-accents.json');

function toHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function parseAccentList(raw) {
  const nums = [];
  for (const part of raw.split(',')) {
    const cleaned = part.replace(/\([^)]*\)/g, '').trim();
    if (/^\d+$/.test(cleaned)) {
      const n = Number(cleaned);
      if (Number.isSafeInteger(n) && n >= 0 && !nums.includes(n)) nums.push(n);
    }
  }
  return nums;
}

function mergeAccents(existing, incoming) {
  if (!existing) return incoming.slice();
  const merged = existing.slice();
  for (const n of incoming) {
    if (!merged.includes(n)) merged.push(n);
  }
  return merged;
}

function downloadText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(downloadText(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function parseKanjiumIndex(text) {
  const byPair = new Map();
  const byKanaOnly = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [surfaceRaw, readingRaw, accRaw] = line.split('\t');
    if (!surfaceRaw || !accRaw) continue;
    const accents = parseAccentList(accRaw);
    if (!accents.length) continue;

    const surface = surfaceRaw.normalize('NFKC').trim();
    const reading = (readingRaw || '').normalize('NFKC').trim();
    if (reading) {
      const key = `${surface}\t${toHiragana(reading)}`;
      byPair.set(key, mergeAccents(byPair.get(key), accents));
    } else {
      const kanaKey = toHiragana(surface);
      byKanaOnly.set(kanaKey, mergeAccents(byKanaOnly.get(kanaKey), accents));
    }
  }
  return { byPair, byKanaOnly };
}

function matchPitchAccents(index, root = ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/dict/manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1, 'Invalid dictionary manifest schema');
  const termShards = manifest.shards.filter((s) => s.type === 'terms');
  assert.equal(termShards.length, manifest.totals.termShards, 'Term shard count mismatch');

  const out = {};
  let total = 0;
  let matched = 0;

  for (const shard of termShards) {
    const filename = path.basename(shard.url || '');
    assert(/^shard-\d{4}\.json$/.test(filename), `Invalid term shard: ${shard.url}`);
    const payload = JSON.parse(fs.readFileSync(path.join(root, 'public/dict/terms', filename), 'utf8'));
    for (const rec of payload.records) {
      total++;
      const readingNorm = toHiragana((rec.reading || rec.surface || '').normalize('NFKC').trim());
      if (!readingNorm) continue;

      const forms = [rec.surface, ...(rec.writtenForms || [])]
        .map((f) => (typeof f === 'string' ? f.normalize('NFKC').trim() : ''))
        .filter(Boolean);

      let found = null;
      for (const form of forms) {
        const pairHit = index.byPair.get(`${form}\t${readingNorm}`);
        if (pairHit) {
          found = pairHit;
          break;
        }
      }

      if (!found && (!rec.kanji?.length || rec.surface === rec.reading)) {
        const kanaHit = index.byKanaOnly.get(readingNorm);
        if (kanaHit) found = kanaHit;
      }

      if (found && found.length > 0) {
        out[rec.id] = found;
        matched++;
      }
    }
  }

  assert.equal(total, manifest.totals.terms, 'Term total mismatch');
  return { total, matched, map: out };
}

async function main() {
  const args = process.argv.slice(2);
  let inputPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = args[++i];
    }
  }

  const rawText = inputPath
    ? fs.readFileSync(inputPath, 'utf8')
    : await downloadText(DEFAULT_URL);

  const index = parseKanjiumIndex(rawText);
  const { total, matched, map } = matchPitchAccents(index);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const json = JSON.stringify(map);
  fs.writeFileSync(OUT_FILE, json, 'utf8');
  console.log(`Built ${path.relative(ROOT, OUT_FILE)}: ${matched}/${total} terms matched (${((matched / total) * 100).toFixed(1)}%), ${(json.length / 1024 / 1024).toFixed(2)} MB.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to build pitch accents:', err);
    process.exitCode = 1;
  });
}

module.exports = { parseKanjiumIndex, parseAccentList, matchPitchAccents };
