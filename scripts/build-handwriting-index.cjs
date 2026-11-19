const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const strokesDir = path.join(root, 'public/dict/strokes');
const kanaDir = path.join(root, 'public/handwriting/kana');
const kanjiDir = path.join(root, 'public/dict/kanji');
const output = path.join(root, 'public/handwriting/recognition-index.json');
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const pointCount = 24;

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1], match[2]]));
}

function parsePath(data) {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  const paths = [];
  let points = [];
  let x = 0, y = 0, startX = 0, startY = 0;
  let command = '';
  let previousCommand = '';
  let previousControl = null;
  let i = 0;
  const hasNumbers = (count) => i + count <= tokens.length && tokens.slice(i, i + count).every((token) => !/^[a-zA-Z]$/.test(token));
  const number = () => Number(tokens[i++]);
  const add = (nx, ny) => {
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) throw new Error('Invalid SVG path coordinate');
    x = nx; y = ny;
    const last = points[points.length - 1];
    if (!last || Math.hypot(last[0] - x, last[1] - y) > 0.01) points.push([x, y]);
  };
  const finish = () => {
    if (points.length > 1) paths.push(points);
    points = [];
  };
  const curve = (point) => {
    const origin = [x, y];
    for (let step = 1; step <= 10; step++) add(...point(step / 10, origin));
  };

  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
    else if (!command) throw new Error('SVG path command missing');
    const relative = command === command.toLowerCase();
    const op = command.toUpperCase();
    if (op === 'Z') {
      add(startX, startY); finish();
      previousCommand = command; previousControl = null; command = '';
      continue;
    }
    if (op === 'M') {
      if (!hasNumbers(2)) throw new Error('Malformed SVG move');
      const nx = number(), ny = number();
      if (points.length) finish();
      x = relative ? x + nx : nx; y = relative ? y + ny : ny;
      startX = x; startY = y; points = [[x, y]];
      command = relative ? 'l' : 'L'; previousCommand = 'M'; previousControl = null;
      continue;
    }
    if (op === 'L' || op === 'H' || op === 'V') {
      const count = op === 'L' ? 2 : 1;
      if (!hasNumbers(count)) throw new Error('Malformed SVG line');
      if (op === 'L') { const nx = number(), ny = number(); add(relative ? x + nx : nx, relative ? y + ny : ny); }
      else if (op === 'H') { const nx = number(); add(relative ? x + nx : nx, y); }
      else { const ny = number(); add(x, relative ? y + ny : ny); }
      previousCommand = command; previousControl = null;
      continue;
    }
    if (op === 'C' || op === 'S' || op === 'Q' || op === 'T') {
      const count = op === 'C' ? 6 : op === 'S' || op === 'Q' ? 4 : 2;
      if (!hasNumbers(count)) throw new Error('Malformed SVG curve');
      const nums = Array.from({ length: count }, number);
      const abs = (a, b) => relative ? [x + a, y + b] : [a, b];
      const p0 = [x, y];
      let p1, p2, p3;
      if (op === 'C') {
        p1 = abs(nums[0], nums[1]); p2 = abs(nums[2], nums[3]); p3 = abs(nums[4], nums[5]);
        curve((t, origin) => {
          const u = 1 - t;
          return [u ** 3 * origin[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0], u ** 3 * origin[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1]];
        });
        previousControl = p2;
      } else if (op === 'S') {
        p1 = ['C', 'S'].includes(previousCommand.toUpperCase()) && previousControl ? [2 * x - previousControl[0], 2 * y - previousControl[1]] : p0;
        p2 = abs(nums[0], nums[1]); p3 = abs(nums[2], nums[3]);
        curve((t, origin) => {
          const u = 1 - t;
          return [u ** 3 * origin[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0], u ** 3 * origin[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1]];
        });
        previousControl = p2;
      } else if (op === 'Q') {
        p1 = abs(nums[0], nums[1]); p2 = abs(nums[2], nums[3]);
        curve((t, origin) => {
          const u = 1 - t;
          return [u ** 2 * origin[0] + 2 * u * t * p1[0] + t ** 2 * p2[0], u ** 2 * origin[1] + 2 * u * t * p1[1] + t ** 2 * p2[1]];
        });
        previousControl = p1;
      } else {
        p1 = ['Q', 'T'].includes(previousCommand.toUpperCase()) && previousControl ? [2 * x - previousControl[0], 2 * y - previousControl[1]] : p0;
        p2 = abs(nums[0], nums[1]);
        curve(nums, (t, origin) => {
          const u = 1 - t;
          return [u ** 2 * origin[0] + 2 * u * t * p1[0] + t ** 2 * p2[0], u ** 2 * origin[1] + 2 * u * t * p1[1] + t ** 2 * p2[1]];
        });
        previousControl = p1;
      }
      x = p3 ? p3[0] : p2[0]; y = p3 ? p3[1] : p2[1];
      previousCommand = command;
      continue;
    }
    if (op === 'A') {
      if (!hasNumbers(7)) throw new Error('Malformed SVG arc');
      const [rx0, ry0, angle, large, sweep, px, py] = Array.from({ length: 7 }, number);
      const end = [relative ? x + px : px, relative ? y + py : py];
      const rx = Math.abs(rx0), ry = Math.abs(ry0);
      if (!rx || !ry || (x === end[0] && y === end[1])) add(...end);
      else {
        const phi = angle * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
        const dx = (x - end[0]) / 2, dy = (y - end[1]) / 2;
        const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
        const scale = Math.max(1, Math.sqrt(xp * xp / (rx * rx) + yp * yp / (ry * ry)));
        const arx = rx * scale, ary = ry * scale;
        const numerator = Math.max(0, arx ** 2 * ary ** 2 - arx ** 2 * yp ** 2 - ary ** 2 * xp ** 2);
        const denominator = arx ** 2 * yp ** 2 + ary ** 2 * xp ** 2;
        const factor = (large === sweep ? -1 : 1) * Math.sqrt(denominator ? numerator / denominator : 0);
        const cxp = factor * arx * yp / ary, cyp = -factor * ary * xp / arx;
        const cx = cos * cxp - sin * cyp + (x + end[0]) / 2;
        const cy = sin * cxp + cos * cyp + (y + end[1]) / 2;
        const ux = (xp - cxp) / arx, uy = (yp - cyp) / ary;
        const vx = (-xp - cxp) / arx, vy = (-yp - cyp) / ary;
        const start = Math.atan2(uy, ux);
        let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        if (!sweep && delta > 0) delta -= 2 * Math.PI;
        if (sweep && delta < 0) delta += 2 * Math.PI;
        const steps = Math.max(4, Math.ceil(Math.abs(delta) * Math.max(arx, ary) / 16));
        for (let step = 1; step <= steps; step++) {
          const theta = start + delta * step / steps;
          add(cx + cos * arx * Math.cos(theta) - sin * ary * Math.sin(theta), cy + sin * arx * Math.cos(theta) + cos * ary * Math.sin(theta));
        }
        add(...end);
      }
      previousCommand = command; previousControl = null;
      continue;
    }
    throw new Error(`Unsupported SVG path command: ${command}`);
  }
  finish();
  return paths;
}

