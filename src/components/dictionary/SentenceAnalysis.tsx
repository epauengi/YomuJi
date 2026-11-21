'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { canChunkJapanese, chunkJapanese } from '@/lib/japaneseChunks';
import { lookupReaderWord } from '@/lib/readerLookup';
import { wordHref } from '@/lib/wordRoutes';
import type { DictionarySearchResult, TermRecord } from '@/types/dictionary';

// ponytail: cap lookups per sentence; raise or batch server-side if long paragraphs become common.
const MAX_WORDS = 24;

export function sentenceWords(query: string) {
  const text = query.normalize('NFKC').trim();
  if (!canChunkJapanese() || !/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u.test(text)) return [];
  const words = chunkJapanese(text).filter((chunk) => chunk.word).map((chunk) => chunk.text);
  return words.length > 1 ? words : [];
}

export function SentenceAnalysis({ query, results }: { query: string; results: DictionarySearchResult[] }) {
  const normalized = query.normalize('NFKC').trim();
  const exact = results.some(({ term }) => [term.surface, term.reading, ...term.searchAliases]
    .some((value) => value.normalize('NFKC') === normalized));
  const words = useMemo(() => exact ? [] : sentenceWords(query), [exact, query]);
  const unique = useMemo(() => [...new Set(words)].slice(0, MAX_WORDS), [words]);
  const [terms, setTerms] = useState<Record<string, TermRecord | null>>({});

  useEffect(() => {
    if (!unique.length) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    setTerms({});
    for (const word of unique) {
      lookupReaderWord(word, signal)
        .then((found) => found[0] ?? null, () => null)
        .then((term) => { if (!controller.signal.aborted) setTerms((prev) => ({ ...prev, [word]: term })); });
    }
    return () => controller.abort();
  }, [unique]);

  if (!unique.length) return null;
  const pending = unique.filter((word) => !(word in terms)).length;

  return <section aria-labelledby="sentence-analysis-heading" className="mb-6 space-y-3 border-b border-[var(--color-border)] pb-6">
    <h3 id="sentence-analysis-heading" className="text-lg font-bold text-[var(--color-text-primary)]">Phân tích câu</h3>
    <p lang="ja" className="jp-text flex flex-wrap gap-1 text-xl">
      {words.map((word, index) => <span key={index} className="rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-1.5">{word}</span>)}
    </p>
    <p aria-live="polite" className="text-sm text-[var(--color-text-secondary)]">
      {pending ? `Đang tra ${pending} thành phần…` : 'Tách từ tự động, có thể chưa chính xác với câu phức tạp.'}
    </p>
    <ol className="divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {unique.map((word) => {
        const term = terms[word];
        return <li key={word} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
          <span lang="ja" className="jp-text min-w-16 font-semibold">{word}</span>
          {term === undefined ? <span className="text-sm text-[var(--color-text-muted)]">…</span>
            : term ? <>
              <Link href={wordHref(term)} lang="ja" className="jp-text inline-flex min-h-11 items-center font-semibold text-[var(--color-primary-700)] underline underline-offset-4">
                {term.surface}{term.reading && term.reading !== term.surface ? `（${term.reading}）` : ''}
              </Link>
              <span className="min-w-0 flex-1 text-sm text-[var(--color-text-secondary)]">{term.meaningsVi.slice(0, 2).join('; ') || 'Chưa có nghĩa tiếng Việt'}</span>
            </>
              : <span className="text-sm text-[var(--color-text-muted)]">Không tìm thấy</span>}
        </li>;
      })}
    </ol>
  </section>;
}
