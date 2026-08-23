'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenText, Gear, GraduationCap } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { isRouteActive, navItems as navigationItems } from '@/lib/navigation';

const navItems = navigationItems.map((item) => ({
  ...item,
  icon: item.href === '/' ? BookOpenText : item.href === '/jlpt' ? GraduationCap : Gear,
}));

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng di động"
      className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
      style={{ height: 'calc(60px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-full max-w-md items-center justify-around px-4">
        {navItems.map((item) => {
          const isActive = isRouteActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="tactile group relative flex h-full flex-1 flex-col items-center justify-center gap-1"
            >
              <div className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'}`}>
                <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-indicator"
                    className="absolute -top-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[var(--color-primary-700)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </div>
              <span className={`text-xs font-medium transition-colors duration-200 ${isActive ? 'font-bold text-[var(--color-primary-700)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

