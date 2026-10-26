export const navItems = [
  { name: 'Từ điển', href: '/' },
  { name: 'Thư viện', href: '/books' },
  { name: 'Luyện JLPT', href: '/jlpt' },
  { name: 'Đã lưu', href: '/saved' },
  { name: 'Thiết lập', href: '/settings' },
] as const;

export function searchHref(query: string) {
  const trimmed = query.trim();
  return trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/';
}

export function isRouteActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname.startsWith('/word/') || pathname.startsWith('/kanji/');
  }

  if (href === '/books') {
    return pathname === '/books' || pathname.startsWith('/books/');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
