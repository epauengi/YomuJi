'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import Link from 'next/link';
import { Camera, ImageSquare, Scan } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { searchHref } from '@/lib/navigation';
import { lookupReaderWord } from '@/lib/readerLookup';
import type { Phrase, Token } from '@/lib/sentenceParse';
import { wordHref } from '@/lib/wordRoutes';
import type { TermRecord } from '@/types/dictionary';

const MAX_FILE = 10 * 1024 * 1024;
const MAX_UPLOAD = 2 * 1024 * 1024;
const MAX_TEXT = 500;
const FULL = { left: 0, top: 0, right: 100, bottom: 100 };
const EDGES = { left: 'Trái', top: 'Trên', right: 'Phải', bottom: 'Dưới' } as const;
const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const field = 'rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]';
const link = 'font-semibold text-[var(--color-primary-700)] underline underline-offset-4';

type Point = { x: number; y: number };

function imagePoint(event: PointerEvent<HTMLDivElement>): Point {
  const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
  const percent = (value: number) => Math.max(0, Math.min(100, Math.round(value * 100)));
  return { x: percent((event.clientX - left) / width), y: percent((event.clientY - top) / height) };
}

async function cropImage(image: HTMLImageElement, crop: typeof FULL) {
  const { naturalWidth: width, naturalHeight: height } = image;
  const sourceWidth = width * (crop.right - crop.left) / 100;
  const sourceHeight = height * (crop.bottom - crop.top) / 100;
  const scale = Math.min(1, 2200 / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Trình duyệt không thể xử lý ảnh.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, width * crop.left / 100, height * crop.top / 100, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.9, 0.72]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob?.type === 'image/jpeg' && blob.size <= MAX_UPLOAD) return blob;
  }
  throw new Error('Vùng ảnh quá lớn. Hãy chọn vùng chữ nhỏ hơn.');
}

