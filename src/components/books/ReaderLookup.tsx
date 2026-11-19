'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import type { TermRecord } from '@/types/dictionary';

export function ReaderLookup({ query, onClose }: { query: string; onClose: () => void }) {
  const [result, setResult] = useState<TermRecord[] | 'error' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    void import('@/lib/readerLookup').then(({ lookupReaderWord }) => lookupReaderWord(query, signal))
      .then((terms) => { if (!controller.signal.aborted) setResult(terms); })
      .catch(() => { if (!controller.signal.aborted) setResult('error'); });
    return () => controller.abort();
  }, [query, attempt]);

  const terms = Array.isArray(result) ? result : [];
  const term = terms[index];

  return (
    <aside className="reader-lookup flex flex-col overflow-hidden p-0" aria-labelledby="reader-lookup-title">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-2">
        <h2 id="reader-lookup-title" className="min-w-0 text-sm font-semibold">
          Tra nghĩa <span lang="ja" className="jp-text ml-1 break-all font-medium text-[var(--color-text-secondary)]">{query}</span>
        </h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng khung tra"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]">
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
        {terms.length > 1 && (
          <label className="mb-4 block text-sm font-medium text-[var(--color-text-secondary)]">
            Chọn mục từ ({terms.length})
            <select value={index} onChange={(event) => setIndex(Number(event.target.value))}
              className="mt-1 block min-h-11 w-full truncate rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[var(--color-text-primary)]">
              {terms.map((item, i) => (
                <option key={item.id} value={i}>{item.surface} · {item.reading} · {item.meaningsVi[0] || 'Chưa có nghĩa tiếng Việt'}</option>
              ))}
            </select>
          </label>
        )}
        <div aria-live="polite" aria-atomic="true">
          {result === null ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-secondary)]">Đang tra nghĩa…</p>
              <div aria-hidden="true" className="h-5 w-1/3 rounded bg-[var(--color-surface-subtle)]" />
              <div aria-hidden="true" className="h-4 w-2/3 rounded bg-[var(--color-surface-subtle)]" />
            </div>
          ) : result === 'error' ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Chưa thể tra cứu. Kiểm tra kết nối rồi thử lại.</p>
          ) : term ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3" lang="ja">
                <h3 className="jp-text break-all text-2xl font-semibold">{term.surface}</h3>
                {term.reading && term.reading !== term.surface && <p className="jp-text break-all text-sm text-[var(--color-text-secondary)]">{term.reading}</p>}
              </div>
              {term.meaningsVi.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed wrap-break-word">
                  {term.meaningsVi.slice(0, 3).map((meaning, i) => <li key={i}>{meaning}</li>)}
                </ul>
              ) : <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Mục từ này chưa có nghĩa tiếng Việt.</p>}
            </>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">Không tìm thấy mục từ. Hãy thử chọn một từ ngắn hơn.</p>}
        </div>
        {result === 'error' && <button type="button" className="mt-1 min-h-11 text-sm font-semibold text-[var(--color-primary-700)] hover:underline"
          onClick={() => { closeRef.current?.focus({ preventScroll: true }); setResult(null); setAttempt((value) => value + 1); }}>Thử lại</button>}
      </div>
    </aside>
  );
}
