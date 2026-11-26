'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { NameResults } from '@/components/dictionary/NameResults';
import type { TermRecord } from '@/types/dictionary';

export type ReaderContext = { sentence: string; source: { title: string; href: string } };

export function ReaderLookup({ query, onClose, context }: { query: string; onClose: () => void; context?: ReaderContext }) {
  const [result, setResult] = useState<TermRecord[] | 'error' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState('');
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

  const save = async () => {
    if (!term || !context) return;
    setSaveStatus('Đang lưu…');
    try {
      const { saveReaderCard } = await import('@/lib/flashcards');
      const added = await saveReaderCard({ word: term.surface, reading: term.reading === term.surface ? '' : term.reading,
        meaning: term.meaningsVi.slice(0, 3).join('; '), ...context });
      setSaveStatus(added ? 'Đã lưu vào bộ “Từ trong truyện” trên thiết bị.' : 'Từ này cùng câu này đã có trong bộ thẻ.');
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : 'Không lưu được thẻ. Kiểm tra bộ nhớ trình duyệt rồi thử lại.');
    }
  };

  return (
    <aside className="reader-lookup flex flex-col overflow-hidden p-0" aria-labelledby="reader-lookup-title">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-2">
        <h2 id="reader-lookup-title" className="min-w-0 text-sm font-semibold">
          Tra nghĩa <span lang="ja" className="jp-text ml-1 break-all font-medium text-[var(--color-text-secondary)]">{query}</span>
        </h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng khung tra"
          className="reader-control inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] active:bg-[var(--color-primary-50)]">
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
        {term && ![term.surface, term.reading, ...(term.writtenForms ?? []), ...(term.readingForms ?? [])].some((form) => form.normalize('NFKC') === query.normalize('NFKC')) && (
          <p className="mb-2 text-xs text-[var(--color-text-secondary)]">Dạng gốc từ <span lang="ja" className="jp-text font-medium">{query}</span></p>
        )}
        {terms.length > 1 && (
          <label className="mb-4 block text-sm font-medium text-[var(--color-text-secondary)]">
            Chọn mục từ ({terms.length})
            <select value={index} onChange={(event) => { setIndex(Number(event.target.value)); setSaveStatus(''); }}
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
              {context && term.meaningsVi.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button type="button" onClick={() => void save()} disabled={saveStatus === 'Đang lưu…'}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-surface-subtle)] disabled:opacity-50">
                  <Plus size={16} aria-hidden="true" /> Lưu vào bộ thẻ
                </button>
                <p role="status" className="text-xs text-[var(--color-text-secondary)]">{saveStatus}</p>
              </div>}
            </>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">Không tìm thấy mục từ. Hãy thử chọn một từ ngắn hơn.</p>}
        </div>
        {result === 'error' && <button type="button" className="mt-1 min-h-11 text-sm font-semibold text-[var(--color-primary-700)] hover:underline"
          onClick={() => { closeRef.current?.focus({ preventScroll: true }); setResult(null); setAttempt((value) => value + 1); }}>Thử lại</button>}
        <NameResults query={query} variant="reader" attempt={attempt} />
      </div>
    </aside>
  );
}
