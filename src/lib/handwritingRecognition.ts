export type InkPoint = { x: number; y: number };
export type InkStroke = InkPoint[];

type EncodedStroke = string;
type Template = [character: string, strokes: EncodedStroke[]];

export type HandwritingIndex = {
  version: 1;
  samplePoints: number;
  alphabet: string;
  coverage: { total: number; kanji: number; hiragana: number; katakana: number };
  templates: Template[];
};

const INDEX_URL = '/handwriting/recognition-index.json';
const FETCH_TIMEOUT_MS = 15_000;
const SAMPLE_POINTS = 24;
export const MAX_HANDWRITING_STROKES = 32;
const MAX_POINTS_PER_STROKE = 2_000;
const MAX_TEMPLATES = 20_000;
let cachedIndex: HandwritingIndex | undefined;
let pendingIndex: Promise<HandwritingIndex> | undefined;
type DecodedTemplate = { character: string; strokes: number[][][] };
const decodedIndex = new WeakMap<HandwritingIndex, Map<number, DecodedTemplate[]>>();

function validateIndex(value: unknown): HandwritingIndex {
  if (!value || typeof value !== 'object') throw new Error('Invalid handwriting index');
  const index = value as HandwritingIndex;
  if (index.version !== 1 || index.samplePoints !== SAMPLE_POINTS || typeof index.alphabet !== 'string' || index.alphabet.length !== 64 || !Array.isArray(index.templates) || index.templates.length > MAX_TEMPLATES) {
    throw new Error('Invalid handwriting index');
  }
  for (const template of index.templates) {
    if (!Array.isArray(template) || typeof template[0] !== 'string' || Array.from(template[0]).length !== 1 || !Array.isArray(template[1]) || template[1].length < 1 || template[1].length > MAX_HANDWRITING_STROKES) {
      throw new Error('Invalid handwriting template');
    }
    for (const stroke of template[1]) {
      if (typeof stroke !== 'string' || stroke.length !== SAMPLE_POINTS * 2 || [...stroke].some((char) => !index.alphabet.includes(char))) throw new Error('Invalid handwriting stroke');
    }
  }
  return index;
}

export async function loadHandwritingIndex(): Promise<HandwritingIndex> {
  if (cachedIndex) return cachedIndex;
  if (pendingIndex) return pendingIndex;
  pendingIndex = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(INDEX_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`Handwriting index request failed: ${response.status}`);
      cachedIndex = validateIndex(await response.json());
      return cachedIndex;
    } finally {
      clearTimeout(timeout);
      pendingIndex = undefined;
    }
  })();
  return pendingIndex;
}

function normalizeStrokes(strokes: InkStroke[]): number[][][] | null {
  if (!Array.isArray(strokes) || !strokes.length || strokes.length > MAX_HANDWRITING_STROKES) return null;
  const clean = strokes.map((stroke) => {
    if (!Array.isArray(stroke) || !stroke.length || stroke.length > MAX_POINTS_PER_STROKE) return null;
    const points: number[][] = [];
    for (const point of stroke) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      const last = points[points.length - 1];
      if (!last || Math.hypot(point.x - last[0], point.y - last[1]) > 0.001) points.push([point.x, point.y]);
    }
    if (points.length === 1) points.push([...points[0]]);
    return points;
  });
  if (clean.some((stroke) => !stroke)) return null;
  const points = (clean as number[][][]).flat();
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  const width = maxX - minX, height = maxY - minY;
  const size = Math.max(width, height);
  if (!Number.isFinite(size) || size < 1) return null;
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  return (clean as number[][][]).map((stroke) => {
    const distances = [0];
    for (let i = 1; i < stroke.length; i++) distances.push(distances[i - 1] + Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1]));
    const total = distances[distances.length - 1];
    if (!total) return Array.from({ length: SAMPLE_POINTS }, () => [(stroke[0][0] - midX) / size * 63, (stroke[0][1] - midY) / size * 63]);
    let segment = 1;
    return Array.from({ length: SAMPLE_POINTS }, (_, i) => {
      const distance = total * i / (SAMPLE_POINTS - 1);
      while (segment < distances.length - 1 && distances[segment] < distance) segment++;
      const start = stroke[segment - 1], end = stroke[segment];
      const span = distances[segment] - distances[segment - 1];
      const ratio = span ? (distance - distances[segment - 1]) / span : 0;
      return [((start[0] + (end[0] - start[0]) * ratio) - midX) / size * 63, ((start[1] + (end[1] - start[1]) * ratio) - midY) / size * 63];
    });
  });
}

