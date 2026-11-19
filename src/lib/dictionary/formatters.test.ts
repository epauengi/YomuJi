import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyTermMatch,
  compareTermSearchResults,
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

test('alternate written forms outrank loose results, not the main spelling', () => {
  const term = { surface: '作る', reading: 'つくる', romaji: 'tsukuru', writtenForms: ['造る', '創る'] };
  for (const query of term.writtenForms) {
    const variant = classifyTermMatch(term, query);
    assert.equal(variant.matchType, 'exact-written-form');
    const exact = classifyTermMatch({ ...term, surface: query }, query);
    assert.ok(compareTermSearchResults({ ...exact, score: 0 }, { ...variant, score: 99_999 }) < 0);
    assert.ok(compareTermSearchResults({ ...variant, score: 0 }, { matchType: 'partial', score: 99_999 }) < 0);
  }
  assert.equal(classifyTermMatch(term, 'つくる').matchType, 'exact-reading');
  assert.equal(classifyTermMatch(term, 'tsukuru').matchType, 'exact-romaji');
});

test('formatters expose learner-facing labels', () => {
  assert.equal(formatPartOfSpeech('adj-no'), 'Tính từ bổ nghĩa danh từ');
  assert.equal(formatPartOfSpeech('unknown-code'), 'Khác');
  assert.equal(formatMatchType('exact-reading'), 'Khớp cách đọc');
});
