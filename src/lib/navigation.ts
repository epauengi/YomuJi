export const navItems = [
  { name: 'Từ điển', href: '/' },
  { name: 'JLPT', href: '/jlpt' },
  { name: 'Thiết lập', href: '/settings' },
] as const;

export function isRouteActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname.startsWith('/word/') || pathname.startsWith('/kanji/');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
