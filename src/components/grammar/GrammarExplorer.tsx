'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import {
  GRAMMAR_LEVELS,
  type GrammarLevel,
  type GrammarListResponse,
  type GrammarPoint,
} from '@/types/grammar';
import { FEATURED_GRAMMAR_TAGS, formatGrammarTagVi } from '@/lib/grammar/tags';
import { GrammarDetailCard, GrammarLevelPill } from './GrammarDetailCard';
import { GrammarText } from './GrammarText';

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [level, setLevel] = useState<GrammarLevel | 'ALL'>(initialLevel);
  const [query, setQuery] = useState(initialQuery);
  const [tag, setTag] = useState(initialTag);
  const [data, setData] = useState<GrammarListResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(
    initialSelected || initialData.items[0]?.id || ''
  );

  const mobileDialogRef = useRef<HTMLDialogElement>(null);
  const isFirstRender = useRef(true);

  const totalAllLevels = useMemo(
    () => Object.values(data.countsByLevel).reduce((sum, n) => sum + n, 0),
    [data.countsByLevel]
  );

  // Sync URL query params when user filters or picks a grammar point
  useEffect(() => {
    const params = new URLSearchParams();
    if (level !== 'ALL') params.set('level', level);
    if (query.trim()) params.set('q', query.trim());
    if (tag) params.set('tag', tag);
    if (selectedId) params.set('selected', selectedId);
    const nextSearch = params.toString();
    const currentSearch = searchParams?.toString() || '';
    if (nextSearch !== currentSearch) {
      router.replace(nextSearch ? `/grammar?${nextSearch}` : '/grammar', { scroll: false });
    }
  }, [level, query, tag, selectedId, router, searchParams]);

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
        setSelectedId((prev) =>
          json.items.some((item) => item.id === prev) ? prev : (json.items[0]?.id ?? '')
        );
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
  }, [level, query, tag]);

  const selectedGrammar: GrammarPoint | null = useMemo(
    () => data.items.find((item) => item.id === selectedId) ?? data.items[0] ?? null,
    [data.items, selectedId]
  );

  const handleSelect = (item: GrammarPoint) => {
    setSelectedId(item.id);
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
            Hiển thị {data.items.length} / {data.total} mẫu
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
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm mẫu câu (vd: てもいい, に際して, vì nên, điều kiện)…"
              aria-label="Tìm kiếm mẫu ngữ pháp"
              className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-10 pr-9 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary-600)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Lọc theo cấp độ JLPT"
            className="grid grid-cols-3 gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1 sm:flex sm:flex-wrap sm:items-center"
          >
            <button
              type="button"
              role="tab"
              aria-selected={level === 'ALL'}
              onClick={() => setLevel('ALL')}
              className={`min-h-9 rounded-[var(--radius-sm)] px-3 text-xs font-semibold tabular-nums transition-colors ${
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
                  role="tab"
                  aria-selected={active}
                  onClick={() => setLevel(lvl)}
                  className={`min-h-9 rounded-[var(--radius-sm)] px-2.5 text-xs font-semibold tabular-nums transition-colors ${
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

        {/* Tag Filter Strip */}
        <div className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" role="group" aria-label="Lọc theo chủ điểm ngữ pháp">
          {tag && (
            <button
              type="button"
              onClick={() => setTag('')}
              className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full bg-[var(--color-action-primary)] px-3 text-xs font-semibold text-white"
            >
              {formatGrammarTagVi(tag)}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {FEATURED_GRAMMAR_TAGS.filter((t) => t !== tag).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t)}
              className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)]"
            >
              {formatGrammarTagVi(t)}
            </button>
          ))}
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* Left List */}
        <section aria-label="Danh sách mẫu ngữ pháp" className="min-w-0">
          {error ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <p className="text-sm font-medium text-[var(--color-error)]">{error}</p>
              <button
                type="button"
                onClick={() => setQuery((prev) => prev)}
                className="mt-3 rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 py-2 text-xs font-semibold text-white"
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
                  onClick={() => {
                    setQuery('');
                    setTag('');
                    setLevel('ALL');
                  }}
                  className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary-500)]"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div
              className={`overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-opacity ${
                loading ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <ul className="divide-y divide-[var(--color-border-subtle)]">
                {data.items.map((item) => {
                  const isSelected = selectedGrammar?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-action-primary)] sm:px-5 ${
                          isSelected
                            ? 'bg-[var(--color-primary-50)] shadow-[inset_3px_0_0_var(--color-primary-600)]'
                            : 'hover:bg-[var(--color-surface-subtle)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <GrammarText
                              text={item.pattern}
                              className="text-lg font-bold leading-snug text-[var(--color-text-primary)]"
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
          )}
        </section>

        {/* Right Sticky Inspector (Desktop) */}
        <aside aria-label="Chi tiết ngữ pháp" className="hidden lg:sticky lg:top-20 lg:block">
          {selectedGrammar ? (
            <GrammarDetailCard grammar={selectedGrammar} />
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
              Chọn một mẫu ngữ pháp bên trái để xem cấu trúc, sắc thái và ví dụ chi tiết.
            </div>
          )}
        </aside>
      </div>

      {/* Mobile / Tablet Modal Detail Sheet */}
      <dialog
        ref={mobileDialogRef}
        aria-label="Chi tiết ngữ pháp"
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
