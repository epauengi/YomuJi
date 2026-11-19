import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { downloadOfflineDictionary, searchDictionary } from '../dictionaryService';

test('offline search finds alternate spellings in the shipped index', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    if (!input.startsWith('/dict/')) return new Response(null, { status: 503 });
    return new Response(await readFile(`public${input}`, 'utf8'));
  });
  await downloadOfflineDictionary();
  for (const query of ['造る', '創る', '作る', 'つくる', 'tsukuru']) {
    const matches = await searchDictionary(query, 12);
    assert.equal(matches.filter(({ term }) => term.sequence === 1597890).length, 1, query);
    if (query === '造る' || query === '創る') {
      assert.equal(matches[0].term.sequence, 1597890, query);
      assert.equal(matches[0].matchType, 'exact-written-form');
    }
  }
  const kana = (await searchDictionary('かえる', 12)).map(({ term }) => term.surface);
  assert.ok(kana.includes('帰る') && kana.includes('変える'));
});