export function OcrLookup() {
  const [photo, setPhoto] = useState('');
  const [ready, setReady] = useState(false);
  const [crop, setCrop] = useState(FULL);
  const [draft, setDraft] = useState<typeof FULL | null>(null);
  const [text, setText] = useState('');
  const [sentences, setSentences] = useState<Phrase[][] | null>(null);
  const [selected, setSelected] = useState<{ token: Token; terms?: TermRecord[]; failed?: boolean } | null>(null);
  const [busy, setBusy] = useState<'ocr' | 'parse' | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [parseError, setParseError] = useState('');
  const [notice, setNotice] = useState('');
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; start: Point } | null>(null);
  const request = useRef<AbortController | null>(null);
  const lookup = useRef<AbortController | null>(null);
  const renderedCrop = draft ?? crop;
  const length = text.normalize('NFKC').trim().length;

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => () => { request.current?.abort(); lookup.current?.abort(); }, []);

  function choose(file?: File) {
    if (!file) return;
    const supported = file.type ? ACCEPT.split(',').includes(file.type) : /\.(?:jpe?g|png|webp)$/i.test(file.name);
    if (!supported || !file.size || file.size > MAX_FILE) {
      setPhotoError('Chọn ảnh JPG, PNG hoặc WebP dung lượng tối đa 10 MB.');
      return;
    }
    request.current?.abort();
    drag.current = null;
    setCrop(FULL);
    setDraft(null);
    setReady(false);
    setPhotoError('');
    setNotice('');
    setBusy(null);
    setPhoto(URL.createObjectURL(file));
  }

  function drawCrop(event: PointerEvent<HTMLDivElement>, finish = false) {
    if (drag.current?.id !== event.pointerId) return;
    const start = drag.current.start;
    const end = imagePoint(event);
    const region = { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), right: Math.max(start.x, end.x), bottom: Math.max(start.y, end.y) };
    if (finish) {
      drag.current = null;
      setDraft(null);
      if (region.right - region.left >= 2 && region.bottom - region.top >= 2) setCrop(region);
    } else setDraft(region);
  }

  async function recognize() {
    if (!image.current || !ready || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy('ocr');
    setPhotoError('');
    setNotice('');
    try {
      const body = await cropImage(image.current, crop);
      controller.signal.throwIfAborted();
      const response = await fetch('/api/ocr', {
        method: 'POST', headers: { 'Content-Type': body.type }, body,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Không thể nhận dạng ảnh lúc này.');
      if (typeof data.text !== 'string') throw new Error('Không nhận được văn bản hợp lệ.');
      if (!controller.signal.aborted) {
        if (data.text.trim()) {
          lookup.current?.abort();
          setText(data.text.trim());
          setSentences(null);
          setSelected(null);
          setParseError('');
          setNotice('Đã nhận dạng. Kiểm tra và sửa văn bản trước khi tách từ.');
        } else setNotice('Không tìm thấy chữ. Hãy chọn vùng rõ hơn hoặc thử ảnh khác.');
      }
    } catch (error) {
      if (!controller.signal.aborted) setPhotoError(
        error instanceof Error && error.name === 'TimeoutError' ? 'Nhận dạng quá thời gian chờ. Hãy thử lại.'
          : error instanceof Error && !(error instanceof TypeError) ? error.message : 'Không thể nhận dạng ảnh. Kiểm tra kết nối rồi thử lại.',
      );
    } finally {
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  async function parse() {
    if (!length || length > MAX_TEXT || busy) return;
    const controller = new AbortController();
    request.current = controller;
    lookup.current?.abort();
    setBusy('parse');
    setParseError('');
    setSentences(null);
    setSelected(null);
    try {
      const response = await fetch('/api/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      if (!response.ok) throw new Error();
      const data: { sentences: Phrase[][] } = await response.json();
      if (!controller.signal.aborted) setSentences(data.sentences);
    } catch {
      if (!controller.signal.aborted) setParseError('Chưa thể tách từ. Kiểm tra kết nối rồi thử lại.');
    } finally {
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  async function findWord(token: Token) {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setSelected({ token });
    try {
      const terms = await lookupReaderWord(token.base, AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]));
      if (!controller.signal.aborted) setSelected({ token, terms });
    } catch {
      if (!controller.signal.aborted) setSelected({ token, failed: true });
    }
  }

  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      <section aria-labelledby="ocr-image" className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 id="ocr-image" className="text-xl font-semibold">Ảnh nguồn</h2>
        <div className="flex flex-wrap gap-2">
          <label className={`${field} relative inline-flex min-h-11 cursor-pointer items-center gap-2 font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)]`}>
            <ImageSquare size={19} aria-hidden="true" /> Tải ảnh
            <input type="file" accept={ACCEPT} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          <label className={`${field} relative inline-flex min-h-11 cursor-pointer items-center gap-2 font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)]`}>
            <Camera size={19} aria-hidden="true" /> Chụp ảnh
            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          </label>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">JPG, PNG hoặc WebP · Tối đa 10 MB. Chỉ vùng đã chọn được gửi đến Google Cloud Vision khi bấm nhận dạng.</p>
        {photo ? (
          <>
            <p className="text-sm text-[var(--color-text-secondary)]">Kéo trên ảnh để khoanh vùng chữ, hoặc nhập tọa độ bên dưới.</p>
            <div className="mx-auto w-fit max-w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)]">
              <div className="relative w-fit max-w-full touch-none select-none" onPointerDown={(event) => {
                if (!ready || busy || !event.isPrimary || event.button !== 0) return;
                drag.current = { id: event.pointerId, start: imagePoint(event) };
                event.currentTarget.setPointerCapture(event.pointerId);
              }} onPointerMove={(event) => drawCrop(event)} onPointerUp={(event) => drawCrop(event, true)} onLostPointerCapture={() => { drag.current = null; setDraft(null); }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img key={photo} ref={image} src={photo} alt="Ảnh chữ cần nhận dạng" draggable={false} className="block max-h-[26rem] max-w-full" onLoad={(event) => {
                  const img = event.currentTarget;
                  const valid = img.naturalWidth * img.naturalHeight <= 32_000_000;
                  setReady(valid);
                  if (!valid) setPhotoError('Ảnh vượt quá 32 megapixel. Hãy thu nhỏ ảnh rồi tải lại.');
                }} onError={() => { setReady(false); setPhotoError('Không mở được ảnh. Hãy thử ảnh khác.'); }} />
                {ready && <span aria-hidden="true" className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_2px_#101722,0_0_0_100vmax_#10172266]" style={{ left: `${renderedCrop.left}%`, top: `${renderedCrop.top}%`, right: `${100 - renderedCrop.right}%`, bottom: `${100 - renderedCrop.bottom}%` }} />}
              </div>
            </div>
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer content-center font-medium">Chỉnh vùng ảnh bằng phần trăm</summary>
              <fieldset className="mt-2 grid grid-cols-2 gap-2" disabled={!ready || !!busy}>
                <legend className="sr-only">Tọa độ vùng ảnh (0–100%)</legend>
                {(Object.keys(EDGES) as (keyof typeof FULL)[]).map((edge) => {
                  const min = edge === 'right' ? crop.left + 2 : edge === 'bottom' ? crop.top + 2 : 0;
                  const max = edge === 'left' ? crop.right - 2 : edge === 'top' ? crop.bottom - 2 : 100;
                  return <label key={edge} className="grid gap-1">{EDGES[edge]} (%)<input type="number" min={min} max={max} value={crop[edge]} className={`${field} w-full`} onChange={(event) => {
                    const value = event.currentTarget.valueAsNumber;
                    if (Number.isFinite(value)) setCrop({ ...crop, [edge]: Math.max(min, Math.min(max, Math.round(value))) });
                  }} /></label>;
                })}
              </fieldset>
              <Button type="button" variant="ghost" size="sm" className="mt-2" disabled={!ready || !!busy} onClick={() => setCrop(FULL)}>Dùng toàn ảnh</Button>
            </details>
          </>
        ) : <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">Chưa có ảnh. Để đọc chữ dọc hoặc chữ nhỏ, nên chọn một cột hoặc một đoạn rõ nét.</p>}
        <Button type="button" disabled={!ready || !!busy} loading={busy === 'ocr'} onClick={recognize}><Scan size={19} aria-hidden="true" /> Nhận dạng ảnh</Button>
        {photoError && <p role="alert" className="text-sm text-[var(--color-text-primary)]">{photoError}</p>}
        {notice && <p role="status" className="text-sm text-[var(--color-text-secondary)]">{notice}</p>}
      </section>

      <section aria-labelledby="ocr-text" className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 id="ocr-text" className="text-xl font-semibold">Văn bản và nghĩa</h2>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void parse(); }}>
          <label className="block space-y-2 font-medium">Văn bản tiếng Nhật
            <textarea lang="ja" value={text} rows={5} disabled={!!busy} aria-describedby="ocr-limit" placeholder="Văn bản nhận dạng sẽ hiện ở đây…" className={`${field} jp-text block w-full resize-y leading-relaxed`} onChange={(event) => {
              setText(event.target.value);
              setSentences(null);
              lookup.current?.abort();
              setSelected(null);
              setParseError('');
            }} />
          </label>
          <p id="ocr-limit" className="text-sm text-[var(--color-text-secondary)]">{length}/{MAX_TEXT} ký tự{length > MAX_TEXT ? ' · Cắt bớt văn bản để tách từ.' : ''}</p>
          <Button type="submit" variant="secondary" disabled={!length || length > MAX_TEXT || !!busy} loading={busy === 'parse'}>Tách từ để tra nghĩa</Button>
          {parseError && <p role="alert" className="text-sm">{parseError}</p>}
        </form>
        {sentences && <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{sentences.some((sentence) => sentence.some((phrase) => phrase.tokens.some((token) => token.lookup))) ? 'Chọn một từ để xem nghĩa.' : 'Không tìm thấy từ có thể tra trong đoạn này.'}</p>
          {sentences.map((sentence, index) => <p key={index} lang="ja" className="jp-text break-all leading-loose">
            {sentence.flatMap((phrase) => phrase.tokens).map((token, i) => token.lookup ? <button key={i} type="button" aria-pressed={selected?.token === token} className="mx-0.5 min-h-11 rounded-[var(--radius-sm)] px-1.5 text-[var(--color-primary-700)] underline decoration-dotted underline-offset-4 hover:bg-[var(--color-surface-subtle)] aria-pressed:bg-[var(--color-surface-subtle)]" onClick={() => void findWord(token)}>
              {token.reading && token.reading !== token.surface && /\p{Script=Han}/u.test(token.surface) ? <ruby>{token.surface}<rt>{token.reading}</rt></ruby> : token.surface}
            </button> : <span key={i}>{token.surface}</span>)}
          </p>)}
        </div>}
        {selected && <div className="space-y-2 rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] p-3" aria-live="polite">
          <p className="jp-text font-semibold" lang="ja">{selected.token.surface}</p>
          {selected.terms?.length ? <ul className="space-y-2">{selected.terms.slice(0, 5).map((term) => <li key={term.id}>
            <Link className={link} href={wordHref(term)} lang="ja">{term.surface}・{term.reading}</Link>
            <p>{term.meaningsVi.slice(0, 2).join('; ') || 'Chưa có nghĩa tiếng Việt.'}</p>
          </li>)}</ul> : <p className="text-sm">{selected.failed ? 'Chưa tra được mục từ.' : selected.terms ? 'Không tìm thấy mục từ khớp.' : 'Đang tra từ…'}</p>}
          {(selected.failed || selected.terms?.length === 0) && <Link className={link} href={searchHref(selected.token.base)}>Mở tìm kiếm từ điển</Link>}
        </div>}
      </section>
    </div>
  );
}
