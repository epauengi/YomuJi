'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpenText, Gear, GraduationCap, List, MagnifyingGlass, X } from '@phosphor-icons/react';
import { searchDictionary, searchKanjiDictionary } from '@/lib/mockDictionary';
import type { DictionarySearchResult, KanjiDictionarySearchResult } from '@/types/dictionary';

const navItems = [
  { label: 'Từ điển', href: '/', icon: BookOpenText },
  { label: 'JLPT', href: '/jlpt', icon: GraduationCap },
  { label: 'Thiết lập', href: '/settings', icon: Gear },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const isHomepage = pathname === '/';

  return (
    <nav className="sticky top-0 z-[var(--z-sticky)] w-full border-b border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group" onClick={() => setIsOpen(false)}>
            <div className="relative h-9 w-9 overflow-hidden rounded-[--radius-md]">
              <Image src="/Logo.png" alt="YomuJi Logo" fill className="object-cover" />
            </div>
            <div className="leading-tight">
              <span className="block text-xl font-black tracking-tight text-[var(--color-text-primary)]">読む字</span>
            </div>
          </Link>

          {/* Search Bar in Middle (Wrapped in Suspense for Next.js App Router CSR compliance) */}
          {!isHomepage && (
            <div className="hidden sm:block flex-1 max-w-md mx-2 md:mx-4">
              <Suspense fallback={<NavbarSearchInputFallback />}>
                <NavbarSearchInput />
              </Suspense>
            </div>
          )}

          {/* Navigation Links */}
          <div className="hidden items-center gap-2 md:flex shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex h-10 items-center gap-2 rounded-[--radius-md] px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                  {item.label}
                  {isActive && <span className="absolute inset-x-3 -bottom-3 h-0.5 rounded-full bg-[var(--color-primary-600)]" />}
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-[--radius-md] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] md:hidden"
            aria-label={isOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-3">
            {!isHomepage && (
              <div className="mb-2 sm:hidden">
                <Suspense fallback={<NavbarSearchInputFallback />}>
                  <NavbarSearchInput onSearchComplete={() => setIsOpen(false)} />
                </Suspense>
              </div>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex min-h-12 items-center gap-3 rounded-[--radius-md] px-3 text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}

function NavbarSearchInputFallback() {
  return (
    <div className="relative flex items-center w-full">
      <div className="absolute left-3 flex items-center pointer-events-none text-[var(--color-primary-700)]">
        <MagnifyingGlass size={17} weight="bold" />
      </div>
      <input
        type="text"
        disabled
        placeholder="Tra từ vựng, Kanji, Hán Việt..."
        className="h-9 w-full rounded-[--radius-md] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] pl-9 pr-8 text-sm text-[var(--color-text-primary)] outline-none"
      />
    </div>
  );
}

function NavbarSearchInput({ onSearchComplete }: { onSearchComplete?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get('q') || '';
  const [query, setQuery] = React.useState(initialQ);
  const [isFocused, setIsFocused] = React.useState(false);
  const [termResults, setTermResults] = React.useState<DictionarySearchResult[]>([]);
  const [kanjiResults, setKanjiResults] = React.useState<KanjiDictionarySearchResult[]>([]);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setQuery(initialQ);
  }, [initialQ]);

  // Live debounced search for autocomplete suggestions
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setTermResults([]);
      setKanjiResults([]);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [terms, kanji] = await Promise.all([
          searchDictionary(trimmed, 4),
          searchKanjiDictionary(trimmed, 3),
        ]);
        if (!isCancelled) {
          setTermResults(terms || []);
          setKanjiResults(kanji || []);
        }
      } catch (err) {
        console.error('Navbar search error:', err);
      }
    }, 100);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
      setIsFocused(false);
      onSearchComplete?.();
    }
  };

  const handleClear = () => {
    setQuery('');
    setTermResults([]);
    setKanjiResults([]);
  };

  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setIsFocused(true);
  };

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setIsFocused(false), 200);
  };

  const hasSuggestions = isFocused && query.trim().length >= 1 && (termResults.length > 0 || kanjiResults.length > 0);

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center w-full">
        <div className="absolute left-3 flex items-center pointer-events-none text-[var(--color-primary-700)]">
          <MagnifyingGlass size={17} weight="bold" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Tra từ vựng, Kanji, Hán Việt..."
          className="h-9 w-full rounded-[--radius-md] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] pl-9 pr-8 text-sm text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary-500)] focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
            aria-label="Xóa nội dung tìm kiếm"
          >
            <X size={13} />
          </button>
        )}
      </form>

      {/* Autocomplete Dropdown */}
      {hasSuggestions && (
        <div className="content-rise absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <div className="max-h-80 overflow-y-auto py-1 text-sm">
            {termResults.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-surface-subtle)]">
                  Từ vựng
                </div>
                {termResults.map((res) => (
                  <Link
                    key={res.term.id}
                    href={`/word/${encodeURIComponent(res.term.id)}`}
                    onClick={() => {
                      setIsFocused(false);
                      onSearchComplete?.();
                    }}
                    className="flex items-baseline justify-between gap-2 px-3 py-2 hover:bg-[var(--color-primary-50)] transition-colors"
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="jp-text font-semibold text-[var(--color-text-primary)]">{res.term.surface}</span>
                      <span className="jp-text text-xs text-[var(--color-text-muted)]">{res.term.reading}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-[140px]">
                      {res.term.meaningsVi[0]}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {kanjiResults.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-surface-subtle)]">
                  Hán tự
                </div>
                {kanjiResults.map((res) => (
                  <Link
                    key={res.kanji.literal}
                    href={`/kanji/${encodeURIComponent(res.kanji.literal)}`}
                    onClick={() => {
                      setIsFocused(false);
                      onSearchComplete?.();
                    }}
                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[var(--color-primary-50)] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="jp-text text-base font-bold text-[var(--color-primary-800)]">{res.kanji.literal}</span>
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">
                        {res.kanji.hanViet.join(', ')}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-[140px]">
                      {res.kanji.meanings[0]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
