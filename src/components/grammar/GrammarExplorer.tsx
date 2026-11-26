'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CaretLeft, CaretRight, MagnifyingGlass, X } from '@phosphor-icons/react';
import {
  GRAMMAR_LEVELS,
  type GrammarLevel,
  type GrammarListResponse,
  type GrammarPoint,
} from '@/types/grammar';
import { FEATURED_GRAMMAR_TAGS, formatGrammarTagVi } from '@/lib/grammar/tags';
import { GrammarDetailCard, GrammarLevelPill } from './GrammarDetailCard';
import { GrammarText } from './GrammarText';

// ponytail: client pagination over <=600 fetched items; move to server offset when dataset exceeds 600
export const GRAMMAR_PAGE_SIZE = 24;

export const GRAMMAR_TAG_GROUPS: ReadonlyArray<{ label: string; tags: readonly string[] }> = [
  {
    label: 'Quan hệ & nối câu',
    tags: ['condition', 'reason', 'contrast', 'concession', 'comparison', 'addition'],
  },
  {
    label: 'Trợ từ & thời gian',
    tags: ['particle', 'time'],
  },
  {
    label: 'Sắc thái & ý định',
    tags: ['obligation', 'conjecture', 'emotion'],
  },
  {
    label: 'Văn phong & kính ngữ',
    tags: ['formal', 'written', 'politeness', 'keigo'],
  },
];

const GROUPED_TAG_SET = new Set(GRAMMAR_TAG_GROUPS.flatMap((group) => group.tags));

export function clampGrammarPage(
  page: number,
  totalItems: number,
  pageSize = GRAMMAR_PAGE_SIZE
): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), totalPages);
}

export function findGrammarPage(
  items: readonly Pick<GrammarPoint, 'id' | 'slug'>[],
  selected: string,
  pageSize = GRAMMAR_PAGE_SIZE
): number {
  if (!selected) return 1;
  const idx = items.findIndex((item) => item.id === selected || item.slug === selected);
  return idx >= 0 ? Math.floor(idx / pageSize) + 1 : 1;
}

interface GrammarExplorerProps {
  initialData: GrammarListResponse;
  initialLevel?: GrammarLevel | 'ALL';
  initialQuery?: string;
  initialTag?: string;
  initialSelected?: string;
}

