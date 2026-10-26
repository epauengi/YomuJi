import assert from 'node:assert/strict';
import test from 'node:test';
import { searchHref } from './navigation';

test('searchHref creates canonical committed search URLs', () => {
  assert.equal(searchHref(''), '/');
  assert.equal(searchHref('   '), '/');
  assert.equal(searchHref('  日本  '), '/?q=%E6%97%A5%E6%9C%AC');
  assert.equal(searchHref('học tập'), '/?q=h%E1%BB%8Dc%20t%E1%BA%ADp');
  assert.equal(searchHref('食べる / taberu'), '/?q=%E9%A3%9F%E3%81%B9%E3%82%8B%20%2F%20taberu');
});

test('navItems keeps dictionary first and exposes learning routes', async () => {
  const { navItems, isRouteActive } = await import('./navigation');
  assert.deepEqual(navItems, [
    { name: 'Từ điển', href: '/' },
    { name: 'Thư viện', href: '/books' },
    { name: 'Luyện JLPT', href: '/jlpt' },
    { name: 'Đã lưu', href: '/saved' },
    { name: 'Thiết lập', href: '/settings' },
  ]);
  assert.equal(isRouteActive('/jlpt', '/jlpt'), true);
  assert.equal(isRouteActive('/books/example', '/books'), true);
  assert.equal(isRouteActive('/jlpt', '/'), false);
});
