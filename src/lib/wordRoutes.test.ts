import assert from 'node:assert/strict';
import test from 'node:test';
import { wordHref, wordSequence, wordSlug } from './wordRoutes';

test('Han routes preserve the original surface, including supplementary Han', () => {
  assert.equal(wordSlug({ surface: '日本', reading: 'にほん' }), '日本');
  assert.equal(wordSlug({ surface: '食べる', reading: 'たべる' }), '食べる');
  assert.equal(wordSlug({ surface: '𠮷', reading: 'よし' }), '𠮷');
});

test('non-Han routes use NFKC reading then hiragana, preserving long vowels', () => {
  assert.equal(wordSlug({ surface: 'カード', reading: 'カード' }), 'かーど');
  assert.equal(wordSlug({ surface: 'Ｉ', reading: 'ｱｲ' }), 'あい');
  assert.equal(wordSlug({ surface: 'ガッツ', reading: 'ｶﾞｯﾂ' }), 'がっつ');
  assert.equal(wordSlug({ surface: 'ヴ', reading: 'ウ\u3099' }), 'ゔ');
  assert.equal(wordSlug({ surface: 'special', reading: 'ヷヸヹヺヽヾ' }), 'わ\u3099ゐ\u3099ゑ\u3099を\u3099ゝゞ');
  assert.equal(wordSlug({ surface: 'かな', reading: '' }), 'かな');
});

test('actual colliding bases use numeric sequence; unique bases stay short', () => {
  assert.equal(wordHref({ surface: '日本', reading: 'にほん', sequence: 1467860 }), '/word/%E6%97%A5%E6%9C%AC');
  assert.equal(wordHref({ surface: 'アイ', reading: 'アイ', sequence: 1980120 }), '/word/%E3%81%82%E3%81%84?id=1980120');
  assert.equal(wordHref({ surface: 'Ｉ', reading: 'アイ', id: 'Ｉ-アイ-2594070' }), '/word/%E3%81%82%E3%81%84?id=2594070');
  assert.equal(wordHref({ surface: '生', reading: 'なま', sequence: 1378450 }), '/word/%E7%94%9F?id=1378450');
  assert.throws(() => wordHref({ surface: '生', reading: 'なま' }), /Missing valid sequence/);
  assert.throws(() => wordHref({ surface: '生', reading: 'なま', sequence: NaN }), /Missing valid sequence/);
});

test('bare strings remain exact aliases, not inferred legacy IDs or normalized kana', () => {
  for (const alias of ['アイ', '日本', 'アイ-アイ-1980120', 'word / ?#%']) {
    assert.equal(wordHref(alias), `/word/${encodeURIComponent(alias)}`);
  }
});

test('sequence extraction preserves the full original ID, rejecting malformed suffixes', () => {
  assert.equal(wordSequence('長い-元の-ID-よみ-1980120'), 1980120);
  assert.equal(wordSequence('Ｉ-アイ-2594070'), 2594070);
  for (const id of ['', '1980120', 'word-0', 'word--1x', 'word-1.5', 'word-9007199254740992']) {
    assert.equal(wordSequence(id), null);
  }
});
