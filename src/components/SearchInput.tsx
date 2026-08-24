'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyReturn, MagnifyingGlass, Sparkle, X } from '@phosphor-icons/react';
import { searchDictionary, searchKanjiDictionary } from '@/lib/mockDictionary';
import type { DictionarySearchResult, KanjiDictionarySearchResult } from '@/types/dictionary';

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
}

type CommandItem =
  | { kind: 'term'; id: string; href: string; result: DictionarySearchResult }
  | { kind: 'kanji'; id: string; href: string; result: KanjiDictionarySearchResult };

export function SearchInput({
  onSearch,
  placeholder = 'Tìm kiếm từ vựng, kanji...',
  className = '',
  initialValue = '',
}: SearchInputProps) {
  const router = useRouter();
  const listboxId = useId();
  const statusId = useId();
  const [query, setQuery] = useState(initialValue);
  const [termSuggestions, setTermSuggestions] = useState<DictionarySearchResult[]>([]);
  const [kanjiSuggestions, setKanjiSuggestions] = useState<KanjiDictionarySearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isResolving, setIsResolving] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setTermSuggestions([]);
      setKanjiSuggestions([]);
      setActiveIndex(-1);
      setSearchFailed(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsResolving(true);
      setSearchFailed(false);
      try {
        const [terms, kanji] = await Promise.all([
          searchDictionary(trimmed, 7),
          searchKanjiDictionary(trimmed, 5),
        ]);
        if (!cancelled) {
          setTermSuggestions(terms || []);
          setKanjiSuggestions(kanji || []);
          setActiveIndex(terms.length + kanji.length ? 0 : -1);
        }
      } catch (err) {
        console.error('Search error:', err);
        if (!cancelled) {
          setTermSuggestions([]);
          setKanjiSuggestions([]);
          setActiveIndex(-1);
          setSearchFailed(true);
        }
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    }, 90);

    return () => {
      cancelled = true;
      setIsResolving(false);
      clearTimeout(timer);
    };
  }, [query]);

  const commandItems = useMemo<CommandItem[]>(() => [
    ...termSuggestions.map((result) => ({
      kind: 'term' as const,
      id: `term-${result.term.id}`,
      href: `/word/${encodeURIComponent(result.term.id)}`,
      result,
    })),
    ...kanjiSuggestions.map((result) => ({
      kind: 'kanji' as const,
      id: `kanji-${result.kanji.literal}`,
      href: `/kanji/${encodeURIComponent(result.kanji.literal)}`,
      result,
    })),
  ], [termSuggestions, kanjiSuggestions]);

  const activeItem = activeIndex >= 0 ? commandItems[activeIndex] : commandItems[0];
  const hasQuery = query.trim().length >= 1;
  const showPanel = isFocused && hasQuery && !isResolving;
  const showSuggestions = showPanel && commandItems.length > 0;
  const resultStatus = !hasQuery
    ? ''
    : isResolving
      ? 'Đang tìm trong từ điển'
      : searchFailed
        ? 'Chưa thể tải gợi ý tìm kiếm'
        : commandItems.length
          ? `${commandItems.length} kết quả từ điển`
          : 'Không có kết quả phù hợp';

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onSearch(trimmed);
    setIsFocused(false);
  };

  const handleClear = () => {
    setQuery('');
    setTermSuggestions([]);
    setKanjiSuggestions([]);
    setActiveIndex(-1);
    setSearchFailed(false);
    onSearch('');
  };

  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setIsFocused(true);
  };

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setIsFocused(false), 200);
  };

  const openActiveItem = () => {
    if (!activeItem) return;
    router.push(activeItem.href);
  };

  return (
    <form
      onSubmit={handleSearch}
      className={`search-shell group relative z-50 mx-auto flex w-full max-w-[800px] items-center rounded-[--radius-lg] border bg-[var(--color-surface)] p-0 transition-[border-color,box-shadow] duration-[--duration-fast] ${
        isFocused
          ? 'border-[var(--color-primary-400)]'
          : 'border-[var(--color-border-strong)] hover:border-[var(--color-primary-400)]'
      } ${className}`}
    >
      {/* Left Search Icon */}
      <div className="pl-4 flex shrink-0 items-center justify-center text-[var(--color-primary-700)]">
        <MagnifyingGlass aria-hidden="true" size={22} weight="bold" />
      </div>

      {/* Main Input Element */}
      <div className="relative flex min-w-0 flex-1 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || 'Nhập Kanji, kana, romaji hoặc nghĩa tiếng Việt...'}
          className="h-13 w-full min-w-0 border-0 bg-transparent px-3 text-base text-[var(--color-text-primary)] shadow-none outline-none placeholder:text-[var(--color-text-muted)]"
          role="combobox"
          aria-label="Tra từ vựng hoặc Kanji"
          autoComplete="off"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-describedby={statusId}
          aria-autocomplete="list"
          aria-activedescendant={showSuggestions && activeItem ? activeItem.id : undefined}
          onKeyDown={(e) => {
            if (!showSuggestions) {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
              return;
            }

            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((value) => Math.min(value + 1, commandItems.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((value) => Math.max(value - 1, 0));
            } else if (e.key === 'Escape') {
              setIsFocused(false);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              openActiveItem();
            }
          }}
        />

        {/* Status indicator or Clear button inside input */}
        <div className="mr-3 flex shrink-0 items-center gap-1.5">
          {isResolving && (
            <span aria-hidden="true" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary-600)]">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[var(--color-primary-600)]" />
            </span>
          )}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-offset-0"
              aria-label="Xóa nội dung tìm kiếm"
            >
              <X aria-hidden="true" size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Embedded Flush Right Search Button */}
      <button
        type="submit"
        disabled={!hasQuery}
        aria-label="Tìm kiếm"
        className="h-13 shrink-0 rounded-r-[--radius-lg] border-0 bg-[var(--color-action-primary)] px-5 font-semibold text-white transition-colors duration-[--duration-fast] hover:bg-[var(--color-action-primary-hover)] active:bg-[var(--color-action-primary-active)] focus-visible:outline-offset-[-4px] focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-7"
      >
        <span className="hidden sm:inline">Tìm kiếm</span>
        <MagnifyingGlass aria-hidden="true" size={18} className="sm:hidden" />
      </button>

      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {resultStatus}
      </span>

      {/* Autocomplete Suggestions Dropdown */}
      {showPanel && (
        <div className="content-rise absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2 text-xs text-[var(--color-text-secondary)]">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Sparkle aria-hidden="true" size={13} weight="duotone" />
              {searchFailed ? 'Chưa thể tải gợi ý' : commandItems.length ? `${commandItems.length} kết quả từ điển` : 'Không có kết quả'}
            </span>
            <span className="hidden items-center gap-1 sm:inline-flex">
              dùng phím mũi tên <KeyReturn aria-hidden="true" size={13} />
            </span>
          </div>
          {commandItems.length ? (
            <div className="grid max-h-[min(460px,calc(100vh-180px))] grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_240px]">
              <div id={listboxId} role="listbox" className="min-w-0 py-1">
                <SuggestionSection
                  title="Từ vựng"
                  emptyLabel="Không có từ phù hợp"
                  items={termSuggestions.map((result) => ({
                    key: `term-${result.term.id}`,
                    item: commandItems.findIndex((entry) => entry.kind === 'term' && entry.id === `term-${result.term.id}`),
                    href: `/word/${encodeURIComponent(result.term.id)}`,
                    content: <TermSuggestion result={result} query={query} />,
                  }))}
                  activeIndex={activeIndex}
                  onActive={setActiveIndex}
                  onOpen={(href) => router.push(href)}
                />

                <SuggestionSection
                  title="Hán tự"
                  emptyLabel="Không có Hán tự phù hợp"
                  items={kanjiSuggestions.map((result) => ({
                    key: `kanji-${result.kanji.literal}`,
                    item: commandItems.findIndex((entry) => entry.kind === 'kanji' && entry.id === `kanji-${result.kanji.literal}`),
                    href: `/kanji/${encodeURIComponent(result.kanji.literal)}`,
                    content: <KanjiSuggestion result={result} query={query} />,
                  }))}
                  activeIndex={activeIndex}
                  onActive={setActiveIndex}
                  onOpen={(href) => router.push(href)}
                />
              </div>

              <SuggestionPreview item={activeItem} query={query} />
            </div>
          ) : (
            <p className="px-4 py-5 text-sm text-[var(--color-text-secondary)]">
              {searchFailed ? 'Chưa thể tải gợi ý. Nhấn Tìm kiếm để thử tra cứu đầy đủ.' : 'Không có kết quả phù hợp.'}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

function SuggestionSection({
  title,
  emptyLabel,
  items,
  activeIndex,
  onActive,
  onOpen,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ key: string; item: number; href: string; content: React.ReactNode }>;
  activeIndex: number;
  onActive: (index: number) => void;
  onOpen: (href: string) => void;
}) {
  const labelId = useId();

  return (
    <section role="group" aria-labelledby={labelId} className="py-1">
      <div id={labelId} className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)]">{title}</div>
      {items.length ? (
        items.map(({ key, item, href, content }) => (
          <button
            key={key}
            id={key}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={activeIndex === item}
            onMouseEnter={() => onActive(item)}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onOpen(href)}
            className={`relative block w-full min-h-11 text-left transition-colors ${
              activeIndex === item ? 'bg-[var(--color-primary-50)]' : 'hover:bg-[var(--color-surface-subtle)]'
            }`}
          >
            {activeIndex === item && (
              <span aria-hidden="true" className="absolute left-0 top-2 h-[calc(100%-16px)] w-1 rounded-r-full bg-[var(--color-primary-600)]" />
            )}
            {content}
          </button>
        ))
      ) : (
        <div className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{emptyLabel}</div>
      )}
    </section>
  );
}

