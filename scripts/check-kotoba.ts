import assert from 'node:assert/strict';
import {
  fetchKotoba,
  KotobaError,
  KotobaTimeoutError,
  _resetKotobaCacheForTesting,
  _getKotobaCacheSizeForTesting,
} from '../src/lib/kotoba';
import { isConjugationQuery, type ConjugationData } from '../src/types/kotoba';
import { GET } from '../src/app/api/conjugation/route';

// ============================================================================
// TEST FIXTURES (REAL OPENAPI SCHEMA EXAMPLES FROM KOTOBA.LT)
// ============================================================================

// TEST FIXTURE: REAL SEARCH PAYLOAD FOR "食べた"
const REAL_SEARCH_TABETA_FIXTURE = {
  query: '食べた',
  deinflected: {
    form: '食べる',
    query: '食べた',
    rules: ['-た'],
  },
  results: [
    {
      seq: 1358280,
      headword: '食べる',
      reading: 'たべる',
      url: 'https://kotoba.lt/jp/1358280/食べる',
      romaji: 'taberu',
      accents: [2],
      common: true,
      pos: ['RU grupės veiksmažodis', 'tranzityvinis'],
      summary: 'valgyti; pragyventi (iš atlyginimo ir pan.)',
      attribution: {
        name: 'Kotoba.lt',
        tagline: 'Nemokamas japonų–lietuvių kalbų žodynas',
        text: 'Kotoba.lt · Nemokamas japonų–lietuvių kalbų žodynas',
        url: 'https://kotoba.lt/jp/1358280/食べる',
        icon: 'https://kotoba.lt/api/mark/jp.svg',
        html: '<span class="kotoba-credit">Credit</span>',
        terms: 'https://kotoba.lt/api#attribution',
      },
    },
  ],
  url: 'https://kotoba.lt/jp/?q=食べた',
  attribution: {
    name: 'Kotoba.lt',
    tagline: 'Nemokamas japonų–lietuvių kalbų žodynas',
    text: 'Kotoba.lt · Nemokamas japonų–lietuvių kalbų žodynas',
    url: 'https://kotoba.lt/jp/?q=食べた',
    icon: 'https://kotoba.lt/api/mark/jp.svg',
    html: '<span class="kotoba-credit">Credit</span>',
    terms: 'https://kotoba.lt/api#attribution',
  },
};

// TEST FIXTURE: REAL FORMS PAYLOAD FOR "食べた"
const REAL_FORMS_TABETA_FIXTURE = {
  query: '食べた',
  deinflected: {
    form: '食べる',
    query: '食べた',
    rules: ['-た'],
  },
  entry: {
    seq: 1358280,
    headword: '食べる',
    reading: 'たべる',
    url: 'https://kotoba.lt/jp/1358280/食べる',
    romaji: 'taberu',
    accents: [2],
    common: true,
    pos: ['RU grupės veiksmažodis'],
    summary: 'valgyti',
    attribution: {
      name: 'Kotoba.lt',
      tagline: 'Nemokamas japonų–lietuvių kalbų žodynas',
      text: 'Kotoba.lt',
      url: 'https://kotoba.lt/jp/1358280/食べる',
      icon: 'https://kotoba.lt/api/mark/jp.svg',
      html: '<span>credit</span>',
      terms: 'https://kotoba.lt/api#attribution',
    },
  },
  others: [],
  guesses: [],
  conjugation: {
    group: 'v1',
    group_label: 'RU grupės veiksmažodis',
    sections: [
      {
        id: 'affirmative',
        label: 'Teigiamos',
        forms: [
          {
            id: 'dict',
            label: 'Žodyninė',
            form: '食べる',
            reading: 'たべる',
            matches_query: false,
          },
          {
            id: 'past',
            label: 'Būtasis laikas',
            form: '食べた',
            reading: 'たべた',
            matches_query: true,
          },
          {
            id: 'imperative',
            label: 'Liepiamoji',
            form: '食べろ',
            reading: 'たべろ',
            alt: '食べよ',
            alt_reading: 'たべよ',
            matches_query: false,
          },
        ],
      },
    ],
  },
  url: 'https://kotoba.lt/formos?z=食べた',
  attribution: {
    name: 'Kotoba.lt',
    tagline: 'Nemokamas japonų–lietuvių kalbų žodynas',
    text: 'Kotoba.lt',
    url: 'https://kotoba.lt/formos?z=食べた',
    icon: 'https://kotoba.lt/api/mark/jp.svg',
    html: '<span>credit</span>',
    terms: 'https://kotoba.lt/api#attribution',
  },
};

