const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (mod, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  mod._compile(out.outputText, filename);
};

const root = path.join(__dirname, '..');
const { DEFAULT_OPTIONS, READING_METRICS, buildLayout, contrastRatio, getContrastWarnings } = require('../src/lib/handwriting.ts');
const { createHandwritingPdf } = require('../src/lib/handwritingPdf.ts');
const { PDFDocument, PDFArray, PDFName, PDFDict, decodePDFRawStream } = require('pdf-lib');

// 1. Verify default dark ink contrast and custom low-contrast warnings
const defaultRatio = contrastRatio(DEFAULT_OPTIONS.inkColor, DEFAULT_OPTIONS.paperColor);
assert.ok(defaultRatio > 12, `Expected default ink contrast > 12:1, got ${defaultRatio.toFixed(2)}`);
for (const paperColor of ['#ffffff', '#fffaf0', '#eef5ed', '#edf4fa', '#fcf0f2']) {
  assert.ok(contrastRatio(DEFAULT_OPTIONS.inkColor, paperColor) >= 11, `Default ink on ${paperColor} must stay >= 11:1`);
  assert.equal(getContrastWarnings({ ...DEFAULT_OPTIONS, paperColor }).ink, false);
}
const lowInk = getContrastWarnings({ inkColor: '#9aa5aa', paperColor: '#ffffff', gridColor: '#f2f5f6' });
assert.equal(lowInk.ink, true);
assert.equal(lowInk.grid, true);
const veryLowInk = getContrastWarnings({ inkColor: '#d0d6d8', paperColor: '#ffffff', gridColor: '#f2f5f6' });
assert.equal(veryLowInk.ink, true);
assert.equal(veryLowInk.trace, true);

// 2. Verify PDF generation with Vietnamese Han Viet diacritics, metrics alignment, opacity, and truncation
(async () => {
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    const rel = String(url).replace(/^\//, '').replaceAll('/', path.sep);
    try {
      return new Response(fs.readFileSync(path.join(root, 'public', rel)));
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  try {
    const layout = buildLayout(DEFAULT_OPTIONS);
    const glyph = {
      literal: '日',
      paths: [],
      viewBox: 109,
      fill: false,
      meaning: 'ngày; mặt trời',
      hanViet: 'NHẬT、NGUYỆT、VIỆT、ĐẠI、TRƯỜNG',
      on: 'ニチ、ジツ、ニ、カ、ゲツ、ガツ、エツ、ダイ、タイ、チョウ',
      kun: 'ひ、-び、-か、つき、こえ、なが-い、おさ、はるか、ひろ-い、あきら-か',
      source: 'font',
    };
    const bytes = await createHandwritingPdf([glyph], { ...DEFAULT_OPTIONS, title: 'Giấy luyện viết tiếng Nhật' });
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    const page = pdf.getPage(0);
    const resources = page.node.Resources();
    const extGState = resources.lookup(PDFName.of('ExtGState'), PDFDict);
    const gsAlpha = new Map();
    for (const [k, v] of extGState.entries()) {
      const dict = pdf.context.lookup(v, PDFDict);
      gsAlpha.set(k.asString().slice(1), dict.get(PDFName.of('ca'))?.asNumber?.() ?? 1);
    }

    const contents = page.node.Contents();
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    const streamText = refs
      .map((r) => Buffer.from(decodePDFRawStream(pdf.context.lookup(r)).decode()).toString('latin1'))
      .join('\n');

    const textOps = [...streamText.matchAll(/\/(GS-\d+) gs[\s\S]*?\/([^\s]+) ([\d.]+) Tf[\s\S]*?1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)].map((m) => ({
      alpha: gsAlpha.get(m[1]) ?? 1,
      font: m[2],
      sizePt: Number(m[3]),
      xPt: Number(m[4]),
      yPt: Number(m[5]),
    }));

    const ptToMm = 25.4 / 72;
    const hanVietSizePt = READING_METRICS.hanVietSizeMm / ptToMm;
    const readingSizePt = READING_METRICS.readingSizeMm / ptToMm;
    const readingTexts = textOps.filter((op) => Math.abs(op.sizePt - hanVietSizePt) < 0.05 || Math.abs(op.sizePt - readingSizePt) < 0.05);
    assert.ok(readingTexts.length >= 5, 'Expected Han Viet + On/Kun label & value text ops');

    const dividerY = layout.top + layout.headerHeight;
    for (const op of readingTexts) {
      assert.equal(op.alpha, 1, 'Readings in PDF must use full ink opacity (1), not tracing opacity');
      const baselineFromTopMm = 297 - op.yPt * ptToMm;
      assert.ok(baselineFromTopMm > layout.top + 2 && baselineFromTopMm < dividerY - 1, `Reading baseline ${baselineFromTopMm.toFixed(2)}mm out of header bounds [${layout.top}, ${dividerY}]`);
      assert.ok(op.xPt * ptToMm < layout.margin + (layout.columns + 2) * layout.cellSize, 'Reading x must stay inside box');
    }

    const traceOps = textOps.filter((op) => Math.abs(op.alpha - 0.2) < 0.01);
    assert.equal(traceOps.length, DEFAULT_OPTIONS.traceCells, 'Tracing cells should keep 0.2 opacity');

    // 3. Verify CSS mobile touch targets >= 44px
    const css = fs.readFileSync(path.join(root, 'src', 'app', 'handwriting', 'handwriting.css'), 'utf8');
    assert.match(css, /\.hw-back\{[^}]*min-height:44px/);
    assert.match(css, /\.hw-back\{[^}]*min-width:44px/);
    const mobileCss = css.split(/\r?\n/).find((line) => line.startsWith('@media(max-width:767px)'));
    assert.ok(mobileCss);
    assert.match(mobileCss, /\.hw-swatches button\{min-width:44px\}/);
    assert.match(mobileCss, /\.hw-pagination button\{height:44px;width:44px\}/);
    assert.match(mobileCss, /\.hw-controls input\[type=range\]\{min-height:44px\}/);
    assert.match(css, /\.hw-checkbox\{[^}]*min-height:44px/);

    console.log('check-handwriting-readings passed');
  } finally {
    global.fetch = realFetch;
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
