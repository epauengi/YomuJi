export type PaperStyle = 'squares' | 'cross' | 'rice' | 'ruled' | 'dots';

export type WorksheetOptions = {
  title: string;
  paperColor: string;
  inkColor: string;
  gridColor: string;
  style: PaperStyle;
  cellSize: 12 | 15 | 18;
  traceCells: number;
  showReadings: boolean;
};

export type Glyph = {
  literal: string;
  paths: string[];
  viewBox: number;
  fill: boolean;
  meaning: string;
  hanViet: string;
  on: string;
  kun: string;
  romaji?: string;
  source: 'kanjivg' | 'animcjk' | 'font';
};

export const DEFAULT_OPTIONS: WorksheetOptions = {
  title: 'Japanese handwriting practice',
  paperColor: '#ffffff',
  inkColor: '#26343a',
  gridColor: '#b9c6c4',
  style: 'squares',
  cellSize: 15,
  traceCells: 3,
  showReadings: true,
};

export function parseCharacters(text: string): { characters: string[]; unsupported: string[]; overflow: boolean } {
  const characters: string[] = [];
  const unsupported: string[] = [];
  const seen = new Set<string>();
  for (const char of text.normalize('NFC')) {
    if (/\s/u.test(char) || char === ',') continue;
    if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(char) || 'ーゝゞヽヾ'.includes(char)) {
      if (!seen.has(char)) {
        seen.add(char);
        characters.push(char);
      }
    } else if (!unsupported.includes(char)) unsupported.push(char);
  }
  return { characters: characters.slice(0, 100), unsupported, overflow: characters.length > 100 };
}

export function parseGlyphSvg(svg: string, literal: string): Pick<Glyph, 'paths' | 'viewBox' | 'fill'> {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error(`Invalid stroke SVG for ${literal}`);
  const root = doc.documentElement;
  if (root.localName !== 'svg') throw new Error(`Missing SVG root for ${literal}`);
  const values = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((n) => !Number.isFinite(n)) || values[2] <= 0 || values[3] <= 0 || values[2] !== values[3]) {
    throw new Error(`Unsupported SVG viewBox for ${literal}`);
  }
  const animCjk = values[2] >= 900 || svg.includes('acjk');
  const candidates = animCjk
    ? [...doc.querySelectorAll('path[id]')].filter((p) => /d\d+$/i.test(p.id))
    : [...doc.querySelectorAll('g[id*="StrokePaths"] path, path[id*="kvg:"]')];
  const paths = candidates.map((p) => p.getAttribute('d') || '').filter((d) => d.trim() && /^[\w\s.,+\-()]+$/.test(d));
  if (!paths.length) throw new Error(`No stroke paths for ${literal}`);
  return { paths, viewBox: values[2], fill: animCjk };
}

export function buildLayout(options: WorksheetOptions) {
  const width = 210;
  const height = 297;
  const margin = 12;
  const top = 28;
  const headerHeight = 13;
  const cellSize = [12, 15, 18].includes(options.cellSize) ? options.cellSize : 15;
  const columns = Math.floor((width - 2 * margin - 2 * cellSize) / cellSize);
  const blockHeight = headerHeight + 2 * cellSize;
  const gap = 5;
  const rowsPerPage = Math.max(1, Math.floor((283 - top - blockHeight) / (blockHeight + gap)) + 1);
  return { width, height, margin, top, headerHeight, cellSize, columns, blockHeight, gap, rowsPerPage };
}
