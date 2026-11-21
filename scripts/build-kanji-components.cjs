// Generate public/dict/meta/kanji-components.json from KanjiVG SVGs + existing kanji shards.
// Usage: node scripts/build-kanji-components.cjs
const fs = require('node:fs');
const path = require('node:path');

const KANJIVG_DIR = process.env.KANJIVG_DIR || 'D:/IT/Project/Data JPVNDict/Data/kanjivg-master/kanjivg-master/kanji';
const KANJI_DIR = path.join('public', 'dict', 'kanji');
const OUT_PATH = path.join('public', 'dict', 'meta', 'kanji-components.json');
const MIN_FREQUENCY = 5;

const dictKanji = new Map();
for (const file of fs.readdirSync(KANJI_DIR).filter((name) => name.endsWith('.json')).sort()) {
  const { records } = JSON.parse(fs.readFileSync(path.join(KANJI_DIR, file), 'utf8'));
  for (const record of records) {
    dictKanji.set(record.literal, {
      strokes: Number(record.strokeCount) || 0,
      hv: (record.hanViet && record.hanViet[0]) || '',
      freq: Number(record.frequency) || 99999,
      jlpt: record.jlpt || '',
    });
  }
}

const partToKanji = new Map();
const partStrokes = new Map();
let matched = 0;
let withParts = 0;

for (const [literal, info] of dictKanji) {
  const hex = literal.codePointAt(0).toString(16).padStart(5, '0');
  const svgPath = path.join(KANJIVG_DIR, `${hex}.svg`);
  if (!fs.existsSync(svgPath)) continue;
  matched += 1;
  const svg = fs.readFileSync(svgPath, 'utf8');
  const parts = new Set();
  for (const match of svg.matchAll(/<g\b[^>]*>/gu)) {
    const el = match[0].match(/kvg:element="([^"]+)"/u)?.[1];
    const orig = match[0].match(/kvg:original="([^"]+)"/u)?.[1];
    // Keep single characters (KanjiVG occasionally has multi-char notes); exclude self.
    for (const candidate of [el, orig]) {
      if (candidate && candidate !== literal && [...candidate].length === 1) parts.add(candidate);
    }
    if (el && [...el].length === 1 && !match[0].includes('kvg:part="') && !partStrokes.has(el)) {
      // Estimate stroke count from the <g> element's enclosed <path> tags in KanjiVG.
      const start = match.index + match[0].length;
      let depth = 1, pos = start, paths = 0;
      while (depth > 0 && pos < svg.length) {
        const next = svg.indexOf('<', pos);
        if (next === -1) break;
        if (svg.startsWith('<g', next)) depth += 1;
        else if (svg.startsWith('</g>', next)) depth -= 1;
        else if (svg.startsWith('<path', next)) paths += 1;
        pos = next + 2;
      }
      if (paths > 0) partStrokes.set(el, paths);
    }
  }
  if (!parts.size) continue;
  withParts += 1;
  for (const part of parts) {
    let list = partToKanji.get(part);
    if (!list) partToKanji.set(part, (list = []));
    list.push(literal);
  }
}

// Compute stroke count for each component from KanjiVG or dictionary metadata when available.
for (const part of partToKanji.keys()) {
  const fromDict = dictKanji.get(part)?.strokes;
  if (fromDict) { partStrokes.set(part, fromDict); continue; }
  if (partStrokes.has(part)) continue;
  const hex = part.codePointAt(0).toString(16).padStart(5, '0');
  const svgPath = path.join(KANJIVG_DIR, `${hex}.svg`);
  if (fs.existsSync(svgPath)) {
    const count = (fs.readFileSync(svgPath, 'utf8').match(/<path\b/gu) || []).length;
    if (count) partStrokes.set(part, count);
  }
}

// Order kanji by frequency then stroke count so common kanji appear first.
const kanjiList = [...dictKanji.entries()]
  .filter(([literal]) => {
    const hex = literal.codePointAt(0).toString(16).padStart(5, '0');
    return fs.existsSync(path.join(KANJIVG_DIR, `${hex}.svg`));
  })
  .sort((a, b) => a[1].freq - b[1].freq || a[1].strokes - b[1].strokes || a[0].localeCompare(b[0]));

const kanjiIndex = new Map(kanjiList.map(([literal], index) => [literal, index]));
const components = [...partToKanji.entries()]
  .filter(([, list]) => list.length >= MIN_FREQUENCY)
  .map(([char, list]) => [char, partStrokes.get(char) || 0, list.map((k) => kanjiIndex.get(k)).sort((a, b) => a - b)])
  .sort((a, b) => (a[1] || 99) - (b[1] || 99) || b[2].length - a[2].length || a[0].localeCompare(b[0]));

const payload = {
  source: 'KanjiVG (CC BY-SA 3.0)',
  coverage: { totalDictKanji: dictKanji.size, indexedKanji: kanjiList.length, withComponents: withParts },
  // Compact arrays: kanji = [literal, strokes, hanViet], components = [char, strokes, kanjiIndices[]]
  kanji: kanjiList.map(([literal, info]) => [literal, info.strokes, info.hv]),
  components,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
console.log({
  out: OUT_PATH,
  bytes: fs.statSync(OUT_PATH).size,
  coverage: payload.coverage,
  componentCount: components.length,
  checkSei: components.filter(([c]) => c === '氵' || c === '青').map(([c, s, ids]) => [c, s, ids.includes(kanjiIndex.get('清'))]),
});
