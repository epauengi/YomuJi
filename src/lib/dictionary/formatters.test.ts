import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyTermMatch,
  formatMatchType,
  formatPartOfSpeech,
  normalizeDisplayList,
  normalizeDisplayString,
  normalizeQuery,
} from './formatters';

test('normalizeQuery keeps search matching stable', () => {
  assert.equal(normalizeQuery('  Học-tập! '), 'hoctap');
  assert.equal(normalizeQuery('食べる'), '食べる');
});

test('normalizeDisplayString filters malformed source values', () => {
  assert.equal(normalizeDisplayString('  Tiếng   nhật) '), 'Tiếng nhật');
  assert.equal(normalizeDisplayString('[object Object]'), '');
  assert.deepEqual(normalizeDisplayList(['n', '', null, '[object Object]', ' n ']), ['n']);
});

test('classifyTermMatch prioritizes exact fields', () => {
  const term = {
    surface: '食べる',
    reading: 'たべる',
    romaji: 'taberu',
    meaningsVi: ['ăn'],
    searchAliases: [],
  };

  assert.equal(classifyTermMatch(term, '食べる').matchType, 'exact-surface');
  assert.equal(classifyTermMatch(term, 'たべる').matchType, 'exact-reading');
  assert.equal(classifyTermMatch(term, 'taberu').matchType, 'exact-romaji');
  assert.equal(classifyTermMatch(term, 'ăn').matchType, 'exact-meaning');
  assert.equal(classifyTermMatch(term, '食').matchType, 'prefix');
});

test('formatters expose learner-facing labels', () => {
  assert.equal(formatPartOfSpeech('adj-no'), 'Tính từ bổ nghĩa danh từ');
  assert.equal(formatPartOfSpeech('unknown-code'), 'Khác');
  assert.equal(formatMatchType('exact-reading'), 'Khớp cách đọc');
});