// TEST FIXTURE: REAL FORMS PAYLOAD WITH OTHERS ("かける")
const REAL_FORMS_OTHERS_FIXTURE = {
  query: 'かける',
  entry: {
    seq: 1207610,
    headword: '掛ける',
    reading: 'かける',
    url: 'https://kotoba.lt/jp/1207610/掛ける',
    romaji: 'kakeru',
    accents: [2],
    common: true,
    pos: ['RU grupės veiksmažodis'],
    summary: 'pakabinti',
    attribution: {
      name: 'Kotoba.lt',
      tagline: 'Nemokamas',
      text: 'Kotoba.lt',
      url: 'https://kotoba.lt',
      icon: 'https://kotoba.lt/icon.svg',
      html: '<span>credit</span>',
      terms: 'https://kotoba.lt/terms',
    },
  },
  others: [
    {
      seq: 1253920,
      headword: '欠ける',
      reading: 'かける',
      url: 'https://kotoba.lt/jp/1253920/欠ける',
    },
    {
      seq: 1570710,
      headword: '翔る',
      reading: 'かける',
      url: 'https://kotoba.lt/jp/1570710/翔る',
    },
  ],
  guesses: [],
  conjugation: {
    group: 'v1',
    group_label: 'RU grupės veiksmažodis',
    sections: [
      {
        id: 'affirmative',
        label: 'Teigiamos',
        forms: [
          {
            id: 'dict',
            label: 'Žodyninė',
            form: '掛ける',
            reading: 'かける',
            matches_query: true,
          },
        ],
      },
    ],
  },
};

// TEST FIXTURE: REAL FORMS PAYLOAD WITH ONLY GUESSES (WORD NOT IN DICTIONARY)
const REAL_FORMS_ONLY_GUESSES_FIXTURE = {
  query: 'ほげる',
  guesses: [
    {
      group: 'v1',
      group_label: 'RU grupės',
      word: 'ほげる',
      sections: [],
    },
  ],
  others: [],
};

// ============================================================================
// TEST SUITE
// ============================================================================

