const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createJiti } = require('jiti');

const load = createJiti(__filename, { moduleCache: false });
const { recognizeHandwriting, MAX_HANDWRITING_STROKES } = load('../src/lib/handwritingRecognition.ts');
const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/handwriting/recognition-index.json'), 'utf8'));
assert.equal(MAX_HANDWRITING_STROKES, 32);
assert.ok(index.coverage.kanji > 0 && index.coverage.hiragana > 0 && index.coverage.katakana > 0);

function encodedStrokes(character, { reverse = false, offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1, jitter = false } = {}) {
  const template = index.templates.find(([candidate]) => candidate === character);
  assert.ok(template, `missing template for ${character}`);
  const strokes = template[1].map((encoded, strokeIndex) => {
    const points = [];
    for (let i = 0; i < encoded.length; i += 2) {
      const x = index.alphabet.indexOf(encoded[i]);
      const y = index.alphabet.indexOf(encoded[i + 1]);
      const phase = i / 2;
      points.push({
        x: offsetX + scaleX * x + (jitter ? Math.sin(phase * 0.55 + strokeIndex) * 0.7 : 0),
        y: offsetY + scaleY * y + (jitter ? Math.cos(phase * 0.43 + strokeIndex) * 0.7 : 0),
      });
    }
    return reverse ? points.reverse() : points;
  });
  return reverse ? strokes.reverse() : strokes;
}

// User-reported freehand く: canvas-style x/right, y/down; deliberately not a perfect template trace.
const freehandKu = [[68, 20], [56, 31], [43, 43], [37, 50], [44, 58], [55, 68], [67, 81]].map(([x, y]) => ({ x, y }));
const kuResult = recognizeHandwriting([freehandKu], index);
assert.ok(kuResult.includes('く'), `reported く sample missed: ${kuResult.join('')}`);
const oneStrokeTemplates = index.templates.filter(([, strokes]) => strokes.length === 1).length;
const oneStrokeStarted = performance.now();
recognizeHandwriting([freehandKu], index);
const oneStrokeMs = performance.now() - oneStrokeStarted;
const shiTemplate = encodedStrokes('し')[0];
const shiFreehand = shiTemplate.map(({ x, y }, i) => ({ x: 42 + x * 0.9 + Math.sin(i * 0.4), y: 13 + y * 1.1 + Math.cos(i * 0.3) }));
assert.ok(recognizeHandwriting([shiFreehand], index).includes('し'), 'transformed y-down し sample missed');

const proofs = [
  ['日', { offsetX: 121, offsetY: 63, scaleX: 1.2, scaleY: 0.8, jitter: true }],
  ['あ', { offsetX: -17, offsetY: 240, scaleX: 0.8, scaleY: 1.1, jitter: true }],
  ['ア', { offsetX: 300, offsetY: -5, scaleX: 1.1, scaleY: 0.9, jitter: true }],
];
const timings = [];
for (const [character, variation] of proofs) {
  const strokes = encodedStrokes(character, variation);
  const started = performance.now();
  const result = recognizeHandwriting(strokes, index);
  timings.push(performance.now() - started);
  assert.ok(result.includes(character), `${character} missed: ${result.join('')}`);
  assert.equal(new Set(result).size, result.length);
  assert.ok(result.length <= 8);
}

assert.deepEqual(recognizeHandwriting([], index), []);
assert.deepEqual(recognizeHandwriting([[{ x: 1, y: 1 }, { x: 1, y: 1 }]], index), []);
const firstKanji = index.templates.find(([character]) => character.codePointAt(0) >= 0x4e00);
const oneStrokeBucket = index.templates.filter(([, strokes]) => strokes.length === 1).length;
const denseKanji = index.templates.filter(([character]) => character.codePointAt(0) >= 0x4e00).sort((a, b) => b[1].length - a[1].length)[0];
const denseStrokeCount = index.templates.filter(([, strokes]) => strokes.length === denseKanji[1].length).length;
const denseInput = encodedStrokes(denseKanji[0]);
const denseStarted = performance.now();
assert.ok(recognizeHandwriting(denseInput, index).includes(denseKanji[0]));
const denseMs = performance.now() - denseStarted;
const templatesByStrokeCount = new Map();
for (const template of index.templates) {
  const bucket = templatesByStrokeCount.get(template[1].length) || [];
  bucket.push(template);
  templatesByStrokeCount.set(template[1].length, bucket);
}
const [worstStrokeCount, worstBucket] = [...templatesByStrokeCount].sort((a, b) => b[1].length - a[1].length)[0];
const worstKanji = worstBucket.find(([character]) => character.codePointAt(0) >= 0x4e00);
const worstStarted = performance.now();
assert.ok(recognizeHandwriting(encodedStrokes(worstKanji[0]), index).includes(worstKanji[0]));
const worstMs = performance.now() - worstStarted;
console.log(`recognition assertions passed; coverage ${JSON.stringify(index.coverage)}; く=${kuResult.slice(0, 5).join('')}; transformed 日/あ/ア=${timings.map((ms) => ms.toFixed(1)).join('/')}ms; 1-stroke bucket ${oneStrokeBucket} at ${oneStrokeMs.toFixed(1)}ms; largest bucket ${worstBucket.length} candidates/${worstStrokeCount} strokes at ${worstMs.toFixed(1)}ms; max-stroke ${denseKanji[0]} (${denseKanji[1].length} strokes, bucket ${denseStrokeCount}) at ${denseMs.toFixed(1)}ms`);