function decodeStroke(encoded: string, alphabet: string): number[][] {
  const points: number[][] = [];
  for (let i = 0; i < encoded.length; i += 2) points.push([alphabet.indexOf(encoded[i]) - 31.5, alphabet.indexOf(encoded[i + 1]) - 31.5]);
  return points;
}

function strokeDistance(input: number[][], template: number[][]): number {
  let distance = 0;
  for (let i = 0; i < SAMPLE_POINTS; i++) {
    const dx = input[i][0] - template[i][0], dy = input[i][1] - template[i][1];
    distance += dx * dx + dy * dy;
  }
  return Math.sqrt(distance / SAMPLE_POINTS);
}

function assignmentCost(input: number[][][], template: number[][][]): number {
  const rowCount = Math.min(input.length, template.length);
  const columnCount = Math.max(input.length, template.length);
  if (Math.abs(input.length - template.length) > 1) return Number.POSITIVE_INFINITY;
  const costs = Array.from({ length: rowCount }, (_, row) => Array.from({ length: columnCount }, (_, column) => {
    const inputStroke = input.length < template.length ? input[row] : input[column];
    const templateStroke = input.length < template.length ? template[column] : template[row];
    const forward = strokeDistance(inputStroke, templateStroke);
    const reverse = strokeDistance(inputStroke, [...templateStroke].reverse());
    return Math.min(forward, reverse);
  }));
  // Hungarian assignment supports unordered strokes in polynomial time, including dense kanji.
  const rowPotential = Array(rowCount + 1).fill(0), columnPotential = Array(columnCount + 1).fill(0);
  const matchedRow = Array(columnCount + 1).fill(0), previousColumn = Array(columnCount + 1).fill(0);
  for (let row = 1; row <= rowCount; row++) {
    matchedRow[0] = row;
    let column0 = 0;
    const minimum = Array(columnCount + 1).fill(Number.POSITIVE_INFINITY);
    const used = Array(columnCount + 1).fill(false);
    do {
      used[column0] = true;
      const row0 = matchedRow[column0];
      let delta = Number.POSITIVE_INFINITY, column1 = 0;
      for (let column = 1; column <= columnCount; column++) {
        if (used[column]) continue;
        const current = costs[row0 - 1][column - 1] - rowPotential[row0] - columnPotential[column];
        if (current < minimum[column]) { minimum[column] = current; previousColumn[column] = column0; }
        if (minimum[column] < delta) { delta = minimum[column]; column1 = column; }
      }
      for (let column = 0; column <= columnCount; column++) {
        if (used[column]) { rowPotential[matchedRow[column]] += delta; columnPotential[column] -= delta; }
        else minimum[column] -= delta;
      }
      column0 = column1;
    } while (matchedRow[column0] !== 0);
    do {
      const column1 = previousColumn[column0];
      matchedRow[column0] = matchedRow[column1];
      column0 = column1;
    } while (column0 !== 0);
  }
  return -columnPotential[0] / rowCount + 2.5 * Math.abs(input.length - template.length);
}

export function recognizeHandwriting(strokes: InkStroke[], index: HandwritingIndex): string[] {
  if (!index || index.version !== 1 || index.samplePoints !== SAMPLE_POINTS || !Array.isArray(index.templates)) return [];
  const input = normalizeStrokes(strokes);
  if (!input) return [];
  let byStrokeCount = decodedIndex.get(index);
  if (!byStrokeCount) {
    byStrokeCount = new Map();
    for (const [character, encoded] of index.templates) {
      const bucket = byStrokeCount.get(encoded.length) || [];
      bucket.push({ character, strokes: encoded.map((stroke) => decodeStroke(stroke, index.alphabet)) });
      byStrokeCount.set(encoded.length, bucket);
    }
    decodedIndex.set(index, byStrokeCount);
  }
  const candidates: { character: string; score: number }[] = [];
  for (const count of [input.length - 1, input.length, input.length + 1]) {
    for (const template of byStrokeCount.get(count) || []) {
      const score = assignmentCost(input, template.strokes);
      if (Number.isFinite(score)) candidates.push({ character: template.character, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score || a.character.localeCompare(b.character));
  // Normalized per-point RMS is bounded to 0..~89. Reject distant inputs and near-tied noisy matches.
  if (!candidates.length || candidates[0].score > 9) return [];
  const result: string[] = [];
  for (const candidate of candidates) {
    if (result.length >= 8) break;
    if (!result.includes(candidate.character)) result.push(candidate.character);
  }
  // Sparse high-stroke-count buckets can have fewer than six credible templates.
  return result;
}
