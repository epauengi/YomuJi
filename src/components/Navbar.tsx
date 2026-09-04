'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpenText, Gear, GraduationCap, List, MagnifyingGlass, X } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { SearchInput } from '@/components/SearchInput';
import { isRouteActive, navItems as navigationItems, searchHref } from '@/lib/navigation';

const navItems = navigationItems.map((item) => ({
  ...item,
  label: item.name,
  icon: item.href === '/' ? BookOpenText : item.href === '/jlpt' ? GraduationCap : Gear,
}));

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const isHomepage = pathname === '/';

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <nav aria-label="Điều hướng chính" className="sticky top-0 z-[var(--z-sticky)] w-full border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="group flex shrink-0 items-center gap-3" onClick={() => setIsOpen(false)}>
            <div className="relative h-9 w-9 overflow-hidden rounded-[--radius-md]">
              <Image src="/Logo.png" alt="YomuJi Logo" fill sizes="36px" className="object-cover" />
            </div>
            <div className="leading-tight">
              <span className="block text-xl font-black tracking-tight text-[var(--color-text-primary)]">読む字</span>
            </div>
          </Link>

          {!isHomepage && (
            <div className="mx-2 hidden min-w-0 max-w-md flex-1 sm:block md:mx-4">
              <Suspense fallback={<NavbarSearchInputFallback />}>
                <NavbarSearchInput />
              </Suspense>
            </div>
          )}

          <div className="hidden shrink-0 items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isRouteActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex h-10 items-center gap-2 rounded-[--radius-md] px-3.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-[var(--color-primary-700)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active-pill"
                      className="absolute inset-0 rounded-[--radius-md] bg-[var(--color-primary-50)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="navbar-active-indicator"
                      className="absolute inset-x-3 -bottom-3 h-0.5 rounded-full bg-[var(--color-primary-600)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {!isHomepage && (
            <button
              type="button"
              onClick={() => setIsOpen((value) => !value)}
              className="flex h-11 w-11 items-center justify-center rounded-[--radius-md] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] sm:hidden"
              aria-label={isOpen ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'}
              aria-controls={isOpen ? 'navbar-search-drawer' : undefined}
              aria-expanded={isOpen}
            >
              {isOpen ? <X aria-hidden="true" size={24} /> : <List aria-hidden="true" size={24} />}
            </button>
          )}
        </div>
      </div>

      {isOpen && !isHomepage && (
        <div id="navbar-search-drawer" className="border-t border-[var(--color-border)] bg-[var(--color-surface)] sm:hidden">
          <div className="mx-auto max-w-7xl px-3 py-3">
            <Suspense fallback={<NavbarSearchInputFallback />}>
              <NavbarSearchInput onSearchComplete={() => setIsOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavbarSearchInputFallback() {
  return (
    <div className="relative flex w-full items-center">
      <div className="pointer-events-none absolute left-3 flex items-center text-[var(--color-primary-700)]">
        <MagnifyingGlass aria-hidden="true" size={17} weight="bold" />
      </div>
      <input
        type="text"
        disabled
        placeholder="Tra từ vựng, Kanji, Hán Việt..."
        aria-label="Tra từ vựng hoặc Kanji"
        className="h-11 w-full rounded-[--radius-md] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] pl-9 pr-8 text-sm text-[var(--color-text-primary)] outline-none"
      />
    </div>
  );
}

function NavbarSearchInput({ onSearchComplete }: { onSearchComplete?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get('q') || '';

  return (
    <SearchInput
      variant="compact"
      initialValue={initialQuery}
      placeholder="Tra từ vựng, Kanji, Hán Việt..."
      onSearch={(query) => router.push(searchHref(query))}
      onNavigate={onSearchComplete}
      onClear={onSearchComplete}
    />
  );
}
