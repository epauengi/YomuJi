'use client';

import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { Funnel, ListMagnifyingGlass, MagnifyingGlass } from '@phosphor-icons/react';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TermCard } from '@/components/dictionary/TermCard';
import { useDictionary, getPopularTerms, searchDictionary } from '@/lib/mockDictionary';
import type { DictionarySearchResult } from '@/types/dictionary';

const PAGE_SIZE = 50;

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8 text-[var(--color-text-secondary)]">Đang mở trang tìm kiếm...</div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const { isReady, progress } = useDictionary();
  const [query, setQuery] = useState(params.get('q') || '');
  const [results, setResults] = useState<DictionarySearchResult[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setVisible(PAGE_SIZE);
      const next = query.trim()
        ? await searchDictionary(query, 300)
        : await getPopularTerms(100);
      if (!cancelled) {
        setResults(next);
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [isReady, query]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:py-10">
      <section className="content-rise rounded-[--radius-lg] border border-[var(--color-primary-200)] bg-[var(--color-surface)] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-4xl">Tìm kiếm từ điển</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
            Nhập kanji, kana, romaji hoặc nghĩa tiếng Việt. Gợi ý sẽ hiện ngay khi bạn gõ.
          </p>
          <div className="mt-2 w-full">
            <SearchInput onSearch={setQuery} initialValue={query} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <ListMagnifyingGlass size={16} />
          <span>
            {isReady ? (
              <>
                {query ? 'Kết quả cho ' : 'Từ phổ biến'} <strong className="text-[var(--color-text-primary)]">{query || results.length}</strong>
                {query ? <> - <strong className="text-[var(--color-text-primary)]">{results.length}</strong> mục</> : null}
              </>
            ) : (
              progress.message
            )}
          </span>
        </div>
        <span className="rounded-full bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-700)]">
          smart rank
        </span>
        <Button variant="secondary" size="sm" className="gap-2" disabled>
          <Funnel size={16} />
          Bộ lọc
        </Button>
      </div>

      {!isReady ? (
        <Card className="py-16 text-center text-[var(--color-text-secondary)]">{progress.message}</Card>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="skeleton-quiet h-36 rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface-subtle)]" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.slice(0, visible).map((result, index) => (
              <div key={result.term.id} className="result-enter" style={{ '--result-index': index % 18 } as CSSProperties}>
                <TermCard term={result.term} />
              </div>
            ))}
          </div>
          {visible < results.length && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisible((value) => value + PAGE_SIZE)}>
                Tải thêm
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card variant="default" className="flex flex-col items-center gap-4 py-20 text-center shadow-none">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]">
            <MagnifyingGlass size={32} />
          </div>
          <div>
            <p className="text-lg font-medium text-[var(--color-text-primary)]">Không tìm thấy kết quả</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Thử nhập dạng kanji, kana, romaji hoặc tiếng Việt không dấu.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