export function GrammarExplorer({
  initialData,
  initialLevel = 'ALL',
  initialQuery = '',
  initialTag = '',
  initialSelected = '',
}: GrammarExplorerProps) {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState<GrammarLevel | 'ALL'>(initialLevel);
  const [query, setQuery] = useState(initialQuery);
  const [tag, setTag] = useState(initialTag);
  const [data, setData] = useState<GrammarListResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedId, setSelectedId] = useState(initialSelected);
  const [page, setPage] = useState<number | null>(null);

  const mobileDialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const topicSelectRef = useRef<HTMLSelectElement>(null);
  const pageSelectRef = useRef<HTMLSelectElement>(null);
  const isFirstRender = useRef(true);

  const totalAllLevels = useMemo(
    () => Object.values(data.countsByLevel).reduce((sum, n) => sum + n, 0),
    [data.countsByLevel]
  );

  const extraFeaturedTags = useMemo(
    () => FEATURED_GRAMMAR_TAGS.filter((t) => !GROUPED_TAG_SET.has(t)),
    []
  );

  const hasCustomTag = Boolean(tag && !GROUPED_TAG_SET.has(tag) && !extraFeaturedTags.includes(tag));

  const currentSearch = searchParams.toString();
  const observedSearch = useRef(currentSearch);
  const writtenSearch = useRef<string | null>(null);
  useEffect(() => {
    if (currentSearch === observedSearch.current || currentSearch !== new URLSearchParams(window.location.search).toString()) return;
    observedSearch.current = currentSearch;
    const wasLocalChange = writtenSearch.current === currentSearch;
    writtenSearch.current = null;
    if (wasLocalChange) return;

    const params = new URLSearchParams(currentSearch);
    const nextLevel = params.get('level')?.toUpperCase();
    setLevel(GRAMMAR_LEVELS.find((item) => item === nextLevel) ?? 'ALL');
    setQuery(params.get('q') ?? '');
    setTag(params.get('tag') ?? '');
    setSelectedId(params.get('selected') ?? '');
    setPage(null);
  }, [currentSearch]);

  function replaceFilters(nextLevel: GrammarLevel | 'ALL', nextQuery: string, nextTag: string, nextSelected = '') {
    const params = new URLSearchParams();
    if (nextLevel !== 'ALL') params.set('level', nextLevel);
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    if (nextTag) params.set('tag', nextTag);
    if (nextSelected) params.set('selected', nextSelected);
    const nextSearch = params.toString();
    if (nextSearch === window.location.search.slice(1)) return;
    writtenSearch.current = nextSearch;
    window.history.replaceState(null, '', nextSearch ? `/grammar?${nextSearch}` : '/grammar');
  }

  // Fetch filtered grammar list from /api/grammar on filter change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (level !== 'ALL') params.set('level', level);
        if (query.trim()) params.set('q', query.trim());
        if (tag) params.set('tag', tag);
        params.set('limit', '600');

        const res = await fetch(`/api/grammar?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as GrammarListResponse;
        if (controller.signal.aborted) return;

        setData(json);
        setPage((prev) => prev === null ? null : clampGrammarPage(prev, json.items.length));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách ngữ pháp.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 180 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [level, query, tag, retryKey]);

  const totalPages = Math.max(1, Math.ceil(data.items.length / GRAMMAR_PAGE_SIZE));
  const currentPage = page ?? findGrammarPage(data.items, selectedId);
  const pageStartIndex = (currentPage - 1) * GRAMMAR_PAGE_SIZE;
  const pageItems = useMemo(
    () => data.items.slice(pageStartIndex, pageStartIndex + GRAMMAR_PAGE_SIZE),
    [data.items, pageStartIndex]
  );
  const rangeStart = data.items.length === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd = Math.min(pageStartIndex + pageItems.length, data.items.length);

  const selectedGrammar: GrammarPoint | null = useMemo(
    () =>
      data.items.find((item) => item.id === selectedId || item.slug === selectedId) ??
      pageItems[0] ??
      null,
    [data.items, pageItems, selectedId]
  );

  const changeFilters = (nextLevel: GrammarLevel | 'ALL', nextQuery: string, nextTag: string) => {
    setLevel(nextLevel);
    setQuery(nextQuery);
    setTag(nextTag);
    setSelectedId('');
    setPage(null);
    replaceFilters(nextLevel, nextQuery, nextTag);
  };

  const handleLevelChange = (nextLevel: GrammarLevel | 'ALL') => changeFilters(nextLevel, query, tag);
  const handleQueryChange = (nextQuery: string) => changeFilters(level, nextQuery, tag);
  const handleTagChange = (nextTag: string) => changeFilters(level, query, nextTag);

  const handleResetFilters = () => {
    changeFilters('ALL', '', '');
    searchInputRef.current?.focus();
  };

  const goToPage = (nextPage: number, focusSelectOnBoundary = false) => {
    const clamped = clampGrammarPage(nextPage, data.items.length, GRAMMAR_PAGE_SIZE);
    setPage(clamped);
    setSelectedId('');
    replaceFilters(level, query, tag);
    if (focusSelectOnBoundary && (clamped === 1 || clamped === totalPages)) {
      pageSelectRef.current?.focus();
    }

  };

  const handleSelect = (item: GrammarPoint) => {
    setSelectedId(item.id);
    replaceFilters(level, query, tag, item.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      mobileDialogRef.current?.showModal();
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Editorial header */}
      <header className="border-b border-[var(--color-border)] pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
              Ngữ pháp JLPT
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Tra cứu {totalAllLevels || data.total} mẫu ngữ pháp N5–N1 kèm cấu trúc kết hợp, sắc thái và câu ví dụ có Furigana.
            </p>
          </div>
          <span className="text-xs font-medium tabular-nums text-[var(--color-text-muted)]">
            {data.items.length === 0
              ? `Hiển thị 0 / ${data.total} mẫu`
              : `Hiển thị ${rangeStart}–${rangeEnd} / ${data.items.length} mẫu`}
          </span>
        </div>

        {/* Search + Level Filter */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Tìm mẫu ngữ pháp, nghĩa tiếng Việt hoặc romaji (vd: ている, ながら, mặc dù)…"
              aria-label="Tìm mẫu ngữ pháp"
              className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-10 pr-9 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary-600)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  handleQueryChange('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Lọc theo cấp độ JLPT"
            className="grid grid-cols-3 gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1 sm:flex sm:flex-wrap sm:items-center"
          >
            <button
              type="button"
              aria-pressed={level === 'ALL'}
              onClick={() => handleLevelChange('ALL')}
              className={`min-h-11 min-w-11 rounded-[var(--radius-sm)] sm:min-h-9 sm:min-w-0 px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)] ${
                level === 'ALL'
                  ? 'bg-[var(--color-surface)] text-[var(--color-primary-700)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Tất cả ({totalAllLevels})
            </button>
            {GRAMMAR_LEVELS.map((lvl) => {
              const active = level === lvl;
              const count = data.countsByLevel[lvl] ?? 0;
              return (
                <button
                  key={lvl}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleLevelChange(lvl)}
                  className={`min-h-11 min-w-11 rounded-[var(--radius-sm)] sm:min-h-9 sm:min-w-0 px-2.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)] ${
                    active
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary-700)] shadow-[var(--shadow-xs)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {lvl}
                  <span className="ml-1 opacity-65">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grouped topic filter (native select with optgroup) */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label
            htmlFor="grammar-topic-filter"
            className="text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Chủ điểm
          </label>
          <select
            id="grammar-topic-filter"
            ref={topicSelectRef}
            value={tag}
            onChange={(e) => handleTagChange(e.target.value)}
            aria-label="Lọc theo chủ điểm ngữ pháp"
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary-600)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)] sm:w-auto sm:min-w-56"
          >
            <option value="">Tất cả chủ điểm</option>
            {hasCustomTag && (
              <option value={tag}>{formatGrammarTagVi(tag)}</option>
            )}
            {GRAMMAR_TAG_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.tags.map((t) => (
                  <option key={t} value={t}>
                    {formatGrammarTagVi(t)}
                  </option>
                ))}
              </optgroup>
            ))}
            {extraFeaturedTags.length > 0 && (
              <optgroup label="Chủ điểm khác">
                {extraFeaturedTags.map((t) => (
                  <option key={t} value={t}>
                    {formatGrammarTagVi(t)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {tag && (
            <button
              type="button"
              onClick={() => {
                handleTagChange('');
                topicSelectRef.current?.focus();
              }}
              aria-label="Xóa bộ lọc chủ điểm"
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
            >
              <X size={14} aria-hidden="true" />
              Xóa chủ điểm
            </button>
          )}
        </div>
      </header>

      {/* Main Master-Detail Split */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* Left: paginated list */}
        <section aria-label="Danh sách mẫu ngữ pháp" className="min-w-0">
          {error ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <p className="text-sm font-medium text-[var(--color-error)]">{error}</p>
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="mt-3 min-h-11 rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
              >
                Thử lại
              </button>
            </div>
          ) : data.items.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
              <p className="text-base font-semibold text-[var(--color-text-primary)]">
                Không tìm thấy mẫu ngữ pháp phù hợp
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Thử xóa bộ lọc chủ điểm hoặc đổi sang cấp độ JLPT khác.
              </p>
              {(query || tag || level !== 'ALL') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary-500)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          ) : (
            <>
              {totalPages > 1 && (
                <nav
                  aria-label="Phân trang ngữ pháp"
                  className="mb-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => goToPage(currentPage - 1, true)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary-400)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
                  >
                    <CaretLeft size={14} aria-hidden="true" />
                    Trước
                  </button>

                  <div className="flex items-center gap-2">
                    <label htmlFor="grammar-page-select" className="sr-only">
                      Chọn trang ngữ pháp
                    </label>
                    <select
                      id="grammar-page-select"
                      ref={pageSelectRef}
                      value={currentPage}
                      onChange={(e) => goToPage(Number(e.target.value), false)}
                      aria-label="Chọn trang ngữ pháp"
                      className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold tabular-nums text-[var(--color-text-primary)] focus:border-[var(--color-primary-600)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
                    >
                      {Array.from({ length: totalPages }, (_, index) => {
                        const pageNum = index + 1;
                        return (
                          <option key={pageNum} value={pageNum}>
                            Trang {pageNum} / {totalPages}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => goToPage(currentPage + 1, true)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary-400)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
                  >
                    Sau
                    <CaretRight size={14} aria-hidden="true" />
                  </button>
                </nav>
              )}
              <div
                className={`overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-opacity ${
                  loading ? 'opacity-60' : 'opacity-100'
                }`}
              >
                <ul className="divide-y divide-[var(--color-border-subtle)]">
                  {pageItems.map((item) => {
                    const isSelected = selectedGrammar?.id === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          aria-current={isSelected ? 'true' : undefined}
                          className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-action-primary)] sm:px-5 ${
                            isSelected
                              ? 'bg-[var(--color-primary-50)] ring-1 ring-inset ring-[var(--color-primary-200)]'
                              : 'hover:bg-[var(--color-surface-subtle)]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <GrammarText
                                text={item.pattern}
                                className={`text-lg font-bold leading-snug ${
                                  isSelected
                                    ? 'text-[var(--color-primary-700)]'
                                    : 'text-[var(--color-text-primary)]'
                                }`}
                              />
                              <GrammarLevelPill level={item.level} />
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-[var(--color-text-secondary)]">
                              {item.meaningVi}
                            </p>
                            {item.formation && (
                              <p className="mt-1 line-clamp-1 text-xs text-[var(--color-text-muted)]">
                                <GrammarText text={item.formation} />
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </section>

        {/* Right: sticky detail inspector on desktop */}
        <aside aria-label="Chi tiết mẫu ngữ pháp" className="hidden lg:sticky lg:top-20 lg:block">
          {selectedGrammar ? (
            <GrammarDetailCard grammar={selectedGrammar} />
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
              Chọn một mẫu ngữ pháp ở danh sách bên trái để xem chi tiết.
            </div>
          )}
        </aside>
      </div>

      {/* Mobile / tablet detail modal */}
      <dialog
        ref={mobileDialogRef}
        aria-label="Chi tiết mẫu ngữ pháp"
        onClick={(e) => {
          if (e.target === e.currentTarget) mobileDialogRef.current?.close();
        }}
        className="m-auto max-h-[88dvh] w-[min(94vw,560px)] overflow-y-auto rounded-[var(--radius-lg)] bg-transparent p-0 backdrop:bg-black/50"
      >
        {selectedGrammar && (
          <GrammarDetailCard
            grammar={selectedGrammar}
            onClose={() => mobileDialogRef.current?.close()}
            className="shadow-[var(--shadow-lg)]"
          />
        )}
      </dialog>
    </div>
  );
}
