export const navItems = [
  { name: 'Từ điển', href: '/', group: 'Tra cứu & đọc' },
  { name: 'Ngữ pháp JLPT', href: '/grammar', group: 'Tra cứu & đọc' },
  { name: 'Tra Kanji theo bộ', href: '/kanji-components', group: 'Tra cứu & đọc' },
  { name: 'Đếm tiếng Nhật', href: '/counters', group: 'Tra cứu & đọc' },
  { name: 'Thư viện', href: '/books', group: 'Tra cứu & đọc' },
  { name: 'Flashcards', href: '/flashcards', group: 'Luyện tập' },
  { name: 'Luyện JLPT', href: '/jlpt', group: 'Luyện tập' },
  { name: 'Giấy luyện viết', href: '/handwriting', group: 'Luyện tập' },
  { name: 'Đã lưu', href: '/saved', group: 'Cá nhân' },
] as const;

export const mobileNavItems = [
  { name: 'Từ điển', href: '/' },
  { name: 'Thư viện', href: '/books' },
  { name: 'Luyện tập', href: '/practice' },
  { name: 'Đã lưu', href: '/saved' },
] as const;

export function searchHref(query: string) {
  const trimmed = query.trim();
  return trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/';
}

export function isRouteActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname.startsWith('/word/') || pathname.startsWith('/kanji/');
  }
  if (href === '/practice') {
    return ['/practice', '/grammar', '/kanji-components', '/counters', '/flashcards', '/jlpt', '/handwriting'].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  if (href === '/saved' && pathname === '/review') return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
