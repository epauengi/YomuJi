import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Glyph, WorksheetOptions } from './handwriting';
import { buildLayout } from './handwriting';

const mm = (value: number) => value * 72 / 25.4;
const safeText = (value: string, max: number) => [...value.replace(/[\r\n\t]+/g, ' ').trim()].slice(0, max).join('');
type FontInfo = ReturnType<typeof fontkit.create>;
type FontRun = { character: string; font: PDFFont; width: number };

function color(hex: string) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Màu giấy hoặc mực không hợp lệ: ${hex}`);
  return rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
}

async function fetchAsset(path: string, name: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Không tải được ${name} (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

function fontRuns(content: string, japanese: PDFFont, latin: PDFFont, japaneseInfo: FontInfo, latinInfo: FontInfo, size: number, readings?: { font: PDFFont; info: FontInfo }): FontRun[] {
  const missingJapanese = new Set<string>();
  const missingOther = new Set<string>();
  const runs = [...content.normalize('NFC')].map((character): FontRun => {
    const codePoint = character.codePointAt(0)!;
    const isJapanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character);
    const fontInfo = readings?.info.hasGlyphForCodePoint(codePoint) ? readings.info : isJapanese ? japaneseInfo : latinInfo;
    if (fontInfo.hasGlyphForCodePoint(codePoint)) {
      const font = fontInfo === readings?.info ? readings.font : isJapanese ? japanese : latin;
      return { character, font, width: font.widthOfTextAtSize(character, size) };
    }
    const fallbackInfo = isJapanese ? latinInfo : japaneseInfo;
    const fallbackFont = isJapanese ? latin : japanese;
    if (fallbackInfo.hasGlyphForCodePoint(codePoint)) return { character, font: fallbackFont, width: fallbackFont.widthOfTextAtSize(character, size) };
    (isJapanese ? missingJapanese : missingOther).add(character);
    return { character, font: isJapanese ? japanese : latin, width: 0 };
  });
  if (missingJapanese.size) throw new Error(`Font tiếng Nhật không hỗ trợ các chữ: ${[...missingJapanese].join('、')}`);
  if (missingOther.size) throw new Error(`Font không hỗ trợ các ký tự: ${[...missingOther].join('、')}`);
  return runs;
}

function drawText(page: PDFPage, content: string, x: number, top: number, size: number, fill: ReturnType<typeof rgb>, maxWidth: number, maxLines: number, japanese: PDFFont, latin: PDFFont, japaneseInfo: FontInfo, latinInfo: FontInfo, opacity = 1, align: 'left' | 'center' | 'right' = 'left', bold = false, readings?: { font: PDFFont; info: FontInfo }) {
  const value = safeText(content, 240);
  if (!value) return;
  const runs = fontRuns(value, japanese, latin, japaneseInfo, latinInfo, size, readings);
  const lines: FontRun[][] = [[]];
  const widthLimit = maxWidth > 0 ? mm(maxWidth) : Infinity;
  let lineWidth = 0;
  let truncated = false;
  for (const run of runs) {
    if (lineWidth + run.width > widthLimit && lines.at(-1)!.length) {
      if (lines.length === maxLines) { truncated = true; break; }
      lines.push([]);
      lineWidth = 0;
    }
    lines.at(-1)!.push(run);
    lineWidth += run.width;
  }
  if (truncated) {
    const lastLine = lines.at(-1)!;
    const font = lastLine.at(-1)?.font ?? latin;
    const ellipsisWidth = font.widthOfTextAtSize('…', size);
    while (lastLine.length && lastLine.reduce((sum, run) => sum + run.width, 0) + ellipsisWidth > widthLimit) lastLine.pop();
    lastLine.push({ character: '…', font, width: ellipsisWidth });
  }
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const baseline = mm(297 - top) - size * 0.8 - lineIndex * size;
    const currentLineWidth = lines[lineIndex].reduce((sum, run) => sum + run.width, 0);
    const offset = align === 'center' ? -currentLineWidth / 2 + (maxWidth > 0 ? widthLimit / 2 : 0) : align === 'right' ? -currentLineWidth : 0;
    let cursor = mm(x) + offset;
    for (let i = 0; i < lines[lineIndex].length;) {
      const font = lines[lineIndex][i].font;
      let end = i;
      let text = '';
      let runWidth = 0;
      while (end < lines[lineIndex].length && lines[lineIndex][end].font === font) {
        text += lines[lineIndex][end].character;
        runWidth += lines[lineIndex][end].width;
        end++;
      }
      page.drawText(text, { x: cursor, y: baseline, size, font, color: fill, opacity });
      if (bold) page.drawText(text, { x: cursor + 0.35, y: baseline, size, font, color: fill, opacity });
      cursor += runWidth;
      i = end;
    }
  }
}

function drawReadingLine(page: PDFPage, value: string, x: number, y: number, size: number, ink: ReturnType<typeof rgb>, japanese: PDFFont, latin: PDFFont, japaneseInfo: FontInfo, latinInfo: FontInfo, readingsFont: PDFFont, readingsInfo: FontInfo, label: 'On' | 'Kun') {
  const labelWidth = readingsFont.widthOfTextAtSize(`${label}:`, size);
  drawText(page, `${label}:`, x, y, size, ink, 0, 1, japanese, latin, japaneseInfo, latinInfo, 1, 'left', true, { font: readingsFont, info: readingsInfo });
  drawText(page, value.slice(label.length + 1), x + labelWidth * 25.4 / 72 + 1, y, size, ink, 0, 1, japanese, latin, japaneseInfo, latinInfo, 1, 'left', false, { font: readingsFont, info: readingsInfo });
}

function drawGlyph(page: PDFPage, glyph: Glyph, x: number, y: number, size: number, font: PDFFont, ink: ReturnType<typeof rgb>, opacity = 1) {
  if (glyph.paths.length) {
    const scale = mm(size * 0.85 / glyph.viewBox);
    const originX = mm(x + size * 0.075);
    const originY = mm(297 - y - size * 0.075);
    for (const path of glyph.paths) {
      if (glyph.fill) page.drawSvgPath(path, { x: originX, y: originY, scale, color: ink, opacity });
      else page.drawSvgPath(path, { x: originX, y: originY, scale, borderColor: ink, borderWidth: 3, borderOpacity: opacity, borderLineCap: 1 });
    }
  } else {
    page.drawText(glyph.literal, { x: mm(x + size * 0.1), y: mm(297 - y - size * 0.82), size: mm(size * 0.7), font, color: ink, opacity });
  }
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, ink: ReturnType<typeof rgb>, thickness = 0.55, opacity = 1, dashArray?: number[]) {
  page.drawLine({ start: { x: mm(x1), y: mm(297 - y1) }, end: { x: mm(x2), y: mm(297 - y2) }, color: ink, thickness, opacity, dashArray });
}

function drawGuide(page: PDFPage, x: number, y: number, size: number, style: WorksheetOptions['style'], ink: ReturnType<typeof rgb>) {
  const middle = size / 2;
  if (style === 'cross' || style === 'rice') {
    line(page, x + middle, y, x + middle, y + size, ink, 0.35, 0.65, [2, 2]);
    line(page, x, y + middle, x + size, y + middle, ink, 0.35, 0.65, [2, 2]);
  }
  if (style === 'rice') {
    line(page, x, y, x + size, y + size, ink, 0.35, 0.65, [2, 2]);
    line(page, x + size, y, x, y + size, ink, 0.35, 0.65, [2, 2]);
  } else if (style === 'ruled') line(page, x, y + middle, x + size, y + middle, ink, 0.35, 0.65, [2, 2]);
  else if (style === 'dots') page.drawCircle({ x: mm(x + middle), y: mm(297 - y - middle), size: 0.8, color: ink, opacity: 0.65 });
}

export async function createHandwritingPdf(glyphs: Glyph[], options: WorksheetOptions): Promise<Uint8Array> {
  if (!glyphs.length) throw new Error('Hãy chọn ít nhất một chữ trước khi xuất PDF.');
  if (glyphs.length > 100) throw new Error('Mỗi file chỉ hỗ trợ tối đa 100 chữ.');
  if (![12, 15, 18].includes(options.cellSize)) throw new Error('Cỡ ô viết không hợp lệ.');
  if (!['squares', 'cross', 'rice', 'ruled', 'dots'].includes(options.style)) throw new Error('Kiểu giấy không hợp lệ.');
  if (!Number.isInteger(options.traceCells) || options.traceCells < 0) throw new Error('Số ô tô mờ không hợp lệ.');
  const layout = buildLayout(options);
  const paper = color(options.paperColor);
  const ink = color(options.inkColor);
  const grid = color(options.gridColor);
  const [japaneseBytes, latinBytes, readingsBytes] = await Promise.all([
    fetchAsset('/handwriting/fonts/japanese.ttf', 'font tiếng Nhật'),
    fetchAsset('/handwriting/fonts/latin.ttf', 'font Latin'),
    fetchAsset('/handwriting/fonts/biz-udpgothic.ttf', 'font cách đọc'),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const japaneseFontInfo = fontkit.create(japaneseBytes);
  const latinFontInfo = fontkit.create(latinBytes);
  const readingsFontInfo = fontkit.create(readingsBytes);
  const missing = [...new Set(glyphs.filter((glyph) => !glyph.paths.length && [...glyph.literal].some((char) => !japaneseFontInfo.hasGlyphForCodePoint(char.codePointAt(0)!))).map((glyph) => glyph.literal))];
  if (missing.length) throw new Error(`Font tiếng Nhật không hỗ trợ các chữ: ${missing.join('、')}`);
  // ponytail: Klee's composite glyph subsets lose Japanese text in PDF renderers; keep the full ~5 MB font until fontkit subsets composite glyphs correctly.
  const japaneseFont = await doc.embedFont(japaneseBytes, { subset: false });
  const latinFont = await doc.embedFont(latinBytes, { subset: true });
  const readingsFont = await doc.embedFont(readingsBytes, { subset: true });
  const columns = layout.columns;
  const gridX = layout.margin + 2 * layout.cellSize;
  const gridWidth = columns * layout.cellSize;
  const pageCount = Math.ceil(glyphs.length / layout.rowsPerPage);
  const pages: PDFPage[] = Array.from({ length: pageCount }, () => doc.addPage([mm(layout.width), mm(layout.height)]));

  for (const [pageIndex, page] of pages.entries()) {
    page.drawRectangle({ x: 0, y: 0, width: mm(layout.width), height: mm(layout.height), color: paper });
    drawText(page, 'YomuJi', 105, 15, 12, ink, 0, 1, japaneseFont, latinFont, japaneseFontInfo, latinFontInfo, 1, 'center', true);
    drawText(page, options.title.slice(0, 60) || 'Giấy luyện viết', 105, 21, 7, ink, 0, 1, japaneseFont, latinFont, japaneseFontInfo, latinFontInfo, 0.8, 'center');
    drawText(page, `${pageIndex + 1} / ${pageCount}`, 180, 21, 7, ink, 18, 1, japaneseFont, latinFont, japaneseFontInfo, latinFontInfo);
    for (let row = 0; row < layout.rowsPerPage; row++) {
      const glyphIndex = pageIndex * layout.rowsPerPage + row;
      if (glyphIndex >= glyphs.length) break;
      const glyph = glyphs[glyphIndex];
      const y = layout.top + row * (layout.blockHeight + layout.gap);
      const body = y + layout.headerHeight;
      if (options.showReadings) {
        drawText(page, glyph.hanViet, layout.margin + 2.5, y + 3, 7.5, ink, layout.width - layout.margin * 2 - 5, 1, japaneseFont, readingsFont, japaneseFontInfo, readingsFontInfo, 1, 'left', true, { font: readingsFont, info: readingsFontInfo });
        drawReadingLine(page, `On: ${glyph.on}`, layout.margin + 2.5, y + 7, 7.5, ink, japaneseFont, latinFont, japaneseFontInfo, latinFontInfo, readingsFont, readingsFontInfo, 'On');
        drawReadingLine(page, `Kun: ${glyph.kun}`, layout.margin + 2.5, y + 11, 7.5, ink, japaneseFont, latinFont, japaneseFontInfo, latinFontInfo, readingsFont, readingsFontInfo, 'Kun');
      }
      const gridTop = mm(297 - body - 2 * layout.cellSize);
      page.drawRectangle({ x: mm(layout.margin), y: gridTop, width: mm(2 * layout.cellSize + gridWidth), height: mm(layout.blockHeight), borderColor: grid, borderWidth: 0.6 });
      line(page, layout.margin, body, layout.margin + 2 * layout.cellSize + gridWidth, body, grid);
      line(page, layout.margin + 2 * layout.cellSize, body, layout.margin + 2 * layout.cellSize, body + 2 * layout.cellSize, grid);
      for (let c = 1; c < columns; c++) if (options.style !== 'ruled') line(page, gridX + c * layout.cellSize, body, gridX + c * layout.cellSize, body + 2 * layout.cellSize, grid);
      line(page, gridX, body + layout.cellSize, gridX + gridWidth, body + layout.cellSize, grid);
      drawGlyph(page, glyph, layout.margin, body, 2 * layout.cellSize, japaneseFont, ink);
      for (let cell = 0; cell < columns * 2; cell++) {
        const x = gridX + (cell % columns) * layout.cellSize;
        const cellY = body + Math.floor(cell / columns) * layout.cellSize;
        drawGuide(page, x, cellY, layout.cellSize, options.style, grid);
        if (cell < Math.min(Math.floor(options.traceCells), columns * 2)) drawGlyph(page, glyph, x, cellY, layout.cellSize, japaneseFont, ink, 0.2);
      }
    }
    const licenseUrl = typeof window === 'undefined' ? 'https://creativecommons.org/licenses/by-sa/3.0/ · https://github.com/parsimonhi/animCJK' : `${window.location.origin}/handwriting/licenses`;
    drawText(page, `KanjiVG CC BY-SA 3.0 · AnimCJK · Sources & notices: ${licenseUrl}`, 12, 289, 5.3, ink, 186, 1, japaneseFont, latinFont, japaneseFontInfo, latinFontInfo);
  }

  const attribution = [
    'YomuJi Japanese handwriting worksheet — source and license notices',
    '',
    'KanjiVG © Ulrich Apel, CC BY-SA 3.0: https://kanjivg.tagaini.net/ · https://creativecommons.org/licenses/by-sa/3.0/',
    glyphs.some((glyph) => glyph.source === 'kanjivg') ? 'KanjiVG paths were extracted, recolored, resized, and repeated as static handwriting guides; adaptations are shared under CC BY-SA 3.0.' : '',
    '',
    glyphs.some((glyph) => glyph.source === 'animcjk') ? 'AnimCJK ©2016-2025 FM-SH: https://github.com/parsimonhi/animCJK · Static paths only; resized, recolored, and repeated (modifications dated 2026-11-18). Kanji assets may derive from MakeMeAHanzi and Arphic PL KaitiM GB / PL UKai fonts. See AnimCJK notices: https://github.com/parsimonhi/animCJK/blob/master/licenses/COPYING.txt · Arphic Public License: https://github.com/parsimonhi/animCJK/tree/master/licenses/APL' : '',
    '',
    'Embedded fonts: Klee One by Fontworks, BIZ UDPGothic by BIZ UDGothic Project, Noto Sans by Google; SIL Open Font License 1.1. Full notices attached.',
    'Meanings and readings may include KANJIDIC2 data © James William Breen and EDRDG, CC BY-SA 4.0: https://www.edrdg.org/wiki/KANJIDIC_Project.html · https://www.edrdg.org/edrdg/licence.html · Vietnamese meanings retain their existing source and licensing status.',
    `Project notices: ${typeof window === 'undefined' ? 'https://creativecommons.org/licenses/by-sa/3.0/' : `${window.location.origin}/handwriting/licenses`}`,
  ].filter(Boolean).join('\n');
  const licenseFiles = ['KanjiVG-COPYING.txt', 'Klee-OFL.txt', 'NotoSans-OFL.txt', 'BIZ-UDPGothic-OFL.txt', 'Arphic-Public-License.txt'];
  const licenseBytes = await Promise.all(licenseFiles.map(async (name) => [name, await fetchAsset(`/handwriting/licenses/${name}`, `thông báo giấy phép ${name}`)] as const));
  for (const [name, bytes] of licenseBytes) await doc.attach(bytes, name);
  await doc.attach(new TextEncoder().encode(attribution), 'YomuJi-source-notices.txt', { mimeType: 'text/plain' });
  doc.setTitle(safeText(options.title, 100) || 'Japanese handwriting practice');
  doc.setSubject(`Japanese handwriting worksheet · ${glyphs.length} characters · sources: https://github.com/KanjiVG/kanjivg, https://github.com/parsimonhi/animCJK · fonts: https://github.com/fontworks-fonts/Klee, https://github.com/notofonts/noto-fonts`);
  return doc.save();
}