function extractPathData(svg, animcjk) {
  const tags = [...svg.matchAll(/<path\b[^>]*>/g)].map((match) => attributes(match[0]));
  return tags.filter((attrs) => attrs.d && (!animcjk || attrs['clip-path'])).map((attrs) => attrs.d);
}

function readJoyo() {
  const chars = new Set();
  for (const file of fs.readdirSync(kanjiDir).filter((name) => /^shard-\d+\.json$/.test(name)).sort()) {
    const shard = JSON.parse(fs.readFileSync(path.join(kanjiDir, file), 'utf8'));
    for (const record of shard.records || []) {
      if (record.tags?.includes('jouyou') || Number(record.grade) >= 1 && Number(record.grade) <= 6) chars.add(record.literal);
    }
  }
  return chars;
}

function resample(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lengths[lengths.length - 1];
  if (!total) return null;
  const output = [];
  let segment = 1;
  for (let i = 0; i < pointCount; i++) {
    const distance = total * i / (pointCount - 1);
    while (segment < lengths.length - 1 && lengths[segment] < distance) segment++;
    const start = points[segment - 1], end = points[segment];
    const span = lengths[segment] - lengths[segment - 1];
    const ratio = span ? (distance - lengths[segment - 1]) / span : 0;
    output.push([start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio]);
  }
  return output;
}

