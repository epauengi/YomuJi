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
