import assert from 'node:assert/strict';
import test from 'node:test';
import { isRouteActive, mobileNavItems, navItems, searchHref } from './navigation';

test('searchHref creates canonical committed search URLs', () => {
  assert.equal(searchHref(''), '/');
  assert.equal(searchHref(' '), '/');
  assert.equal(searchHref(' 日本 '), '/?q=%E6%97%A5%E6%9C%AC');
  assert.equal(searchHref('học tập'), '/?q=h%E1%BB%8Dc%20t%E1%BA%ADp');
  assert.equal(searchHref('食べる / taberu'), '/?q=%E9%A3%9F%E3%81%B9%E3%82%8B%20%2F%20taberu');
});

test('sidebar groups lookup and learning routes without mobile tabs', () => {
  assert.deepEqual(navItems.map(({ href }) => href), [
    '/',
    '/ocr',
    '/grammar',
    '/kanji-components',
    '/counters',
    '/books',
    '/flashcards',
    '/jlpt',
    '/handwriting',
    '/saved',
  ]);
  assert.deepEqual(
    navItems.filter(({ group }) => group === 'Luyện tập').map(({ href }) => href),
    ['/flashcards', '/jlpt', '/handwriting'],
  );
  assert.deepEqual(mobileNavItems.map(({ href }) => href), ['/', '/books', '/practice', '/saved']);
});

test('nested routes activate right destination', () => {
  for (const path of ['/', '/word/example', '/kanji/字']) assert.equal(isRouteActive(path, '/'), true);
  assert.equal(isRouteActive('/books/example/read', '/books'), true);
  assert.equal(isRouteActive('/ocr', '/ocr'), true);
  assert.equal(isRouteActive('/ocr', '/'), false);
  assert.equal(isRouteActive('/flashcards/deck/example', '/flashcards'), true);
  for (const path of [
    '/practice',
    '/grammar',
    '/kanji-components',
    '/counters',
    '/flashcards',
    '/flashcards/deck/example',
    '/jlpt',
    '/handwriting',
  ]) assert.equal(isRouteActive(path, '/practice'), true);
  assert.equal(isRouteActive('/review', '/saved'), true);
  for (const path of ['/jlpt', '/flashcards', '/saved']) assert.equal(isRouteActive(path, '/'), false);
  assert.equal(isRouteActive('/jlpt-other', '/practice'), false);
  assert.equal(isRouteActive('/review', '/practice'), false);
});
