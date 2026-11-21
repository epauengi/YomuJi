import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyPitchAccent,
  getPitchPattern,
  normalizePitchAccents,
  splitMorae,
} from './pitchAccent';

test('splitMorae combines yoon but keeps sokuon and choonpu separate', () => {
  assert.deepEqual(splitMorae('はし'), ['は', 'し']);
  assert.deepEqual(splitMorae('きょう'), ['きょ', 'う']);
  assert.deepEqual(splitMorae('しゃしん'), ['しゃ', 'し', 'ん']);
  assert.deepEqual(splitMorae('がっこう'), ['が', 'っ', 'こ', 'う']);
  assert.deepEqual(splitMorae('コーヒー'), ['コ', 'ー', 'ヒ', 'ー']);
  assert.deepEqual(splitMorae('パーティー'), ['パ', 'ー', 'ティ', 'ー']);
  assert.deepEqual(splitMorae(''), []);
});

test('getPitchPattern distinguishes Heiban, Atamadaka, Nakadaka, and Odaka via particle', () => {
  // 端 はし [0] Heiban: L H (particle H)
  assert.deepEqual(getPitchPattern(2, 0), ['L', 'H', 'H']);
  // 箸 はし [1] Atamadaka: H L (particle L)
  assert.deepEqual(getPitchPattern(2, 1), ['H', 'L', 'L']);
  // 橋 はし [2] Odaka: L H (particle L)
  assert.deepEqual(getPitchPattern(2, 2), ['L', 'H', 'L']);
  // 食べる たべる [2] Nakadaka: L H L (particle L)
  assert.deepEqual(getPitchPattern(3, 2), ['L', 'H', 'L', 'L']);
  // 1-mora word: 柄 え [0] -> L H; 絵 え [1] -> H L
  assert.deepEqual(getPitchPattern(1, 0), ['L', 'H']);
  assert.deepEqual(getPitchPattern(1, 1), ['H', 'L']);
});

test('classifyPitchAccent returns expected Japanese and Vietnamese labels', () => {
  assert.equal(classifyPitchAccent(2, 0).kind, 'heiban');
  assert.equal(classifyPitchAccent(2, 1).kind, 'atamadaka');
  assert.equal(classifyPitchAccent(2, 2).kind, 'odaka');
  assert.equal(classifyPitchAccent(4, 2).kind, 'nakadaka');
});

test('normalizePitchAccents filters invalid values and deduplicates', () => {
  assert.deepEqual(normalizePitchAccents([0, 2, 0, -1, 1.5, '3', 'bad', null]), [0, 2, 3]);
  assert.deepEqual(normalizePitchAccents(undefined), []);
});
