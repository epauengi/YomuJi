'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { BookOpenText, Gear, GraduationCap, List, X } from '@phosphor-icons/react';

const navItems = [
  { label: 'Từ điển', href: '/', icon: BookOpenText },
  { label: 'JLPT', href: '/jlpt', icon: GraduationCap },
  { label: 'Thiết lập', href: '/settings', icon: Gear },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="sticky top-0 z-[var(--z-sticky)] w-full border-b border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" onClick={() => setIsOpen(false)}>
            <div className="relative h-9 w-9 overflow-hidden rounded-[--radius-md]">
              <Image src="/Logo.png" alt="YomuJi Logo" fill className="object-cover" />
            </div>
            <div className="leading-tight">
              <span className="block text-xl font-black tracking-tight text-[var(--color-text-primary)]">読む字</span>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
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

      {isOpen && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-3 py-3">
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
