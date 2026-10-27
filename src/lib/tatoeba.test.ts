import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTatoebaUrl,
  escapeManticore,
  fetchTatoebaExamples,
  normalizeRawQuery,
  parseLicense,
  parseLimit,
  parseTatoebaResponse,
  sanitizeQuery,
} from './tatoeba';

test('normalizeRawQuery trims, handles unicode NFC and removes control characters', () => {
  assert.equal(normalizeRawQuery('  食べる  '), '食べる');
  assert.equal(normalizeRawQuery('猫\u0000\u001F'), '猫');
  assert.equal(normalizeRawQuery(null), '');
  assert.equal(normalizeRawQuery(undefined), '');
  assert.equal(normalizeRawQuery(123), '');
});

test('escapeManticore escapes Sphinx/Manticore syntax operators', () => {
  assert.equal(escapeManticore('cat|dog'), 'cat\\|dog');
  assert.equal(escapeManticore('!negate'), '\\!negate');
  assert.equal(escapeManticore('@title'), '\\@title');
  assert.equal(escapeManticore('group(1)'), 'group\\(1\\)');
  assert.equal(escapeManticore('a & b - c ~ d / e ^ f $ g = h < i > j * k % l "m" \\ n'),
    'a \\& b \\- c \\~ d \\/ e \\^ f \\$ g \\= h \\< i \\> j \\* k \\% l \\"m\\" \\\\ n');
  assert.equal(sanitizeQuery('  猫 | 犬  '), '猫 \\| 犬');
});

test('parseLimit validates and clamps boundaries', () => {
  assert.equal(parseLimit(null), 5);
  assert.equal(parseLimit('invalid'), 5);
  assert.equal(parseLimit('-1'), 5);
  assert.equal(parseLimit('0'), 5);
  assert.equal(parseLimit('8'), 8);
  assert.equal(parseLimit('100'), 20);
});

test('parseLicense only accepts CC BY 2.0 FR or CC0 1.0 without self-assigning', () => {
  assert.equal(parseLicense('CC BY 2.0 FR'), 'CC BY 2.0 FR');
  assert.equal(parseLicense('  CC BY 2.0 FR  '), 'CC BY 2.0 FR');
  assert.equal(parseLicense('CC0 1.0'), 'CC0 1.0');
  assert.equal(parseLicense(null), null);
  assert.equal(parseLicense(undefined), null);
  assert.equal(parseLicense(''), null);
  assert.equal(parseLicense('GPL-3.0'), null);
  assert.equal(parseLicense('MIT'), null);
});

test('buildTatoebaUrl sets required Tatoeba v1 parameters and escapes query', () => {
  const url = new URL(buildTatoebaUrl('本|書', 7));
  assert.equal(url.searchParams.get('q'), '本\\|書');
  assert.equal(url.searchParams.get('lang'), 'jpn');
  assert.equal(url.searchParams.get('trans:lang'), 'vie');
  assert.equal(url.searchParams.get('sort'), 'relevance');
  assert.equal(url.searchParams.get('showtrans'), 'matching');
  assert.equal(url.searchParams.get('limit'), '7');
});

test('parseTatoebaResponse keeps owner as author, separate valid licenses, and null when missing', () => {
  const mockPayload = {
    data: [
      {
        id: 1001,
        text: 'これは本です。',
        lang: 'jpn',
        owner: 'tanaka',
        license: 'CC BY 2.0 FR',
        translations: [
          {
            id: 2001,
            text: 'Đây là quyển sách.',
            lang: 'vie',
            owner: 'nguyen',
            license: 'CC0 1.0',
          },
        ],
      },
      {
        id: 1002,
        text: '水。',
        lang: 'jpn',
        owner: null,
        license: 'Unknown License',
        translations: [
          {
            id: 2002,
            text: 'Nước.',
            lang: 'vie',
            owner: '   ',
            license: null,
          },
        ],
      },
    ],
  };

  const results = parseTatoebaResponse(mockPayload, 5);
  assert.equal(results.length, 2);

  // First item: both have owners and valid licenses
  assert.deepEqual(results[0], {
    id: 'tatoeba-1001-2001',
    sentenceId: 1001,
    translationId: 2001,
    textJa: 'これは本です。',
    textVi: 'Đây là quyển sách.',
    authorJa: 'tanaka',
    authorVi: 'nguyen',
    licenseJa: 'CC BY 2.0 FR',
    licenseVi: 'CC0 1.0',
    source: 'Tatoeba',
    url: 'https://tatoeba.org/sentences/show/1001',
  });

  // Second item: missing owners -> null, invalid/missing licenses -> null (not defaulted)
  assert.deepEqual(results[1], {
    id: 'tatoeba-1002-2002',
    sentenceId: 1002,
    translationId: 2002,
    textJa: '水。',
    textVi: 'Nước.',
    authorJa: null,
    authorVi: null,
    licenseJa: null,
    licenseVi: null,
    source: 'Tatoeba',
    url: 'https://tatoeba.org/sentences/show/1002',
  });
});

test('fetchTatoebaExamples directly queries upstream Tatoeba API for real data', { skip: process.env.TATOEBA_LIVE_TEST !== '1' }, async () => {
    const examples = await fetchTatoebaExamples('猫', { limit: 2, timeoutMs: 5000 });
    assert.ok(Array.isArray(examples));
    if (examples.length > 0) {
      const first = examples[0];
      assert.equal(typeof first.sentenceId, 'number');
      assert.equal(typeof first.translationId, 'number');
      assert.equal(typeof first.textJa, 'string');
      assert.equal(typeof first.textVi, 'string');
      assert.equal(first.source, 'Tatoeba');
      assert.ok(first.authorJa === null || typeof first.authorJa === 'string');
      assert.ok(first.authorVi === null || typeof first.authorVi === 'string');
      assert.ok(first.licenseJa === null || first.licenseJa === 'CC BY 2.0 FR' || first.licenseJa === 'CC0 1.0');
      assert.ok(first.licenseVi === null || first.licenseVi === 'CC BY 2.0 FR' || first.licenseVi === 'CC0 1.0');
    }
});
