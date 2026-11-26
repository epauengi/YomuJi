'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CaretRight,
  ClockCounterClockwise,
  Scan,
  Sparkle,
  Trash,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { SearchInput } from '@/components/SearchInput';
import { TermCard } from '@/components/dictionary/TermCard';
import { ConjugationAnalysis } from '@/components/dictionary/ConjugationAnalysis';
import { NameDictionaryBanner, NameResults } from '@/components/dictionary/NameResults';
import { SentenceAnalysis } from '@/components/dictionary/SentenceAnalysis';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { AudioButton } from '@/components/AudioButton';
import { useDictionary, searchDictionary, getWordOfTheDay } from '@/lib/mockDictionary';
import { Button } from '@/components/ui/Button';
import { searchHref } from '@/lib/navigation';
import { wordHref } from '@/lib/wordRoutes';
import { termBookmark } from '@/lib/browserState';
import { readRecentSearches, removeRecentSearches, restoreRecentSearches } from '@/lib/recentSearches';
import { books } from '@/data/books';
import type { DictionarySearchResult, TermRecord } from '@/types/dictionary';

// ponytail: Keep the hero decoration static; add motion only if it improves the lookup experience.
const decorativeKanji = [
  { char: '学', top: '15%', left: '8%', size: 'text-5xl md:text-6xl', opacity: 'opacity-[0.14]' },
  { char: '語', top: '18%', right: '10%', size: 'text-6xl md:text-7xl', opacity: 'opacity-[0.14]' },
  { char: '辞', top: '65%', left: '10%', size: 'text-5xl md:text-6xl', opacity: 'opacity-[0.12]' },
  { char: '日', top: '60%', right: '12%', size: 'text-5xl md:text-6xl', opacity: 'opacity-[0.14]' },
];

const suggestionChips = ['食べる', '日本', '勉強', 'học tập'];

const featuredBook = Array.isArray(books)
  ? (books.find((book) => book.slug === 'chumon-no-ooi-ryoriten') ?? books[0] ?? null)
  : null;

function readStoredRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return readRecentSearches();
  } catch (err) {
    console.error('Failed to read search history:', err);
  }
  return [];
}

