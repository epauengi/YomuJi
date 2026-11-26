'use client';

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpenText, BookmarkSimple, Books, Cards, Gear, GraduationCap, Hash, List, Notebook, PencilSimpleLine, SidebarSimple, SquaresFour, X } from '@phosphor-icons/react';
import { SearchInput } from '@/components/SearchInput';
import { isRouteActive, navItems, searchHref } from '@/lib/navigation';
import './navigation.css';

const icons = { '/': BookOpenText, '/grammar': Notebook, '/kanji-components': SquaresFour, '/counters': Hash, '/books': Books, '/flashcards': Cards, '/jlpt': GraduationCap, '/handwriting': PencilSimpleLine, '/saved': BookmarkSimple };
const groups = ['Tra cứu & đọc', 'Luyện tập', 'Cá nhân'];

function Brand() {
  return <Link href="/" className="shell-brand" aria-label="YomuJi — Từ điển"><Image src="/Logo.png" alt="" width={32} height={32} /><span className="shell-label" lang="ja">読む字</span></Link>;
}

function NavigationLinks({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return <>
    <nav aria-label="Điều hướng chính" className="shell-links">
      {groups.map((group) => <div className="shell-group" key={group}>
        <p className="shell-group-title shell-label">{group}</p>
        {navItems.filter((item) => item.group === group).map((item) => {
          const Icon = icons[item.href];
          const active = isRouteActive(pathname, item.href);
          return <Link key={item.href} href={item.href} className="shell-link" aria-current={active ? 'page' : undefined} aria-label={item.name} title={item.name} onClick={close}>
            <Icon size={21} weight={active ? 'fill' : 'regular'} aria-hidden="true" /><span className="shell-label">{item.name}</span>
          </Link>;
        })}
      </div>)}
    </nav>
    <Link href="/settings" className="shell-link shell-settings" aria-label="Cài đặt" title="Cài đặt" aria-current={isRouteActive(pathname, '/settings') ? 'page' : undefined} onClick={close}><Gear size={21} aria-hidden="true" /><span className="shell-label">Cài đặt</span></Link>
  </>;
}

export function Navbar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { drawer.current?.close(); setCollapsed(null); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia('(768px <= width < 1200px)');
    const close = () => drawer.current?.close();
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);

  function toggleSidebar() {
    const compact = shell.current && getComputedStyle(shell.current).getPropertyValue('--shell-sidebar-width').trim() === '72px';
    setCollapsed(!compact);
  }

  return <div ref={shell} className={`app-shell ${collapsed === null ? 'shell-auto' : collapsed ? 'shell-collapsed' : 'shell-expanded'}`}>
    <aside className="shell-sidebar no-print" aria-label="Thanh bên">
      <Brand />
      <button type="button" className="shell-icon-button shell-collapse" onClick={toggleSidebar} aria-label="Thu gọn hoặc mở rộng thanh bên" title="Thu gọn hoặc mở rộng thanh bên"><SidebarSimple size={21} aria-hidden="true" /></button>
      <NavigationLinks />
    </aside>
    <div className="shell-content">
      <header className={`shell-header no-print${pathname.startsWith('/word/') ? ' shell-header-word' : ''}`}>
        <button ref={menuButton} type="button" className="shell-icon-button shell-menu" aria-label="Mở điều hướng" aria-haspopup="dialog" aria-controls="navigation-drawer" onClick={() => drawer.current?.showModal()}><List size={23} aria-hidden="true" /></button>
        <div className="shell-mobile-brand"><Brand /></div>
        {pathname !== '/' ? <div className="shell-search"><Suspense fallback={<input disabled aria-label="Tra từ vựng hoặc Kanji" placeholder="Tra từ, Kanji…" className="shell-search-fallback" />}><NavbarSearchInput /></Suspense></div> : <span className="shell-header-title">Từ điển Nhật–Việt</span>}
        <Link href="/settings" className="shell-icon-button shell-header-settings" aria-label="Cài đặt" title="Cài đặt" aria-current={pathname === '/settings' ? 'page' : undefined}><Gear size={22} aria-hidden="true" /></Link>
      </header>
      {children}
    </div>
    <dialog ref={drawer} id="navigation-drawer" className="shell-drawer no-print" aria-label="Điều hướng" onClose={() => menuButton.current?.focus()} onClick={(event) => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
      <div className="shell-drawer-content">
        <div className="shell-drawer-heading"><Brand /><button type="button" autoFocus className="shell-icon-button" aria-label="Đóng điều hướng" onClick={() => drawer.current?.close()}><X size={22} aria-hidden="true" /></button></div>
        <NavigationLinks close={() => drawer.current?.close()} />
      </div>
    </dialog>
  </div>;
}

function NavbarSearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return <SearchInput variant="compact" initialValue={searchParams?.get('q') || ''} placeholder="Tra từ, Kanji…" onSearch={(query) => router.push(searchHref(query))} />;
}
