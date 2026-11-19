'use client';

import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { ArrowCounterClockwise, MagnifyingGlass, Trash, X } from '@phosphor-icons/react';
import type { InkPoint, InkStroke } from '@/lib/handwritingRecognition';
import './handwriting-search.css';

const emptyInk: InkStroke[] = [];

function pointList(stroke: InkStroke) {
  return stroke.map(({ x, y }) => `${x},${y}`).join(' ');
}

export function HandwritingSearch({ id, query, onQuery, onClose, onSearch }: {
  id: string;
  query: string;
  onQuery: (query: string) => void;
  onClose: () => void;
  onSearch: () => void;
}) {
  const titleId = useId();
  const helpId = useId();
  const box = useRef<HTMLDialogElement>(null);
  const pad = useRef<SVGSVGElement>(null);
  const preview = useRef<SVGPolylineElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const live = useRef<{ pointerId: number; stroke: InkStroke } | null>(null);
  const composing = useRef(false);
  const [ink, setInk] = useState(emptyInk);
  const [drawing, setDrawing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [engine, setEngine] = useState<{
    attempt: number;
    match: ((ink: InkStroke[]) => string[]) | null;
    maxStrokes?: number;
  } | null>(null);
  const [result, setResult] = useState<{ ink: InkStroke[]; characters: string[] } | null>(null);
  const match = engine?.attempt === attempt ? engine.match : undefined;
  const maxStrokes = engine?.maxStrokes ?? 32;
  const candidates = !drawing && result?.ink === ink ? result.characters : null;

  useEffect(() => {
    box.current?.showModal();
  }, []);

  useEffect(() => {
    let current = true;
    import('@/lib/handwritingRecognition')
      .then(async ({ loadHandwritingIndex, recognizeHandwriting, MAX_HANDWRITING_STROKES }) => {
        const index = await loadHandwritingIndex();
        if (current) setEngine({ attempt, maxStrokes: MAX_HANDWRITING_STROKES, match: (strokes) => recognizeHandwriting(strokes, index) });
      })
      .catch(() => {
        if (current) setEngine({ attempt, match: null });
      });
    return () => { current = false; };
  }, [attempt]);

  useEffect(() => {
    if (!ink.length || drawing || !match) return;
    const timer = window.setTimeout(() => setResult({ ink, characters: match(ink) }), 90);
    return () => window.clearTimeout(timer);
  }, [drawing, ink, match]);

  const position = (event: PointerEvent<SVGSVGElement>): InkPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const coordinate = (pixel: number, origin: number, length: number) =>
      Math.round(Math.max(0, Math.min(100, (pixel - origin) * 100 / length)) * 10) / 10;
    return {
      x: coordinate(event.clientX, bounds.left, bounds.width),
      y: coordinate(event.clientY, bounds.top, bounds.height),
    };
  };

  const start = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || live.current || ink.length >= maxStrokes) return;
    const point = position(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    live.current = { pointerId: event.pointerId, stroke: [point] };
    preview.current?.setAttribute('points', '');
    dot.current?.setAttribute('cx', String(point.x));
    dot.current?.setAttribute('cy', String(point.y));
    dot.current?.removeAttribute('visibility');
    setDrawing(true);
  };

  const move = (event: PointerEvent<SVGSVGElement>) => {
    const current = live.current;
    if (!current || current.pointerId !== event.pointerId || current.stroke.length >= 1024) return;
    const point = position(event);
    const last = current.stroke[current.stroke.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < 0.35) return;
    current.stroke.push(point);
    preview.current?.setAttribute('points', pointList(current.stroke));
  };

  const finish = (event: PointerEvent<SVGSVGElement>, commit: boolean) => {
    const current = live.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (commit) {
      move(event);
      setInk((strokes) => [...strokes, current.stroke]);
    }
    live.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    preview.current?.setAttribute('points', '');
    dot.current?.setAttribute('visibility', 'hidden');
    setDrawing(false);
  };

  const choose = (character: string) => {
    onQuery(query + character);
    setInk(emptyInk);
    pad.current?.focus();
  };

  const status = match === undefined ? 'Đang tải dữ liệu nhận dạng…'
    : match === null ? 'Không tải được dữ liệu nhận dạng.'
      : drawing ? 'Thả bút để xem gợi ý.'
        : !ink.length ? 'Gợi ý sẽ hiện sau khi bạn viết.'
          : !candidates ? 'Đang nhận dạng…'
            : !candidates.length ? 'Chưa nhận ra chữ. Thử viết đủ nét hoặc viết lại.'
              : 'Chọn một chữ để thêm vào truy vấn.';

  return (
    <dialog ref={box} id={id} className="handwriting-dialog" aria-labelledby={titleId} onClose={onClose}>
      <div className="handwriting-heading">
        <div>
          <h2 id={titleId}>Viết tay</h2>
          <p id={helpId}>Vẽ từng chữ Kanji hoặc Kana.</p>
        </div>
        <button type="button" className="handwriting-close" aria-label="Đóng bảng viết tay" onClick={() => box.current?.close()}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="handwriting-workspace">
        <div className="handwriting-sheet">
          <div className="handwriting-pad">
            <svg
              ref={pad} viewBox="0 0 100 100" role="img" aria-label="Ô viết tay" aria-describedby={helpId} tabIndex={-1}
              onPointerDown={start} onPointerMove={move} onPointerUp={(event) => finish(event, true)}
              onPointerCancel={(event) => finish(event, false)} onLostPointerCapture={(event) => finish(event, false)}
              onContextMenu={(event) => event.preventDefault()}
            >
              <path className="handwriting-guide" d="M50 0V100 M0 50H100" />
              <g className="handwriting-ink">
                {ink.map((stroke, i) => stroke.length === 1
                  ? <circle key={i} cx={stroke[0].x} cy={stroke[0].y} r="1.1" />
                  : <polyline key={i} points={pointList(stroke)} />)}
                <circle ref={dot} r="1.1" visibility="hidden" />
                <polyline ref={preview} />
              </g>
            </svg>
            {!drawing && !ink.length && <span className="handwriting-hint" aria-hidden="true">Viết chữ ở đây</span>}
          </div>
          <div className="handwriting-tools">
            <button type="button" disabled={drawing || !ink.length} onClick={() => setInk(ink.slice(0, -1))}>
              <ArrowCounterClockwise size={17} aria-hidden="true" /> Hoàn tác
            </button>
            <button type="button" disabled={drawing || !ink.length} onClick={() => setInk(emptyInk)}>
              <Trash size={17} aria-hidden="true" /> Xóa nét
            </button>
          </div>
          {ink.length >= maxStrokes && <p role="status" className="handwriting-message">Đã đạt giới hạn nét. Hoàn tác hoặc xóa để viết lại.</p>}
        </div>

        <div className="handwriting-results">
          <h3>Chữ gợi ý</h3>
          <p className="handwriting-message">{status}</p>
          <span className="sr-only" role="status">
            {drawing ? '' : candidates?.length ? `${candidates.length} chữ gợi ý. Chọn chữ để thêm vào truy vấn.` : status}
          </span>
          {match === null && <button type="button" className="handwriting-retry" onClick={() => setAttempt(attempt + 1)}>Thử tải lại</button>}
          {candidates && candidates.length > 0 && (
            <ul className="handwriting-candidates">
              {candidates.map((character) => (
                <li key={character}><button type="button" lang="ja" className="jp-text" onClick={() => choose(character)}>{character}</button></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form className="handwriting-query" onSubmit={(event) => {
        event.preventDefault();
        if (!query.trim() || composing.current) return;
        box.current?.close();
        onSearch();
      }}>
        <label htmlFor={`${id}-query`}>Truy vấn</label>
        <div className="handwriting-query-row">
          <input
            id={`${id}-query`} value={query} placeholder="Chọn chữ hoặc nhập từ" autoComplete="off"
            onChange={(event) => onQuery(event.target.value)}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
          />
          <button type="submit" disabled={!query.trim()}><MagnifyingGlass size={17} aria-hidden="true" /> Tra cứu</button>
        </div>
      </form>
    </dialog>
  );
}
