'use client';

import { useState } from 'react';
import { ArrowsClockwise, CaretDown } from '@phosphor-icons/react';
import { conjugationLabels, getConjugation } from '@/lib/conjugationClient';
import { isConjugationQuery, type ConjugationData } from '@/types/kotoba';
import type { TermRecord } from '@/types/dictionary';

export function ConjugationTable({ term }: { term: TermRecord }) {
  const [data, setData] = useState<ConjugationData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const query = isConjugationQuery(term.surface) ? term.surface : term.reading;
  const eligible = isConjugationQuery(query) && term.partOfSpeech.some((pos) =>
    /^(v[1-5]|v[skz]|adj-(i|ix|na)$|aux-(v|adj)$)|động từ|tính từ/i.test(pos));
  if (!eligible) return null;

  async function load() {
    if (status === 'loading' || status === 'done') return;
    setStatus('loading');
    try {
      const response = await getConjugation('forms', query, term.sequence);
      // Never display a homograph's table as this entry's forms.
      setData(response.entries[0]?.sequence === term.sequence ? response : null);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  return <details className="group/conjugation border-y border-[var(--color-border)]" onToggle={(event) => {
    if (event.currentTarget.open) void load();
  }}>
    <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-4 text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-primary-700)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary-700)] [&::-webkit-details-marker]:hidden">
      <ArrowsClockwise size={22} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" />
      <span className="flex-1 text-lg font-bold">Bảng chia động từ / tính từ</span>
      <CaretDown size={18} aria-hidden="true" className="shrink-0 transition-transform group-open/conjugation:rotate-180 motion-reduce:transition-none" />
    </summary>
    <div className="pb-6 pt-2">
      {status === 'loading' || status === 'error' || (status === 'done' && !data?.sections.length) ? <p role="status" aria-live="polite" className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {status === 'loading' ? 'Đang tải bảng chia…' : status === 'error' ? 'Chưa thể tải bảng chia. Nghĩa và ví dụ vẫn dùng được.' : 'Chưa có bảng chia cho mục từ này.'}
      </p> : null}
      {status === 'error' ? <button type="button" onClick={() => void load()} className="mt-2 min-h-11 font-semibold text-[var(--color-primary-700)] underline underline-offset-4">Thử lại</button> : null}
      {data?.sections.length ? <>
        <p className="mb-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">Các dạng chia của <span lang="ja" className="jp-text font-semibold text-[var(--color-text-primary)]">{term.surface}</span>. Đối chiếu dạng khẳng định, phủ định và cách nói lịch sự.</p>
        <div className="grid items-start gap-5 md:grid-cols-2">
          {data.sections.map((section) => <table key={section.id} className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
            <caption className="pb-3 text-left text-base font-bold text-[var(--color-text-primary)]">{conjugationLabels[section.id] || section.id}</caption>
            <thead><tr className="bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]">
              <th scope="col" className="w-[43%] rounded-tl-[var(--radius-md)] border-y border-l border-[var(--color-border)] px-3 py-2.5 text-xs font-semibold">Dạng chia</th>
              <th scope="col" className="rounded-tr-[var(--radius-md)] border-y border-r border-[var(--color-border)] px-3 py-2.5 text-xs font-semibold">Tiếng Nhật</th>
            </tr></thead>
            <tbody>{section.forms.map((form) => <tr key={`${form.id}-${form.form}`} className="group/row bg-[var(--color-surface)]">
              <th scope="row" className="break-words border-b border-l border-[var(--color-border)] px-3 py-3 text-sm font-medium leading-relaxed text-[var(--color-text-secondary)] group-last/row:rounded-bl-[var(--radius-md)]">{form.id === 'dict' && section.id !== 'affirmative' ? 'Hiện tại / tương lai' : conjugationLabels[form.id] || form.id}</th>
              <td className="break-words border-b border-r border-[var(--color-border)] px-3 py-3 text-[var(--color-text-primary)] group-last/row:rounded-br-[var(--radius-md)]">
                <span lang="ja" className="jp-text text-base font-semibold leading-relaxed">{form.form}</span>
                {form.reading && form.reading !== form.form ? <span lang="ja" className="jp-text mt-1 block text-xs leading-relaxed text-[var(--color-text-secondary)]">{form.reading}</span> : null}
                {form.alternative ? <span lang="ja" className="jp-text mt-1 block text-sm text-[var(--color-text-secondary)]">{form.alternative}</span> : null}
              </td>
            </tr>)}</tbody>
          </table>)}
        </div>
      </> : null}
    </div>
  </details>;
}