function TermSuggestion({ result, query }: { result: DictionarySearchResult; query: string }) {
  const { term } = result;
  return (
    <div className="flex min-h-16 items-start gap-3 px-4 py-3 pl-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span lang="ja" className="jp-text text-lg font-semibold leading-6 text-[var(--color-text-primary)]">
            <Highlight text={term.surface} query={query} />
          </span>
          <span lang="ja" className="jp-text text-sm leading-5 text-[var(--color-text-muted)]">
            <Highlight text={term.reading} query={query} />
          </span>
          {term.romaji && (
            <span className="text-xs leading-5 text-[var(--color-text-muted)]">
              <Highlight text={term.romaji} query={query} />
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-1 text-sm leading-5 text-[var(--color-text-secondary)]">
          <Highlight text={term.meaningsVi.slice(0, 2).join('; ') || 'Chưa có nghĩa hiển thị'} query={query} />
        </p>
      </div>
      {term.isCommon && (
        <span className="mt-1 shrink-0 rounded-full bg-[var(--color-primary-100)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary-700)]">
          phổ biến
        </span>
      )}
    </div>
  );
}

function KanjiSuggestion({ result, query }: { result: KanjiDictionarySearchResult; query: string }) {
  const { kanji } = result;
  return (
    <div className="flex min-h-16 items-start gap-3 px-4 py-3 pl-5">
      <div lang="ja" className="jp-text flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius-md] bg-[var(--color-surface-subtle)] text-2xl font-semibold text-[var(--color-text-primary)]">
        {kanji.literal}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-base font-semibold leading-6 text-[var(--color-text-primary)]">
            <Highlight text={kanji.hanViet.join(', ') || 'Không rõ'} query={query} />
          </span>
          {kanji.jlpt && <span className="text-xs font-medium text-[var(--color-primary-700)]">{kanji.jlpt}</span>}
        </div>
        <p className="mt-1 line-clamp-1 text-sm leading-5 text-[var(--color-text-secondary)]">
          <Highlight text={kanji.meanings.slice(0, 3).join(', ')} query={query} />
        </p>
      </div>
    </div>
  );
}

function SuggestionPreview({ item, query }: { item?: CommandItem; query: string }) {
  if (!item) return null;

  if (item.kind === 'kanji') {
    const kanji = item.result.kanji;
    return (
      <aside className="hidden border-l border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 lg:block">
        <div lang="ja" className="jp-text text-6xl leading-none text-[var(--color-text-primary)]">{kanji.literal}</div>
        <div className="mt-3 text-lg font-semibold text-[var(--color-text-primary)]">{kanji.hanViet.join(', ') || 'Không rõ'}</div>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          <Highlight text={kanji.meanings.slice(0, 4).join(', ')} query={query} />
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <KeyReturn aria-hidden="true" size={14} />
          Enter để mở Hán tự
        </div>
      </aside>
    );
  }

  const term = item.result.term;
  return (
    <aside className="hidden border-l border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 lg:block">
      <div lang="ja" className="jp-text text-3xl font-semibold leading-tight text-[var(--color-text-primary)]">{term.surface}</div>
      <div lang="ja" className="jp-text mt-2 text-sm text-[var(--color-text-muted)]">{term.reading}</div>
      <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
        <Highlight text={term.meaningsVi.slice(0, 3).join('; ') || 'Chưa có nghĩa hiển thị'} query={query} />
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <KeyReturn size={14} />
        Enter để mở mục từ
      </div>
    </aside>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!text) return null;
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return <>{text}</>;

  const matchIndex = normalizedText.indexOf(normalizedQuery);
  if (matchIndex < 0) return <>{text}</>;

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + normalizedQuery.length);
  const after = text.slice(matchIndex + normalizedQuery.length);

  return (
    <>
      {before}
      <mark className="rounded bg-[var(--color-highlight)] px-0.5 text-[var(--color-text-primary)]">{match}</mark>
      {after}
    </>
  );
}
