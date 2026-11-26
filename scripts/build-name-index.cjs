'use strict';

// Build compressed offline JMnedict/EDRDG name shards under public/names/.
// Usage: node scripts/build-name-index.cjs [--input <JMnedict.xml[.gz]>] [--out <dir>] [--url <url>]

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_URL = 'https://www.edrdg.org/pub/Nihongo/JMnedict.xml.gz';
const DEFAULT_OUT = path.join(ROOT, 'public', 'names');
const SCHEMA_VERSION = 1;
const SHARD_COUNT = 32;

const CATEGORY_ORDER = ['surname', 'given', 'fem', 'masc', 'person', 'place', 'station'];
const CATEGORY_BIT = {
  surname: 1,
  given: 2,
  fem: 4,
  masc: 8,
  person: 16,
  place: 32,
  station: 64,
};

const KANA_ONLY_RE = /^[\u3040-\u309F\u30FC]+$/;

const LICENSE_TEXT = `JMnedict / ENAMDICT — Japanese Proper Names Dictionary
Source: Electronic Dictionary Research and Development Group (EDRDG)
URL: https://www.edrdg.org/enamdict/enamdict_doc.html
Download: https://www.edrdg.org/pub/Nihongo/JMnedict.xml.gz

License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
License URL: https://creativecommons.org/licenses/by-sa/4.0/
EDRDG Licence Statement: https://www.edrdg.org/edrdg/licence.html

Attribution:
This dataset includes Japanese proper name entries (surname, given, fem, masc,
person, place, station) derived from JMnedict/ENAMDICT, which is the property
of the Electronic Dictionary Research and Development Group (EDRDG), used in
conformance with the Group's licence.
`;

function parseArgs(argv) {
  const args = { input: null, out: DEFAULT_OUT, url: DEFAULT_URL };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--input' && argv[i + 1]) args.input = argv[++i];
    else if (flag === '--out' && argv[i + 1]) args.out = path.resolve(argv[++i]);
    else if (flag === '--url' && argv[i + 1]) args.url = argv[++i];
    else throw new Error(`Unknown or incomplete argument: ${flag}`);
  }
  return args;
}

function decodeXmlEntities(text) {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (full, ent) => {
    if (ent === 'amp') return '&';
    if (ent === 'lt') return '<';
    if (ent === 'gt') return '>';
    if (ent === 'quot') return '"';
    if (ent === 'apos') return "'";
    if (ent.startsWith('#x')) return String.fromCodePoint(parseInt(ent.slice(2), 16));
    if (ent.startsWith('#')) return String.fromCodePoint(parseInt(ent.slice(1), 10));
    return full;
  });
}