async function runTests() {
  console.log('Running Kotoba Gateway Tests...\n');

  // Test 1: isConjugationQuery validation
  console.log('Test 1: isConjugationQuery validation');
  assert.equal(isConjugationQuery('食べた'), true, 'Kanji + hiragana should be valid');
  assert.equal(isConjugationQuery('食べる'), true, 'Kanji + hiragana dict form should be valid');
  assert.equal(isConjugationQuery('たべた'), true, 'Hiragana only should be valid');
  assert.equal(isConjugationQuery('ラーメン'), true, 'Katakana only should be valid');
  assert.equal(isConjugationQuery('時々行く'), true, 'Kanji + iteration mark 々 + kana should be valid');
  assert.equal(isConjugationQuery('  食べた  '), true, 'Trimmable leading/trailing whitespace should be valid');

  assert.equal(isConjugationQuery('日本'), false, 'Kanji only without kana should be invalid');
  assert.equal(isConjugationQuery('hello'), false, 'English should be invalid');
  assert.equal(isConjugationQuery('taberu'), false, 'Romaji should be invalid');
  assert.equal(isConjugationQuery('食べ る'), false, 'Internal spaces should be invalid');
  assert.equal(isConjugationQuery(''), false, 'Empty string should be invalid');
  assert.equal(isConjugationQuery('あ'.repeat(81)), false, 'Over 80 chars should be invalid');
  assert.equal(isConjugationQuery('食べた！'), false, 'Punctuation should be invalid');
  assert.equal(isConjugationQuery('123'), false, 'Numbers should be invalid');
  assert.equal(isConjugationQuery(null as unknown as string), false, 'Non-string should be invalid');

  // Test 2: Real Search Schema Mapping
  console.log('Test 2: Real search schema mapping');
  _resetKotobaCacheForTesting();
  const searchFetchStub: typeof fetch = async () =>
    new Response(JSON.stringify(REAL_SEARCH_TABETA_FIXTURE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const searchData = await fetchKotoba('search', '食べた', undefined, searchFetchStub);
  assert.equal(searchData.query, '食べた');
  assert.equal(searchData.baseForm, '食べる');
  assert.deepEqual(searchData.rules, ['-た']);
  assert.equal(searchData.entries.length, 1);
  assert.deepEqual(searchData.entries[0], {
    sequence: 1358280,
    surface: '食べる',
    reading: 'たべる',
  });
  assert.deepEqual(searchData.sections, []);
  assert.equal((searchData as unknown as Record<string, unknown>).summary, undefined, 'Summary must not be returned');
  assert.equal((searchData as unknown as Record<string, unknown>).attribution, undefined, 'Raw HTML attribution must not be returned');

  // Test 3: Real Forms Schema Mapping
  console.log('Test 3: Real forms schema mapping');
  _resetKotobaCacheForTesting();
  const formsFetchStub: typeof fetch = async () =>
    new Response(JSON.stringify(REAL_FORMS_TABETA_FIXTURE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const formsData = await fetchKotoba('forms', '食べた', undefined, formsFetchStub);
  assert.equal(formsData.query, '食べた');
  assert.equal(formsData.baseForm, '食べる');
  assert.deepEqual(formsData.rules, ['-た']);
  assert.equal(formsData.group, 'v1');
  assert.equal(formsData.entries.length, 1);
  assert.deepEqual(formsData.entries[0], {
    sequence: 1358280,
    surface: '食べる',
    reading: 'たべる',
  });
  assert.equal(formsData.sections.length, 1);
  assert.equal(formsData.sections[0].id, 'affirmative');
  assert.equal(formsData.sections[0].forms.length, 3);
  assert.deepEqual(formsData.sections[0].forms[1], {
    id: 'past',
    form: '食べた',
    reading: 'たべた',
    matched: true,
  });
  assert.deepEqual(formsData.sections[0].forms[2], {
    id: 'imperative',
    form: '食べろ',
    reading: 'たべろ',
    alternative: '食べよ',
    matched: false,
  });

  // Test 4: Forms Schema Mapping with Others
  console.log('Test 4: Forms schema mapping with others');
  _resetKotobaCacheForTesting();
  const formsOthersStub: typeof fetch = async () =>
    new Response(JSON.stringify(REAL_FORMS_OTHERS_FIXTURE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const formsOthersData = await fetchKotoba('forms', 'かける', undefined, formsOthersStub);
  assert.equal(formsOthersData.entries.length, 3);
  assert.deepEqual(formsOthersData.entries, [
    { sequence: 1207610, surface: '掛ける', reading: 'かける' },
    { sequence: 1253920, surface: '欠ける', reading: 'かける' },
    { sequence: 1570710, surface: '翔る', reading: 'かける' },
  ]);

  // Test 5: Forms Schema Mapping with No Entry (Guesses only -> No guesses returned)
  console.log('Test 5: Forms schema with only guesses -> valid empty');
  _resetKotobaCacheForTesting();
  const guessesOnlyStub: typeof fetch = async () =>
    new Response(JSON.stringify(REAL_FORMS_ONLY_GUESSES_FIXTURE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const noGuessData = await fetchKotoba('forms', 'ほげる', undefined, guessesOnlyStub);
  assert.equal(noGuessData.query, 'ほげる');
  assert.deepEqual(noGuessData.entries, []);
  assert.deepEqual(noGuessData.sections, []);
  assert.deepEqual(noGuessData.rules, []);

  // Test 6: 404 Forms treated as valid empty
  console.log('Test 6: 404 forms treated as valid empty');
  _resetKotobaCacheForTesting();
  const notFoundStub: typeof fetch = async () =>
    new Response(JSON.stringify({ status: 404, error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });

  const emptyResult = await fetchKotoba('forms', 'あああああ', undefined, notFoundStub);
  assert.equal(emptyResult.query, 'あああああ');
  assert.deepEqual(emptyResult.entries, []);
  assert.deepEqual(emptyResult.sections, []);
  assert.deepEqual(emptyResult.rules, []);

  // Test 7: Runtime Schema Validation Failure
  console.log('Test 7: Runtime schema validation error handling');
  _resetKotobaCacheForTesting();
  const malformedStub: typeof fetch = async () =>
    new Response(JSON.stringify({ results: 'not an array' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  await assert.rejects(
    async () => fetchKotoba('search', '食べた', undefined, malformedStub),
    (err: KotobaError) => {
      assert.equal(err.status, 502);
      return true;
    }
  );

  // Test 8: Timeout Handling -> 504
  console.log('Test 8: Timeout handling maps to 504 KotobaTimeoutError');
  _resetKotobaCacheForTesting();
  const timeoutStub: typeof fetch = async () => {
    const error = new Error('The operation was aborted due to timeout');
    error.name = 'TimeoutError';
    throw error;
  };

  await assert.rejects(
    async () => fetchKotoba('forms', '食べた', undefined, timeoutStub),
    (err: KotobaTimeoutError) => {
      assert.equal(err.status, 504);
      return true;
    }
  );

  // Test 9: Concurrent In-flight Deduplication
  console.log('Test 9: In-flight deduplication');
  _resetKotobaCacheForTesting();
  let fetchCallCount = 0;
  const slowFetchStub: typeof fetch = async () => {
    fetchCallCount++;
    await new Promise((res) => setTimeout(res, 50));
    return new Response(JSON.stringify(REAL_SEARCH_TABETA_FIXTURE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const [p1, p2, p3] = await Promise.all([
    fetchKotoba('search', '食べた', undefined, slowFetchStub),
    fetchKotoba('search', '食べた', undefined, slowFetchStub),
    fetchKotoba('search', '食べた', undefined, slowFetchStub),
  ]);

  assert.equal(fetchCallCount, 1, 'Identical concurrent calls must result in exactly 1 upstream fetch');
  assert.equal(p1.baseForm, '食べる');
  assert.equal(p2.baseForm, '食べる');
  assert.equal(p3.baseForm, '食べる');

  // Test 10: In-process Bounded Cache & Error Cooldown
  console.log('Test 10: Bounded cache and error cooldown');
  // Cache hit test
  const p4 = await fetchKotoba('search', '食べた', undefined, slowFetchStub);
  assert.equal(fetchCallCount, 1, 'Subsequent call within TTL must hit cache without additional fetch');
  assert.equal(p4.baseForm, '食べる');

  // Error cooldown test
  _resetKotobaCacheForTesting();
  let failCallCount = 0;
  const failingStub: typeof fetch = async () => {
    failCallCount++;
    return new Response('upstream down', { status: 502 });
  };

  await assert.rejects(async () => fetchKotoba('forms', '食べた', undefined, failingStub));
  assert.equal(failCallCount, 1);

  // Second immediate call must hit error cooldown without calling failingStub again
  await assert.rejects(async () => fetchKotoba('forms', '食べた', undefined, failingStub));
  assert.equal(failCallCount, 1, 'Error cooldown must prevent calling fetch again within cooldown period');

  // Test 11: Route GET Handler Validation
  console.log('Test 11: Route GET handler validation');
  // Invalid mode
  const resBadMode = await GET(new Request('http://localhost/api/conjugation?mode=unknown&q=食べた'));
  assert.equal(resBadMode.status, 400);
  assert.equal(resBadMode.headers.get('Cache-Control'), 'no-store');

  // Invalid query (no kana)
  const resBadQ = await GET(new Request('http://localhost/api/conjugation?mode=search&q=日本'));
  assert.equal(resBadQ.status, 400);

  // seq in search mode (rejected)
  const resSeqSearch = await GET(new Request('http://localhost/api/conjugation?mode=search&q=食べた&seq=1358280'));
  assert.equal(resSeqSearch.status, 400);

  // Invalid seq in forms mode (>15 digits)
  const resSeqTooLong = await GET(new Request('http://localhost/api/conjugation?mode=forms&q=食べた&seq=1234567890123456'));
  assert.equal(resSeqTooLong.status, 400);

  // Invalid seq in forms mode (negative/non-digit)
  const resSeqInvalid = await GET(new Request('http://localhost/api/conjugation?mode=forms&q=食べた&seq=-12'));
  assert.equal(resSeqInvalid.status, 400);

  // Valid seq in forms mode
  _resetKotobaCacheForTesting();
  // Using global stub for route execution test
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      assert.ok(String(url).includes('seq=1253920'), 'Outbound URL must include seq query parameter');
      return new Response(JSON.stringify(REAL_FORMS_TABETA_FIXTURE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const resValid = await GET(new Request('http://localhost/api/conjugation?mode=forms&q=食べた&seq=1253920'));
    assert.equal(resValid.status, 200);
    const body = (await resValid.json()) as ConjugationData;
    assert.equal(body.query, '食べた');
    assert.equal(
      resValid.headers.get('Cache-Control'),
      'public, max-age=86400, stale-while-revalidate=86400',
      'Positive response must have 24h cache control'
    );

    // Negative / empty response cache control assertion
    _resetKotobaCacheForTesting();
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ status: 404, error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

    const resEmpty = await GET(new Request('http://localhost/api/conjugation?mode=forms&q=あああああ'));
    assert.equal(resEmpty.status, 200);
    const emptyBody = (await resEmpty.json()) as ConjugationData;
    assert.equal(emptyBody.entries.length, 0);
    assert.equal(emptyBody.sections.length, 0);
    assert.equal(
      resEmpty.headers.get('Cache-Control'),
      'public, max-age=30, s-maxage=30',
      'Empty negative response must have short 30s cache without long stale-while-revalidate'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 12: In-flight amplification bounding (8 active + 16 queued = 24 cap; 25th rejects with 503)
  console.log('Test 12: In-flight concurrency limiting and 503 queue cap');
  _resetKotobaCacheForTesting();

  let releaseGate!: () => void;
  const gatePromise = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });

  const blockingFetchStub: typeof fetch = async () => {
    await gatePromise;
    return new Response(JSON.stringify(REAL_SEARCH_TABETA_FIXTURE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const kanaSuffixes = [
    'あ', 'い', 'う', 'え', 'お',
    'か', 'き', 'く', 'け', 'こ',
    'さ', 'し', 'す', 'せ', 'そ',
    'た', 'ち', 'つ', 'て', 'と',
    'な', 'に', 'ぬ', 'ね', 'の',
  ];
  assert.equal(kanaSuffixes.length, 25);

  const pending24Promises: Promise<ConjugationData>[] = [];
  // Launch first 24 queries (8 active + 16 queued)
  for (let i = 0; i < 24; i++) {
    pending24Promises.push(
      fetchKotoba('search', `食べ${kanaSuffixes[i]}`, undefined, blockingFetchStub)
    );
  }

  // 25th query exceeds cap -> must immediately reject with 503
  await assert.rejects(
    async () => fetchKotoba('search', `食べ${kanaSuffixes[24]}`, undefined, blockingFetchStub),
    (err: KotobaError) => {
      assert.equal(err.status, 503);
      assert.equal(err.message, 'Kotoba gateway busy');
      return true;
    }
  );

  // Verify route maps 503 to HTTP 503 with Cache-Control: no-store
  const resOverload = await GET(
    new Request(`http://localhost/api/conjugation?mode=search&q=食べ${kanaSuffixes[24]}`)
  );
  assert.equal(resOverload.status, 503);
  assert.equal(resOverload.headers.get('Cache-Control'), 'no-store');

  // Release gate and wait for 24 queued tasks to complete cleanly
  releaseGate();
  await Promise.all(pending24Promises);

  // After draining, new requests proceed normally
  const afterDrain = await fetchKotoba('search', '食べあ', undefined, blockingFetchStub);
  assert.equal(afterDrain.baseForm, '食べる');

  console.log('\nAll Kotoba Gateway checks passed successfully!\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
