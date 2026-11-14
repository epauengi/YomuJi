'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenText, BookmarkSimple, Books, GraduationCap } from '@phosphor-icons/react';
import { isRouteActive, mobileNavItems } from '@/lib/navigation';

const icons = { '/': BookOpenText, '/books': Books, '/practice': GraduationCap, '/saved': BookmarkSimple };

export default function BottomNav() {
  const pathname = usePathname();
  return <nav aria-label="Điều hướng di động" className="shell-bottom-nav no-print">
    <div className="shell-bottom-links">{mobileNavItems.map((item) => {
      const active = isRouteActive(pathname, item.href);
      const Icon = icons[item.href];
      return <Link key={item.href} href={item.href} className="shell-bottom-link" aria-current={active ? 'page' : undefined}><Icon size={22} weight={active ? 'fill' : 'regular'} aria-hidden="true" /><span>{item.name}</span></Link>;
    })}</div>
  </nav>;
}
