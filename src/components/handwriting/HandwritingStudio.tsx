'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, DownloadSimple, SpinnerGap, Printer } from '@phosphor-icons/react';
import { DEFAULT_OPTIONS, buildLayout, parseCharacters, parseGlyphSvg, type Glyph, type PaperStyle, type WorksheetOptions } from '@/lib/handwriting';

const HIRAGANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const ROMAJI = 'a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho ma mi mu me mo ya yu yo ra ri ru re ro wa wo n'.split(' ');
const READINGS = Object.fromEntries([...HIRAGANA].map((c, i) => [c, ROMAJI[i]]));
Object.assign(READINGS, Object.fromEntries([...'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゔぁぃぅぇぉゃゅょっゎゐゑ'].map((c, i) => [c, 'ga gi gu ge go za ji zu ze zo da ji zu de do ba bi bu be bo pa pi pu pe po vu a i u e o ya yu yo tsu wa wi we'.split(' ')[i]])));
const PAPERS = [{ name: 'Trắng', color: '#ffffff' }, { name: 'Ngà', color: '#fffaf0' }, { name: 'Lục nhạt', color: '#eef5ed' }, { name: 'Lam nhạt', color: '#edf4fa' }, { name: 'Hồng nhạt', color: '#fcf0f2' }];
const STYLES: { value: PaperStyle; label: string; description: string }[] = [
  { value: 'cross', label: 'Ô chữ thập', description: 'Chia tư ô, dễ căn chữ' },
  { value: 'squares', label: 'Ô vuông', description: 'Thoáng, ít đường dẫn' },
  { value: 'rice', label: 'Ô chữ mễ', description: 'Thêm đường chéo căn nét' },
  { value: 'ruled', label: 'Kẻ ngang', description: 'Luyện độ cao chữ' },
  { value: 'dots', label: 'Chấm điểm', description: 'Dẫn nhẹ bằng chấm' },
];
const PRESETS = [{ label: 'Kanji cơ bản', text: '一七万三上下大小日月山川田人木本水火土金' }, { label: 'Hiragana', text: HIRAGANA }, { label: 'Katakana', text: KATAKANA }];