function encode(paths) {
  const points = paths.flat();
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX, height = maxY - minY, scale = 63 / Math.max(width, height);
  if (!Number.isFinite(scale)) return null;
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  return paths.map((stroke) => {
    const sampled = resample(stroke);
    if (!sampled) return null;
    return sampled.map(([x, y]) => alphabet[Math.max(0, Math.min(63, Math.round((x - midX) * scale + 31.5)))] + alphabet[Math.max(0, Math.min(63, Math.round((y - midY) * scale + 31.5))) ]).join('');
  });
}

function loadStrokes(file, animcjk) {
  const svg = fs.readFileSync(file, 'utf8');
  const data = animcjk
    ? extractPathData(svg, true)
    : (() => {
        const group = svg.match(/<g\b[^>]*id=["']kvg:StrokePaths_[^"']+["'][^>]*>([\s\S]*?)<g\b[^>]*id=["']kvg:StrokeNumbers_/);
        return group ? extractPathData(group[1], false) : [];
      })();
  if (!data.length) return null;
  try {
    const paths = data.flatMap(parsePath);
    return paths.length ? encode(paths) : null;
  } catch (error) {
    console.warn(`Skipping ${path.basename(file)}: ${error.message}`);
    return null;
  }
}

function main() {
  const templates = new Map();
  const joyo = readJoyo();
  const strokeFiles = new Set(fs.readdirSync(strokesDir).filter((name) => /^[0-9a-f]{5}\.svg$/i.test(name)));
  const kanaFiles = fs.readdirSync(kanaDir).filter((name) => /^[0-9a-f]{5}\.svg$/i.test(name)).sort();

  for (const character of joyo) {
    const filename = `${character.codePointAt(0).toString(16).padStart(5, '0')}.svg`;
    if (!strokeFiles.has(filename)) continue;
    const encoded = loadStrokes(path.join(strokesDir, filename), true);
    if (encoded && encoded.length <= 32 && encoded.every(Boolean)) templates.set(character, encoded);
  }
  for (const filename of kanaFiles) {
    const codepoint = Number.parseInt(path.basename(filename, '.svg'), 16);
    if (!(codepoint >= 0x3041 && codepoint <= 0x3096 || codepoint >= 0x30a1 && codepoint <= 0x30ff || codepoint >= 0x31f0 && codepoint <= 0x31ff)) continue;
    const character = String.fromCodePoint(codepoint);
    const encoded = loadStrokes(path.join(kanaDir, filename), false);
    if (encoded && encoded.length <= 32 && encoded.every(Boolean)) templates.set(character, encoded);
  }

  const sorted = [...templates].sort(([a], [b]) => a.codePointAt(0) - b.codePointAt(0));
  const coverage = {
    total: sorted.length,
    kanji: sorted.filter(([char]) => char.codePointAt(0) >= 0x3400 && char.codePointAt(0) <= 0x9fff).length,
    hiragana: sorted.filter(([char]) => char.codePointAt(0) >= 0x3040 && char.codePointAt(0) <= 0x309f).length,
    katakana: sorted.filter(([char]) => char.codePointAt(0) >= 0x30a0 && char.codePointAt(0) <= 0x30ff || char.codePointAt(0) >= 0x31f0 && char.codePointAt(0) <= 0x31ff).length,
  };
  const index = { version: 1, samplePoints: pointCount, alphabet, coverage, templates: sorted };
  fs.writeFileSync(output, `${JSON.stringify(index)}\n`);
  console.log(`Built ${coverage.total} templates (${coverage.kanji} kanji, ${coverage.hiragana} hiragana, ${coverage.katakana} katakana), ${fs.statSync(output).size} bytes`);
}

main();
