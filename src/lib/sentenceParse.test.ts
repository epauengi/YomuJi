import assert from 'node:assert/strict';
import test from 'node:test';
import { getTokenizer } from './kuromojiServer';
import { analyzeTokens } from './sentenceParse';

const parse = async (text: string) => analyzeTokens((await getTokenizer()).tokenize(text));
const roles = (phrases: Awaited<ReturnType<typeof parse>>[number]) => phrases.map((p) => `${p.text}:${p.role}`).join(' ');

test('splits bunsetsu and assigns roles', async () => {
  const [s] = await parse('昨日私は友達と新しい映画を見ました。');
  assert.equal(roles(s), '昨日:adverbial 私は:topic 友達と:complement 新しい:modifier 映画を:object 見ました:predicate');
});

test('detects relative clause', async () => {
  const [s] = await parse('私が昨日買った本はとても面白い。');
  assert.equal(roles(s), '私が:subject 昨日:adverbial 買った:relative 本は:topic とても:adverbial 面白い:predicate');
  assert.equal(s[0].clauseOf, '本');
  const [t] = await parse('背が高い人が来た。');
  assert.equal(roles(t), '背が:subject 高い:relative 人が:subject 来た:predicate');
});

test('splits multiple sentences and keeps conjugation in one phrase', async () => {
  const out = await parse('ご飯を食べられなかった。雨が降ったので、家にいました。');
  assert.equal(out.length, 2);
  assert.equal(roles(out[0]), 'ご飯を:object 食べられなかった:predicate');
  assert.equal(roles(out[1]), '雨が:subject 降ったので:relative 家に:complement いました:predicate');
});