async function loadGlyph(literal: string, signal: AbortSignal): Promise<Glyph> {
  const kana = /[\u3040-\u30ff]/u.test(literal);
  const hex = literal.codePointAt(0)!.toString(16).padStart(5, '0');
  const svgRequest = fetch(kana ? `/handwriting/kana/${hex}.svg` : `/dict/strokes/${hex}.svg`, { signal });
  const dataRequest = kana ? Promise.resolve(null) : fetch(`/api/kanji/${encodeURIComponent(literal)}`, { signal }).then(async r => {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Không tải được thông tin chữ ${literal}. Vui lòng thử lại.`);
    return (await r.json()).kanji;
  });
  const [svgResponse, data] = await Promise.all([svgRequest, dataRequest]);
  let shape = { paths: [] as string[], viewBox: 109, fill: false };
  let source: Glyph['source'] = 'font';
  if (svgResponse.ok) {
    const svg = await svgResponse.text();
    shape = parseGlyphSvg(svg, literal);
    source = shape.fill ? 'animcjk' : 'kanjivg';
  } else if (svgResponse.status !== 404) {
    throw new Error(`Không tải được mẫu chữ ${literal}. Vui lòng thử lại.`);
  }
  return { literal, ...shape, source, hanViet: data?.hanViet?.join('、').toLocaleUpperCase('vi') || '', meaning: data?.meanings?.slice(0, 2).join('; ') || '', on: data?.onReadings?.join('、') || '', kun: data?.kunReadings?.join('、') || '', romaji: READINGS[literal.replace(/[\u30a1-\u30f6]/gu, c => String.fromCodePoint(c.codePointAt(0)! - 0x60))] || '' };
}

function GlyphShape({ glyph, x, y, size, color, opacity = 1 }: { glyph: Glyph; x: number; y: number; size: number; color: string; opacity?: number }) {
  if (!glyph.paths.length) return <text x={x + size / 2} y={y + size * .79} textAnchor="middle" fill={color} opacity={opacity} fontFamily="Worksheet Japanese" fontSize={size * .83}>{glyph.literal}</text>;
  return <g transform={`translate(${x + size * .075} ${y + size * .075}) scale(${size * .85 / glyph.viewBox})`} opacity={opacity} fill={glyph.fill ? color : 'none'} stroke={glyph.fill ? 'none' : color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">{glyph.paths.map((d, i) => <path key={i} d={d} />)}</g>;
}

function Guide({ x, y, size, style, color }: { x: number; y: number; size: number; style: PaperStyle; color: string }) {
  const middle = size / 2;
  return <g stroke={color} strokeWidth=".16" opacity=".65" fill="none">
    {style === 'cross' || style === 'rice' ? <path d={`M${x + middle} ${y}v${size}M${x} ${y + middle}h${size}`} strokeDasharray=".8 .8" /> : null}
    {style === 'rice' ? <path d={`M${x} ${y}l${size} ${size}M${x + size} ${y}l${-size} ${size}`} strokeDasharray=".8 .8" /> : null}
    {style === 'dots' ? <circle cx={x + middle} cy={y + middle} r=".35" fill={color} stroke="none" /> : null}
    {style === 'ruled' ? <path d={`M${x} ${y + middle}h${size}`} strokeDasharray=".8 .8" /> : null}
  </g>;
}

function SheetPreview({ glyphs, options, page, pages }: { glyphs: Glyph[]; options: WorksheetOptions; page: number; pages: number }) {
  const layout = buildLayout(options);
  const { margin, top, cellSize: s, columns, headerHeight, blockHeight, gap, rowsPerPage } = layout;
  const width = (columns + 2) * s;
  return <svg className="hw-sheet" viewBox="0 0 210 297" role="img" aria-label={`Bản xem trước giấy luyện viết, trang ${page + 1} trên ${pages}`} lang="ja">
    <rect width="210" height="297" fill={options.paperColor} />
    <g fill={options.inkColor} fontFamily="Worksheet Latin, sans-serif">
      <text x="105" y="15" textAnchor="middle" fontSize="5.2" fontWeight="700">YomuJi</text>
      <text x="105" y="20" textAnchor="middle" fontSize="2.8" opacity=".8">{options.title.slice(0, 60) || 'Giấy luyện viết'}</text>
      <text x="198" y="20" textAnchor="end" fontSize="2.3">{page + 1} / {pages}</text>
    </g>
    {glyphs.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((glyph, index) => {
      const y = top + index * (blockHeight + gap);
      const body = y + headerHeight;
      return <g key={glyph.literal}>
        {options.showReadings ? <g className="hw-readings" fill={options.inkColor} fontFamily="Worksheet Readings, Worksheet Latin, Worksheet Japanese, sans-serif" fontSize="2.7"><text x={margin + 2.5} y={y + 3} fontWeight="700">{glyph.hanViet}</text><text x={margin + 2.5} y={y + 7}><tspan fontWeight="700">On:</tspan> {glyph.on}</text><text x={margin + 2.5} y={y + 11}><tspan fontWeight="700">Kun:</tspan> {glyph.kun}</text></g> : null}
        <g stroke={options.gridColor} strokeWidth=".23" fill="none">
          <rect x={margin} y={y} width={width} height={blockHeight} />
          <path d={`M${margin} ${body}h${width}M${margin + 2 * s} ${body}v${2 * s}`} />
          {options.style !== 'ruled' ? Array.from({ length: columns - 1 }, (_, c) => <path key={c} d={`M${margin + (3 + c) * s} ${body}v${2 * s}`} />) : null}
          <path d={`M${margin + 2 * s} ${body + s}h${columns * s}`} />
        </g>
        <GlyphShape glyph={glyph} x={margin} y={body} size={2 * s} color={options.inkColor} />
        {Array.from({ length: columns * 2 }, (_, c) => {
          const x = margin + (2 + c % columns) * s;
          const cy = body + Math.floor(c / columns) * s;
          return <g key={c}><Guide x={x} y={cy} size={s} style={options.style} color={options.gridColor} />{c < options.traceCells ? <GlyphShape glyph={glyph} x={x} y={cy} size={s} color={options.inkColor} opacity={.19} /> : null}</g>;
        })}
      </g>;
    })}
  </svg>;
}

export default function HandwritingStudio() {
  const [text, setText] = useState('一七万三上あいうえお');
  const [options, setOptions] = useState<WorksheetOptions>({ ...DEFAULT_OPTIONS, title: 'Giấy luyện viết tiếng Nhật' });
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [reload, setReload] = useState(0);
  const cache = useRef(new Map<string, Glyph>());
  const parsed = useMemo(() => parseCharacters(text), [text]);
  const key = parsed.characters.join('');
  const layout = buildLayout(options);
  const pages = Math.max(1, Math.ceil(glyphs.length / layout.rowsPerPage));
  const currentPage = Math.min(page, pages - 1);
  const fallback = glyphs.filter(g => g.source === 'font').map(g => g.literal);
  const contrastWarnings = (() => {
    const luminance = (hex: string) => {
      const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const a = luminance(options.inkColor), b = luminance(options.paperColor);
    const contrast = (a: number, b: number) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const trace = options.inkColor.replace(/[0-9a-f]{2}/gi, (channel, offset) => {
      const background = parseInt(options.paperColor.slice(offset, offset + 2), 16);
      return Math.round(parseInt(channel, 16) * .19 + background * .81).toString(16).padStart(2, '0');
    });
    return { ink: contrast(a, b) < 4.5, trace: contrast(luminance(trace), b) < 1.12, grid: contrast(luminance(options.gridColor), b) < 1.15 };
  })();

  useEffect(() => {
    const controller = new AbortController();
    setDownloaded(false);
    setPage(0);
    setError('');
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result: Glyph[] = [];
        // ponytail: six simultaneous local requests; use a batch endpoint only if export limits grow.
        const chars = [...key];
        for (let i = 0; i < chars.length; i += 6) {
          result.push(...await Promise.all(chars.slice(i, i + 6).map(async literal => {
            const saved = cache.current.get(literal);
            if (saved) return saved;
            const glyph = await loadGlyph(literal, controller.signal);
            cache.current.set(literal, glyph);
            return glyph;
          })));
        }
        if (!controller.signal.aborted) { setGlyphs(result); setLoadedKey(key); }
      } catch (e) {
        if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Không tải được mẫu chữ. Thử lại bằng cách chọn lại bộ chữ.'); setGlyphs([]); setLoadedKey(key); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, reload]);

  function change<K extends keyof WorksheetOptions>(name: K, value: WorksheetOptions[K]) {
    setOptions(previous => {
      const updated = { ...previous, [name]: value };
      updated.traceCells = Math.min(updated.traceCells, buildLayout(updated).columns * 2);
      return updated;
    });
    setDownloaded(false);
  }

  async function download() {
    if (loading || loadedKey !== key || !glyphs.length || parsed.overflow || parsed.unsupported.length) return;
    setExporting(true);
    setError('');
    setDownloaded(false);
    try {
      const { createHandwritingPdf } = await import('@/lib/handwritingPdf');
      const bytes = await createHandwritingPdf(glyphs, options);
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'yomuji-giay-luyen-viet.pdf';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được PDF. Vui lòng thử lại.');
    } finally { setExporting(false); }
  }

  const exportDisabled = loading || loadedKey !== key || exporting || !glyphs.length || parsed.overflow || parsed.unsupported.length > 0;

  return <main className="hw-studio">
    <header className="hw-heading"><div><Link href="/practice" className="hw-back"><ArrowLeft size={15} aria-hidden="true" /> Luyện tập</Link><h1>Giấy luyện viết</h1></div></header>
    <div className="hw-mobile-actions">
      <button type="button" className="hw-mobile-preview" onClick={() => document.getElementById('handwriting-preview')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })}><Printer size={17} aria-hidden="true" />Xem trước A4</button>
      <button type="button" className="hw-download" onClick={download} disabled={exportDisabled}>{exporting ? <SpinnerGap size={19} className="hw-spin" aria-hidden="true" /> : <DownloadSimple size={19} aria-hidden="true" />}{exporting ? 'Đang tạo PDF…' : 'Tải PDF A4'}</button>
    </div>
    <div className="hw-layout">
      <section className="hw-controls" aria-label="Thiết lập giấy luyện viết">
        <fieldset><legend>Chữ muốn luyện</legend><div className="hw-presets">{PRESETS.map(p => <button key={p.label} type="button" aria-pressed={text === p.text} onClick={() => setText(p.text)}>{p.label}</button>)}</div><label htmlFor="hw-characters" className="hw-label">Kanji, Hiragana hoặc Katakana</label><textarea id="hw-characters" value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={3} lang="ja" spellCheck={false} aria-describedby="hw-character-help" />{parsed.overflow ? <p className="hw-warning" role="alert">Tối đa 100 chữ mỗi file. Hãy chia nhỏ danh sách.</p> : null}{parsed.unsupported.length ? <p className="hw-warning" role="alert">Chưa hỗ trợ: {parsed.unsupported.join(' ')}. Chỉ nhập Kanji và Kana.</p> : null}</fieldset>
        <fieldset><legend>Trang giấy của bạn</legend><label className="hw-label" htmlFor="hw-title">Tiêu đề</label><input id="hw-title" value={options.title} maxLength={60} onChange={e => change('title', e.target.value)} /><span className="hw-label">Màu giấy</span><div className="hw-swatches">{PAPERS.map(p => <button key={p.color} type="button" title={p.name} aria-label={`Giấy ${p.name.toLowerCase()}`} aria-pressed={options.paperColor === p.color} onClick={() => change('paperColor', p.color)} style={{ '--swatch': p.color } as CSSProperties}><span aria-hidden="true" />{p.name}</button>)}</div><div className="hw-colors"><label>Màu tùy chọn<input type="color" value={options.paperColor} onChange={e => change('paperColor', e.target.value)} /></label><label>Màu chữ<input type="color" value={options.inkColor} onChange={e => change('inkColor', e.target.value)} /></label><label>Màu lưới<input type="color" value={options.gridColor} onChange={e => change('gridColor', e.target.value)} /></label></div></fieldset>
        <fieldset><legend>Lưới & nét viết</legend><label className="hw-label" htmlFor="hw-style">Kiểu giấy</label><select id="hw-style" value={options.style} onChange={e => change('style', e.target.value as PaperStyle)}>{STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select><p className="hw-help">{STYLES.find(s => s.value === options.style)?.description}</p><label className="hw-label" htmlFor="hw-size">Cỡ ô viết</label><select id="hw-size" value={options.cellSize} onChange={e => change('cellSize', Number(e.target.value) as WorksheetOptions['cellSize'])}><option value={12}>12 mm · Gọn</option><option value={15}>15 mm · Vừa</option><option value={18}>18 mm · Rộng</option></select><label className="hw-range-label" htmlFor="hw-trace">Số ô tô mờ <output>{options.traceCells}</output></label><input id="hw-trace" type="range" min={0} max={layout.columns * 2} value={Math.min(options.traceCells, layout.columns * 2)} onChange={e => change('traceCells', Number(e.target.value))} /><label className="hw-checkbox"><input type="checkbox" checked={options.showReadings} onChange={e => change('showReadings', e.target.checked)} /> Hiện cách đọc On / Kun</label></fieldset>
      </section>
      <section id="handwriting-preview" className="hw-workspace" aria-label="Bản xem trước">
        <div className="hw-preview-bar"><span><Printer size={17} aria-hidden="true" /> A4</span><div className="hw-pagination"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0 || loading} aria-label="Trang trước"><ArrowLeft size={17} /></button><span>Trang {currentPage + 1} / {pages}</span><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pages - 1 || loading} aria-label="Trang sau"><ArrowRight size={17} /></button></div></div>
        {error ? <div className="hw-warning hw-message" role="alert">{error} <button type="button" className="hw-retry" onClick={() => setReload(r => r + 1)}>Tải lại mẫu chữ</button></div> : null}
        {contrastWarnings.ink ? <p className="hw-warning hw-message" role="status">Màu chữ gần màu giấy, khó đọc khi in. Hãy chọn màu chữ đậm hơn hoặc giấy sáng hơn.</p> : null}
        {contrastWarnings.grid || (options.traceCells > 0 && contrastWarnings.trace) ? <p className="hw-warning hw-message" role="status">Lưới hoặc chữ tô có thể quá nhạt khi in. Hãy tăng tương phản với màu giấy.</p> : null}
        {fallback.length ? <p className="hw-warning hw-message">Chưa có SVG cho {fallback.join(' ')}; dùng font Klee One. Font không thể hiện thứ tự nét.</p> : null}
        {downloaded ? <p className="hw-success hw-message" role="status">PDF đã tạo. Nếu chưa thấy file, kiểm tra mục tải xuống của trình duyệt.</p> : null}
        <div className="hw-paper-stage" aria-busy={loading || loadedKey !== key}>{loading || loadedKey !== key ? <div className="hw-empty" role="status"><SpinnerGap size={25} className="hw-spin" aria-hidden="true" /><p>Đang chuẩn bị mẫu chữ…</p></div> : glyphs.length ? <SheetPreview glyphs={glyphs} options={options} page={currentPage} pages={pages} /> : <div className="hw-empty"><p>Trang viết đang chờ bạn.</p><span>Nhập vài chữ hoặc chọn một bộ chữ để bắt đầu.</span></div>}</div>
        <button type="button" className="hw-download" onClick={download} disabled={exportDisabled}>{exporting ? <SpinnerGap size={19} className="hw-spin" aria-hidden="true" /> : <DownloadSimple size={19} aria-hidden="true" />}{exporting ? 'Đang tạo PDF…' : 'Tải PDF A4'}</button>
      </section>
    </div>
  </main>;
}