export function HomePage({ initialQuery, returnFocus }: { initialQuery: string; returnFocus?: string }) {
  const router = useRouter();
  const { progress } = useDictionary();
  const query = initialQuery.trim();
  const hasQuery = Boolean(query);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [settledSearch, setSettledSearch] = useState<{
    query: string;
    attempt: number;
    results: DictionarySearchResult[] | null;
  } | null>(null);
  const search = settledSearch?.query === query && settledSearch.attempt === searchAttempt ? settledSearch : null;
  const loading = !search;
  const results = search?.results;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const restoredFocus = useRef<string | null>(null);
  const [settledAnalysisQuery, setSettledAnalysisQuery] = useState<string | null>(null);
  const [sentenceShown, setSentenceShown] = useState(false);

  useEffect(() => {
    if (!query || !returnFocus) {
      restoredFocus.current = null;
      return;
    }
    if (loading) return;
    const key = JSON.stringify([query, returnFocus]);
    if (restoredFocus.current === key) return;
    const heading = resultsHeadingRef.current;
    const candidate = document.getElementById(returnFocus);
    const result = candidate instanceof HTMLAnchorElement && heading?.closest('section')?.contains(candidate) ? candidate : null;
    // Wait for conjugation results above the grid so they cannot shift the restored card.
    if (results && returnFocus.includes('-result-') && settledAnalysisQuery !== query) return;
    const target = result ?? heading;
    if (!target) return;
    restoredFocus.current = key;
    if (document.activeElement && document.activeElement !== document.body) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: result ? 'center' : 'start', behavior: 'instant' });
  }, [query, returnFocus, loading, results, settledAnalysisQuery]);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [wordOfTheDay, setWordOfTheDay] = useState<TermRecord | null>(null);
  const [wordLoading, setWordLoading] = useState(true);
  const [wordError, setWordError] = useState<string | null>(null);
  const [wordRetryKey, setWordRetryKey] = useState(0);

  const commitSearch = (value: string) => {
    if (value === query && value) {
      setSearchAttempt((attempt) => attempt + 1);
    } else {
      router.push(searchHref(value));
    }
  };

  // ponytail: Tiny retry counter triggers effect reload; upgrade to query client when server sync needed.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);
    setWordLoading(true);
    setWordError(null);

    getWordOfTheDay(controller.signal)
      .then((term) => {
        if (!active) return;
        if (term) {
          setWordOfTheDay(term);
          setWordError(null);
        } else {
          setWordOfTheDay(null);
          setWordError('Chưa có dữ liệu từ vựng hôm nay.');
        }
        setWordLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Word of the day error:', err);
        setWordOfTheDay(null);
        setWordError('Chưa thể tải từ vựng hôm nay. Vui lòng thử lại.');
        setWordLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      active = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [wordRetryKey]);

  const handleRetryWord = () => {
    setWordRetryKey((prev) => prev + 1);
  };

  useEffect(() => {
    const syncSearches = () => {
      setRecentSearches(readStoredRecentSearches());
    };
    syncSearches();

    window.addEventListener('yomuji:recent_searches', syncSearches);
    return () => {
      window.removeEventListener('yomuji:recent_searches', syncSearches);
    };
  }, []);

  const addRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const stored = readStoredRecentSearches();
      const base = stored.length > 0 ? Array.from(new Set([...stored, ...prev])) : prev;
      const next = [trimmed, ...base.filter((item) => item !== trimmed)].slice(0, 8);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('yomuji_recent_searches', JSON.stringify(next));
        } catch (err) {
          console.error('Failed to save search history:', err);
        }
      }
      return next;
    });
  };

  const clearRecentSearches = () => {
    try {
      const { searches, removed } = removeRecentSearches();
      setRecentSearches(searches);
      if (!removed.length) return;
      toast.success('Đã xóa lịch sử tìm kiếm', {
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            try {
              setRecentSearches(restoreRecentSearches(removed));
            } catch (err) {
              console.error('Failed to restore search history:', err);
              toast.error('Không thể khôi phục lịch sử trên thiết bị.');
            }
          },
        },
      });
    } catch (err) {
      console.error('Failed to clear search history:', err);
      toast.error('Không thể xóa lịch sử trên thiết bị.');
    }
  };

  useEffect(() => {
    if (!query) {
      setSettledSearch(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setSettledSearch(null);
    const timeout = window.setTimeout(() => {
      controller.abort();
      setSettledSearch({ query, attempt: searchAttempt, results: null });
    }, 15_000);
    searchDictionary(query, 12, controller.signal)
      .then((next) => {
        if (cancelled || controller.signal.aborted) return;
        setSettledSearch({ query, attempt: searchAttempt, results: next });
        addRecentSearch(query);
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        console.error('Home search error:', error);
        setSettledSearch({ query, attempt: searchAttempt, results: null });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, searchAttempt]);

  return (
    <div className="pb-16">
      <section
        className={`relative z-20 overflow-visible border-b text-white ${hasQuery ? 'border-[var(--color-border)] bg-[var(--color-surface)] py-4 sm:py-6' : 'border-teal-950/30 bg-[#123b36] py-10 sm:py-12 md:py-14'}`}
      >
        {/* Subtle Static Japanese Marks */}
        {!hasQuery && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {decorativeKanji.map((item, index) => (
            <span
              key={`${item.char}-${index}`}
              aria-hidden="true"
              style={{
                top: item.top,
                left: item.left,
                right: item.right,
              }}
              className={`absolute select-none jp-text font-black leading-none text-white ${item.size} ${item.opacity}`}
            >
              {item.char}
            </span>
          ))}
        </div>}

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center justify-center px-4 text-center">
          <h1 className={hasQuery ? 'sr-only' : 'max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl'}>
            Tra nhanh, hiểu sâu <span className="text-teal-200">tiếng Nhật</span>
          </h1>

          {!hasQuery && <p id="dictionary-search-intro" className="mt-3 max-w-xl text-sm leading-6 text-teal-50/85 sm:text-base">
            Nhập Kanji, kana, romaji hoặc nghĩa tiếng Việt.
          </p>}

          <div className={`${hasQuery ? '' : 'mt-6 '}w-full max-w-[800px] text-left`}>
            <SearchInput
              onSearch={commitSearch}
              initialValue={query}
              inputRef={searchInputRef}
              describedBy={hasQuery ? 'dictionary-search-hint' : 'dictionary-search-intro'}
              placeholder="Tra từ hoặc Kanji"
            />
            {hasQuery && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
                <p id="dictionary-search-hint" className="text-sm text-[var(--color-text-secondary)]">
                  Nhập Kanji, kana, romaji hoặc nghĩa tiếng Việt.
                </p>
                <Link
                  href="/ocr"
                  className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[var(--color-primary-700)] transition-colors hover:text-[var(--color-primary-800)] hover:underline"
                >
                  <Scan size={16} aria-hidden="true" />
                  Tra từ bằng ảnh
                </Link>
              </div>
            )}

            {!hasQuery && (
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-teal-50/80">
                <span className="text-teal-100">Thử tìm:</span>
                {suggestionChips.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => commitSearch(word)}
                    className="tactile min-h-11 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-teal-50 hover:border-teal-200/60 hover:bg-white/20 focus-visible:outline-white"
                  >
                    {word}
                  </button>
                ))}
                <Link
                  href="/ocr"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-teal-100 transition-colors hover:border-teal-200/50 hover:bg-white/10 hover:text-white focus-visible:outline-white"
                >
                  <Scan size={15} aria-hidden="true" />
                  Tra từ bằng ảnh
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={`mx-auto max-w-[1120px] px-4 ${hasQuery ? 'py-6' : 'py-8'}`}>
        {hasQuery ? (
          <div>
          <section aria-labelledby="dictionary-results-heading">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 id="dictionary-results-heading" ref={resultsHeadingRef} tabIndex={-1} className="break-words text-xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
                  {sentenceShown ? 'Phân tích câu' : <>Kết quả tra cứu cho &ldquo;{query}&rdquo;</>}
                </h2>
                {!sentenceShown && <p role="status" className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {loading ? 'Đang tra trong từ điển…' : results?.length ? `Hiển thị ${results.length} mục từ` : !results ? 'Chưa thể tra cứu.' : 'Không tìm thấy mục từ phù hợp.'}
                </p>}
              </div>
              <a
                href="#name-results-heading"
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)]"
              >
                Tên riêng
              </a>
            </div>

            {results && <SentenceAnalysis query={query} results={results} onShown={setSentenceShown} />}
            {results && <ConjugationAnalysis key={query} query={query} results={results} onSettled={setSettledAnalysisQuery} />}
            <div aria-busy={loading}>
              {results && progress.source === 'offline' && (
                <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-xs text-[var(--color-text-secondary)]">
                  Máy chủ chưa sẵn sàng — đang hiển thị kết quả từ dữ liệu offline trên thiết bị.
                </div>
              )}
              {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="skeleton-quiet h-36 rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)]" />
                  ))}
                </div>
              ) : !results ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-[var(--color-text-secondary)] sm:p-8">
                  <p className="text-sm">Kiểm tra kết nối rồi thử lại. Truy vấn của bạn vẫn được giữ.</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    <Button type="button" variant="secondary" onClick={() => {
                      resultsHeadingRef.current?.focus({ preventScroll: true });
                      setSearchAttempt((attempt) => attempt + 1);
                    }}>Thử lại</Button>
                    {progress.status !== 'downloading' && progress.status !== 'indexing' && (
                      <Link href="/settings" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary-700)] hover:underline">
                        Tải dữ liệu offline
                      </Link>
                    )}
                  </div>
                </div>
              ) : results.length > 0 ? (
                <>
                  {sentenceShown && <h3 className="mb-3 text-sm font-bold text-[var(--color-text-secondary)]">Mục từ khớp với cả câu</h3>}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {results.map(({ term, matchType }) => (
                      <TermCard key={term.id} term={term} matchType={matchType} query={query} origin={{ query }} />
                    ))}
                  </div>
                </>
              ) : sentenceShown ? null : (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-text-secondary)]">
                  <p className="text-sm">
                    Kiểm tra chính tả hoặc thử lại bằng kana, romaji hay nghĩa tiếng Việt.
                  </p>
                  <Button type="button" variant="secondary" className="mt-4" onClick={() => searchInputRef.current?.focus()}>
                    Sửa truy vấn
                  </Button>
                </div>
              )}
            </div>
          </section>
          <NameResults query={query} attempt={searchAttempt} showOfflineDownload />
          </div>
        ) : (
          <div className="space-y-10">
            {recentSearches.length > 0 && (
              <section aria-label="Tìm kiếm gần đây">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-secondary)]">
                    <ClockCounterClockwise size={18} weight="bold" className="text-[var(--color-primary-700)]" />
                    <span>Tìm kiếm gần đây</span>
                  </h2>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    aria-label="Xóa toàn bộ lịch sử tìm kiếm"
                    className="flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-error)]"
                  >
                    <Trash aria-hidden="true" size={14} />
                    <span>Xóa lịch sử</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => commitSearch(item)}
                      className="surface-lift min-h-11 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-text-primary)] transition-all hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface-subtle)]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Word of the day + Featured Aozora excerpt */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2.2fr)] items-stretch">
              <article className="flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="inline-flex items-center gap-2 rounded-full bg-[var(--color-warning-bg)] px-3.5 py-1 text-xs font-extrabold text-[var(--color-warning)]">
                      <Sparkle aria-hidden="true" size={15} weight="fill" className="text-[var(--color-warning)]" />
                      Từ vựng hôm nay
                    </h2>
                    {wordOfTheDay ? (
                      <div className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-bold text-[var(--color-text-secondary)]">
                        {wordOfTheDay.isCommon ? 'Từ vựng phổ biến' : 'Từ vựng'}
                      </div>
                    ) : wordLoading ? (
                      <div className="skeleton-quiet h-6 w-24 rounded-full bg-[var(--color-surface-subtle)]" />
                    ) : null}
                  </div>

                  {wordLoading ? (
                    <div className="mt-5 space-y-3" role="status" aria-label="Đang tải từ vựng hôm nay" aria-busy="true">
                      <div className="skeleton-quiet h-10 w-full rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)]" />
                      <div className="skeleton-quiet h-6 w-full rounded-[--radius-sm] bg-[var(--color-surface-subtle)]" />
                      <div className="skeleton-quiet h-16 w-full rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)]" />
                      <span className="sr-only">Đang tải từ vựng hôm nay...</span>
                    </div>
                  ) : wordError || !wordOfTheDay ? (
                    <div className="mt-8 flex flex-col items-center justify-center py-6 text-center" role="alert">
                      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {wordError || 'Chưa thể tải từ vựng hôm nay.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleRetryWord}
                        className="tactile mt-4 inline-flex min-h-11 min-w-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-bold text-[var(--color-primary-700)] transition-colors hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-600)]"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h3 lang="ja" className="jp-text break-keep [overflow-wrap:anywhere] text-3xl sm:text-4xl font-extrabold text-[var(--color-primary-600)]">
                              {wordOfTheDay.surface}
                            </h3>
                            {wordOfTheDay.reading && wordOfTheDay.reading !== wordOfTheDay.surface && (
                              <span lang="ja" className="jp-text text-base font-semibold text-[var(--color-text-secondary)]">
                                {wordOfTheDay.reading}
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
                            {wordOfTheDay.meaningsVi.join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <AudioButton text={wordOfTheDay.surface} label="Phát âm" variant="icon-only" />
                          <BookmarkButton item={termBookmark(wordOfTheDay)} />
                        </div>
                      </div>

                      {wordOfTheDay.examples && wordOfTheDay.examples.length > 0 && (
                        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5">
                          <p lang="ja" className="jp-text text-sm font-semibold text-[var(--color-text-primary)]">
                            {wordOfTheDay.examples[0].textJa}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                            {wordOfTheDay.examples[0].textVi}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {wordLoading ? (
                  <div className="mt-6 flex justify-end border-t border-[var(--color-border-subtle)] pt-3">
                    <div className="skeleton-quiet h-5 w-36 rounded-[--radius-sm] bg-[var(--color-surface-subtle)]" />
                  </div>
                ) : wordOfTheDay ? (
                  <div className="mt-6 flex justify-end border-t border-[var(--color-border-subtle)] pt-3">
                    <Link
                      href={wordHref(wordOfTheDay)}
                      className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--color-primary-700)] transition-colors hover:text-[var(--color-primary-800)]"
                    >
                      Xem chi tiết từ vựng
                      <CaretRight aria-hidden="true" size={14} weight="bold" />
                    </Link>
                  </div>
                ) : null}
              </article>

              {/* Featured Aozora Excerpt */}
              {featuredBook && (
                <article className="flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-50)] px-3.5 py-1 text-xs font-extrabold text-[var(--color-primary-700)]">
                        <BookOpen aria-hidden="true" size={15} weight="duotone" />
                        Đọc thử từ tủ sách
                      </h2>
                      {featuredBook.minutes && (
                        <span className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                          ~{featuredBook.minutes} phút
                        </span>
                      )}
                    </div>

                    <h3 lang="ja" className="jp-text mt-5 text-xl font-extrabold leading-snug text-[var(--color-text-primary)]">
                      {featuredBook.japaneseTitle}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                      {featuredBook.title} · <span lang="ja" className="jp-text">{featuredBook.author}</span> ({featuredBook.romanizedAuthor})
                    </p>

                    <blockquote
                      lang="ja"
                      className="jp-text mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-[15px] leading-8 text-[var(--color-text-primary)]"
                    >
                      {featuredBook.excerpt}
                    </blockquote>

                    <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                      {featuredBook.intro}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-3">
                    <Link
                      href="/books"
                      className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-700)]"
                    >
                      Tủ sách Aozora
                    </Link>
                    <Link
                      href={`/books/${featuredBook.slug}#excerpt`}
                      className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--color-primary-700)] transition-colors hover:text-[var(--color-primary-800)]"
                    >
                      Đọc đoạn trích
                      <CaretRight aria-hidden="true" size={14} weight="bold" />
                    </Link>
                  </div>
                </article>
              )}
            </div>

            <NameDictionaryBanner onSelectQuery={commitSearch} />
          </div>
        )}
      </div>
    </div>
  );
}