function normalizeNameKey(value) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s・･]+/g, '')
    .replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function bucketForKey(normKey) {
  const cp = normKey.codePointAt(0);
  return cp === undefined ? 0 : cp % SHARD_COUNT;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function deterministicGzip(buffer) {
  const gz = zlib.gzipSync(buffer, { level: 9 });
  // Normalize RFC 1952 header fields (MTIME=0, XFL=2, OS=255) for reproducible bytes across OSes.
  gz[4] = 0;
  gz[5] = 0;
  gz[6] = 0;
  gz[7] = 0;
  gz[8] = 2;
  gz[9] = 255;
  return gz;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function downloadBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects fetching ${url}`));
          return;
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        resolve(downloadBuffer(nextUrl, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error(`Timeout fetching ${url}`)));
    req.on('error', reject);
  });
}

function loadXmlText(rawBuf) {
  const isGzip = rawBuf.length >= 2 && rawBuf[0] === 0x1f && rawBuf[1] === 0x8b;
  const plain = isGzip ? zlib.gunzipSync(rawBuf) : rawBuf;
  return plain.toString('utf8');
}

function parseJmnedictXml(xml) {
  const dateMatch = xml.match(/<!--\s*JMnedict created:\s*([0-9-]+)\s*-->/);
  const sourceDate = dateMatch ? dateMatch[1] : 'unknown';

  const pairs = new Map();
  let scannedEntries = 0;
  let keptEntries = 0;
  let idx = 0;

  while (true) {
    const start = xml.indexOf('<entry>', idx);
    if (start === -1) break;
    const end = xml.indexOf('</entry>', start);
    if (end === -1) break;
    const block = xml.slice(start, end + 8);
    idx = end + 8;
    scannedEntries++;

    let mask = 0;
    for (const m of block.matchAll(/<name_type>&([a-z]+);<\/name_type>/g)) {
      const bit = CATEGORY_BIT[m[1]];
      if (bit) mask |= bit;
    }
    if (!mask) continue;
    keptEntries++;

    const kebs = [];
    for (const m of block.matchAll(/<keb>([^<]+)<\/keb>/g)) {
      const val = decodeXmlEntities(m[1]).trim();
      if (val) kebs.push(val);
    }

    for (const rb of block.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)) {
      const rebMatch = rb[1].match(/<reb>([^<]+)<\/reb>/);
      if (!rebMatch) continue;
      const reading = decodeXmlEntities(rebMatch[1]).trim();
      if (!reading) continue;

      const restrs = [];
      for (const rm of rb[1].matchAll(/<re_restr>([^<]+)<\/re_restr>/g)) {
        const val = decodeXmlEntities(rm[1]).trim();
        if (val) restrs.push(val);
      }

      const surfaces = kebs.length ? (restrs.length ? restrs : kebs) : [reading];
      for (const surface of surfaces) {
        if (!surface || surface.includes('\t') || surface.includes('\n') || reading.includes('\t') || reading.includes('\n')) {
          continue;
        }
        const key = `${surface}\t${reading}`;
        pairs.set(key, (pairs.get(key) || 0) | mask);
      }
    }
  }

  return { sourceDate, scannedEntries, keptEntries, pairs };
}

function buildNameIndex(xml, outDir, sourceUrl) {
  const { sourceDate, scannedEntries, keptEntries, pairs } = parseJmnedictXml(xml);

  const categoryCounts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0]));
  const sBuckets = Array.from({ length: SHARD_COUNT }, () => []);
  const rBuckets = Array.from({ length: SHARD_COUNT }, () => []);

  for (const [key, mask] of pairs.entries()) {
    const sep = key.indexOf('\t');
    const surface = key.slice(0, sep);
    const reading = key.slice(sep + 1);
    const normSurface = normalizeNameKey(surface);
    const normReading = normalizeNameKey(reading);
    if (!normSurface || !normReading) continue;

    for (const cat of CATEGORY_ORDER) {
      if (mask & CATEGORY_BIT[cat]) categoryCounts[cat]++;
    }

    const row = { surface, reading, normSurface, normReading, mask };
    const rBucket = bucketForKey(normReading);
    rBuckets[rBucket].push(row);

    const sBucket = bucketForKey(normSurface);
    const kanaOnly = KANA_ONLY_RE.test(normSurface);
    if (!kanaOnly || sBucket !== rBucket) {
      sBuckets[sBucket].push(row);
    }
  }

  const shardsDir = path.join(outDir, 'shards');
  fs.mkdirSync(shardsDir, { recursive: true });
  for (const existing of fs.readdirSync(shardsDir)) {
    if (existing.endsWith('.tsv.gz')) fs.unlinkSync(path.join(shardsDir, existing));
  }

  const shardMeta = [];
  let totalBytes = 0;

  const writeKind = (kind, buckets) => {
    for (let bucket = 0; bucket < SHARD_COUNT; bucket++) {
      const rows = buckets[bucket];
      rows.sort((a, b) =>
        kind === 's'
          ? cmp(a.normSurface, b.normSurface) || cmp(a.surface, b.surface) || cmp(a.reading, b.reading)
          : cmp(a.normReading, b.normReading) || cmp(a.reading, b.reading) || cmp(a.surface, b.surface),
      );
      const tsv = rows
        .map((r) => (r.surface === r.reading ? `${r.surface}\t\t${r.mask}` : `${r.surface}\t${r.reading}\t${r.mask}`))
        .join('\n');
      const gz = deterministicGzip(Buffer.from(tsv, 'utf8'));
      const id = `${kind}-${pad2(bucket)}`;
      const fileName = `${id}.tsv.gz`;
      fs.writeFileSync(path.join(shardsDir, fileName), gz);

      totalBytes += gz.length;
      shardMeta.push({
        id,
        kind,
        bucket,
        url: `/names/shards/${fileName}`,
        bytes: gz.length,
        entries: rows.length,
        sha256: sha256(gz),
      });
    }
  };

  writeKind('s', sBuckets);
  writeKind('r', rBuckets);

  const digestInput = shardMeta.map((s) => `${s.id}:${s.sha256}`).join('\n');
  const shortHash = sha256(Buffer.from(digestInput, 'utf8')).slice(0, 12);
  const dataVersion = `jmnedict-${sourceDate}-${shortHash}`;

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    dataVersion,
    source: 'EDRDG JMnedict / ENAMDICT',
    sourceUrl,
    sourceDate,
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://www.edrdg.org/edrdg/licence.html',
    attribution:
      'Japanese proper names from JMnedict/ENAMDICT, property of the Electronic Dictionary Research and Development Group (EDRDG), licensed under CC BY-SA 4.0.',
    basePath: '/names',
    shardCount: SHARD_COUNT,
    totalEntries: pairs.size,
    totalBytes,
    categories: categoryCounts,
    shards: shardMeta,
  };

  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'LICENSE.txt'), LICENSE_TEXT, 'utf8');

  return { scannedEntries, keptEntries, manifest };
}

async function main() {
  const args = parseArgs(process.argv);
  const rawBuf = args.input ? fs.readFileSync(args.input) : await downloadBuffer(args.url);
  const xml = loadXmlText(rawBuf);
  const { scannedEntries, keptEntries, manifest } = buildNameIndex(xml, args.out, args.url);

  const surfaceBytes = manifest.shards.filter((s) => s.kind === 's').reduce((sum, s) => sum + s.bytes, 0);
  const readingBytes = manifest.shards.filter((s) => s.kind === 'r').reduce((sum, s) => sum + s.bytes, 0);
  const maxShard = manifest.shards.reduce((m, s) => (s.bytes > m.bytes ? s : m), manifest.shards[0]);

  console.log(
    JSON.stringify(
      {
        outDir: path.relative(ROOT, args.out) || args.out,
        dataVersion: manifest.dataVersion,
        sourceDate: manifest.sourceDate,
        scannedEntries,
        keptEntries,
        uniquePairs: manifest.totalEntries,
        shards: manifest.shards.length,
        surfaceMB: +(surfaceBytes / 1024 / 1024).toFixed(2),
        readingMB: +(readingBytes / 1024 / 1024).toFixed(2),
        totalMB: +(manifest.totalBytes / 1024 / 1024).toFixed(2),
        maxShard: { id: maxShard.id, kb: +(maxShard.bytes / 1024).toFixed(1) },
        categories: manifest.categories,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  CATEGORY_BIT,
  CATEGORY_ORDER,
  SHARD_COUNT,
  buildNameIndex,
  deterministicGzip,
  normalizeNameKey,
  parseJmnedictXml,
};
