import assert from 'node:assert/strict';
import test from 'node:test';
import { chunkJapanese } from './japaneseChunks';

test('chunkJapanese splits a sentence into lookup words', () => {
  const words = chunkJapanese('昨日はご飯を食べられなかった。').filter((chunk) => chunk.word).map((chunk) => chunk.text);
  assert.ok(words.length > 2, words.join('|'));
  assert.ok(words.includes('は') && words.includes('を'), words.join('|'));
  assert.equal(words.join(''), '昨日はご飯を食べられなかった');
});
