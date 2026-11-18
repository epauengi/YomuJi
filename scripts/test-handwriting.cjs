const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createJiti } = require('jiti');

const load = createJiti(__filename, { moduleCache: false });
const { buildLayout, DEFAULT_OPTIONS, parseCharacters } = load('../src/lib/handwriting.ts');

const parsed = parseCharacters(' か,が カ\u3099\nーゝゞヽヾ。か ');
assert.deepEqual(parsed.characters, ['か', 'が', 'ガ', 'ー', 'ゝ', 'ゞ', 'ヽ', 'ヾ']);
assert.deepEqual(parsed.unsupported, ['。']);
assert.equal(parsed.overflow, false);

const tooMany = parseCharacters(Array.from({ length: 101 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join(''));
assert.equal(tooMany.characters.length, 100);
assert.equal(tooMany.overflow, true);

for (const cellSize of [12, 15, 18]) {
  const layout = buildLayout({ ...DEFAULT_OPTIONS, cellSize });
  assert.equal(layout.width, 210);
  assert.equal(layout.height, 297);
  assert.equal(layout.margin, 12);
  assert.ok(layout.rowsPerPage > 0);
  assert.ok(layout.columns * cellSize + 2 * cellSize <= 186);
  assert.ok(layout.top + (layout.rowsPerPage - 1) * (layout.blockHeight + layout.gap) + layout.blockHeight <= 283);
}

console.log('handwriting assertions passed');

(async () => {
  const { PDFDocument } = require('pdf-lib');
  const fontkit = require('@pdf-lib/fontkit');
  const { createHandwritingPdf } = await load.import('../src/lib/handwritingPdf.ts');
  const japaneseInfo = fontkit.create(fs.readFileSync(require('node:path').join(__dirname, '..', 'public', 'handwriting', 'fonts', 'japanese.ttf')));
  let unsupportedHan;
  for (let cp = 0x20000; cp <= 0x323af && unsupportedHan === undefined; cp++) {
    if (!japaneseInfo.hasGlyphForCodePoint(cp)) unsupportedHan = String.fromCodePoint(cp);
  }
  assert.ok(unsupportedHan, 'Japanese font should have a Han character outside its coverage');
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    const relative = String(url).replace(/^\//, '').replaceAll('/', `${require('node:path').sep}`);
    try { return new Response(fs.readFileSync(require('node:path').join(__dirname, '..', 'public', relative))); }
    catch { return new Response(null, { status: 404 }); }
  };
  try {
    const glyph = { literal: 'あ', paths: [], viewBox: 109, fill: false, meaning: 'Âm tiếng Việt', hanViet: 'A', on: 'ア', kun: 'あ', source: 'font' };
    const bytes = await createHandwritingPdf([glyph], { ...DEFAULT_OPTIONS, title: '日本語 · Tiếng Việt' });
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.ok(Math.abs(pdf.getPage(0).getWidth() - 210 * 72 / 25.4) < 0.01);
    const { PDFName, PDFDict, PDFArray, PDFStream } = require('pdf-lib');
    const names = pdf.catalog.lookup(PDFName.of('Names'), PDFDict);
    const embeddedFiles = names.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
    assert.equal(embeddedFiles.lookup(PDFName.of('Names'), PDFArray).size(), 12);
    const japaneseFontStream = pdf.context.enumerateIndirectObjects().map(([, object]) => object)
      .filter((object) => object instanceof PDFDict && object.has(PDFName.of('FontFile2')))
      .map((descriptor) => pdf.context.lookup(descriptor.lookup(PDFName.of('FontFile2')), PDFStream))
      .find((stream) => stream.getContentsSize() > 1_000_000);
    assert.ok(japaneseFontStream, 'Japanese Klee font should be embedded in full, not subset');
    await assert.rejects(() => createHandwritingPdf([{ ...glyph, literal: unsupportedHan }], DEFAULT_OPTIONS), new RegExp(`Font tiếng Nhật không hỗ trợ các chữ: ${unsupportedHan}`));
    console.log('PDF generation assertions passed');
  } finally { global.fetch = realFetch; }
})().catch((error) => { console.error(error); process.exitCode = 1; });
