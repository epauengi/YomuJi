'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { searchDictionary } from '@/lib/mockDictionary';
import { searchHref } from '@/lib/navigation';
import { conjugationLabels, getConjugation } from '@/lib/conjugationClient';
import { isConjugationQuery, type ConjugationData } from '@/types/kotoba';
import type { DictionarySearchResult } from '@/types/dictionary';
import { TermCard } from './TermCard';

export function ConjugationAnalysis({ query, results }: { query: string; results: DictionarySearchResult[] }) {
  const [analysis, setAnalysis] = useState<ConjugationData | null>(null);
  const [baseResults, setBaseResults] = useState<DictionarySearchResult[]>([]);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const normalized = query.normalize('NFKC').trim();
  const needed = isConjugationQuery(normalized) && !results.some(({ term }) =>
    [term.surface, term.reading, ...term.searchAliases].some((value) => value.normalize('NFKC') === normalized));

  useEffect(() => {
    if (!needed) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await getConjugation('search', normalized);
        if (!active) return;
        if (!data.baseForm || data.baseForm === normalized || !data.entries.length) {
          setStatus('done');
          return;
        }
        setAnalysis(data);
        try {
          const local = await searchDictionary(data.baseForm, 20, controller.signal);
          if (active) setBaseResults(local.filter(({ term }) => data.entries.some((entry) => entry.sequence === term.sequence)));
        } catch {
          // Keep the recognized base form even if the existing dictionary is temporarily unavailable.
        }
        if (active) setStatus('done');
      } catch {
        if (active) setStatus('error');
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [needed, normalized]);

  if (!needed || (status === 'done' && !analysis)) return null;
  return <section aria-label="Phân tích dạng chia" className="mb-6 space-y-3 border-b border-[var(--color-border)] pb-6">
    <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Phân tích dạng chia</h3>
    <div role="status" aria-live="polite" className="text-sm text-[var(--color-text-secondary)]">
      {status === 'loading' && !analysis ? 'Đang nhận diện dạng chia…' : null}
      {status === 'error' ? 'Chưa thể phân tích dạng chia. Kết quả từ điển hiện tại vẫn được giữ nguyên.' : null}
    </div>
    {analysis?.baseForm ? <>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[var(--color-text-secondary)]">
        <span lang="ja" className="jp-text font-semibold">{normalized}</span>
        <span>có thể là dạng chia của</span>
        <Link href={searchHref(analysis.baseForm)} lang="ja" className="jp-text inline-flex min-h-11 items-center font-bold text-[var(--color-primary-700)] underline underline-offset-4">{analysis.baseForm}</Link>
      </p>
      {analysis.rules.length ? <p className="text-sm text-[var(--color-text-secondary)]">Dạng nhận diện: {analysis.rules.map((rule) => conjugationLabels[rule] || rule).join(' · ')}</p> : null}
      {baseResults.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{baseResults.map((result) => <TermCard key={result.term.id} term={result.term} matchType={result.matchType} />)}</div> :
        <p className="text-sm text-[var(--color-text-secondary)]">Chọn dạng gốc để tra nghĩa Nhật–Việt. Một dạng chia có thể tương ứng nhiều từ.</p>}
    </> : null}
  </section>;
}
