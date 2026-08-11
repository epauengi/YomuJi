'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowsClockwise, BookmarkSimple, ClockCounterClockwise, Gear, MagnifyingGlass } from '@phosphor-icons/react';
import { motion } from 'motion/react';

const navItems = [
  { name: 'Tra từ', href: '/', icon: MagnifyingGlass },
  { name: 'Đã lưu', href: '/flashcards', icon: BookmarkSimple },
  { name: 'Ôn tập', href: '/review', icon: ArrowsClockwise },
  { name: 'Lịch sử', href: '/history', icon: ClockCounterClockwise },
  { name: 'Thiết lập', href: '/settings', icon: Gear },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] border-t border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ height: 'calc(64px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-full max-w-screen-md items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="tactile group relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-[--radius-md]"
            >
              <div className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'}`}>
                <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[var(--color-primary-700)]"
                  />
                )}
              </div>
              <span className={`text-[11px] font-medium transition-colors duration-200 ${isActive ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
