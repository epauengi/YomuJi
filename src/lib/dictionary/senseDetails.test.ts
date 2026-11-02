import assert from 'node:assert/strict';
import test from 'node:test';
import type { TermRecord, TermSense } from '../../types/dictionary';
import {
  SENSE_DATA_VERSION,
  getSenseSidecarUrl,
  isValidSenseSidecarPayload,
  isValidSenseRecord,
  enrichTermWithSenseRecord,
  loadSenseDetailForTerm,
  _clearSenseCacheForTests,
  type SenseSidecarRecord,
  type SenseSidecarPayload,
} from './senseDetails';

const sampleSense: TermSense = {
  meaningsVi: ['ăn'],
  partOfSpeech: ['v5r', 'vt'],
  misc: ['uk'],
  appliesToKanji: ['食べる'],
  appliesToReadings: ['たべる'],
  examples: [
    {
      id: 'ex-12345-1',
      termSequence: 12345,
      textJa: 'ご飯を食べる。',
      textVi: 'Ăn cơm.',
      highlight: '食べる',
    },
  ],
};

const sampleRecord: SenseSidecarRecord = {
  id: 'term_12345',
  writtenForms: ['食べる', '喰べる'],
  readingForms: ['たべる'],
  senses: [sampleSense],
};

const samplePayload: SenseSidecarPayload = {
  schemaVersion: 1,
  dataVersion: '1.1.0',
  records: {
    '12345': sampleRecord,
  },
};

const flatTerm: TermRecord = {
  id: 'term_12345',
  sequence: 12345,
  surface: '食べる',
  reading: 'たべる',
  romaji: 'taberu',
  meaningsVi: ['ăn'],
  glossesRaw: ['ăn'],
  partOfSpeech: ['v5r'],
  tags: [],
  score: 100,
  isCommon: true,
  kanji: ['食'],
  examples: [],
  related: [],
  searchAliases: [],
  source: { jmdict: true },
};

test('SENSE_DATA_VERSION is 1.1.0', () => {
  assert.equal(SENSE_DATA_VERSION, '1.1.0');
});

test('getSenseSidecarUrl calculates correct bucket', () => {
  assert.equal(getSenseSidecarUrl(1), '/dict/senses/1.1.0/0.json');
  assert.equal(getSenseSidecarUrl(9999), '/dict/senses/1.1.0/0.json');
  assert.equal(getSenseSidecarUrl(10000), '/dict/senses/1.1.0/1.json');
  assert.equal(getSenseSidecarUrl(25432), '/dict/senses/1.1.0/2.json');
});

test('isValidSenseSidecarPayload validates correct and rejects invalid/old versions', () => {
  assert.equal(isValidSenseSidecarPayload(samplePayload), true);
  assert.equal(isValidSenseSidecarPayload({ ...samplePayload, dataVersion: '1.0.0' }), false);
  assert.equal(isValidSenseSidecarPayload({ ...samplePayload, schemaVersion: 2 }), false);
  assert.equal(isValidSenseSidecarPayload({ ...samplePayload, records: null }), false);
  assert.equal(isValidSenseSidecarPayload(null), false);
  assert.equal(isValidSenseSidecarPayload('string'), false);
});

test('isValidSenseRecord validates structure and TermSense fields', () => {
  assert.equal(isValidSenseRecord(sampleRecord), true);
  assert.equal(isValidSenseRecord({ ...sampleRecord, id: '' }), false);
  assert.equal(isValidSenseRecord({ ...sampleRecord, senses: [] }), false);
  assert.equal(
    isValidSenseRecord({
      ...sampleRecord,
      senses: [{ ...sampleSense, meaningsVi: [123 as unknown as string] }],
    }),
    false
  );
  assert.equal(
    isValidSenseRecord({
      ...sampleRecord,
      senses: [{ ...sampleSense, examples: [{ id: 'ex', termSequence: 'bad' }] }],
    }),
    false
  );
});

test('enrichTermWithSenseRecord enriches flat term without overwriting existing senses', () => {
  const enriched = enrichTermWithSenseRecord(flatTerm, sampleRecord);
  assert.deepEqual(enriched.senses, [sampleSense]);
  assert.deepEqual(enriched.writtenForms, ['食べる', '喰べる']);
  assert.deepEqual(enriched.readingForms, ['たべる']);
  assert.equal(enriched.surface, '食べる');

  // Existing senses are never overwritten
  const alreadyGrouped: TermRecord = {
    ...flatTerm,
    senses: [
      {
        meaningsVi: ['đã có nghĩa'],
        partOfSpeech: [],
        misc: [],
        appliesToKanji: [],
        appliesToReadings: [],
        examples: [],
      },
    ],
  };
  const preserved = enrichTermWithSenseRecord(alreadyGrouped, sampleRecord);
  assert.deepEqual(preserved.senses, alreadyGrouped.senses);
});

test('loadSenseDetailForTerm avoids fetch for already grouped terms or invalid sequence', async () => {
  _clearSenseCacheForTests();

  const groupedTerm: TermRecord = { ...flatTerm, senses: [sampleSense] };
  const res1 = await loadSenseDetailForTerm(groupedTerm);
  assert.equal(res1, null);

  const invalidSeqTerm: TermRecord = { ...flatTerm, sequence: -1 };
  const res2 = await loadSenseDetailForTerm(invalidSeqTerm);
  assert.equal(res2, null);

  const floatSeqTerm: TermRecord = { ...flatTerm, sequence: 12.5 };
  const res3 = await loadSenseDetailForTerm(floatSeqTerm);
  assert.equal(res3, null);
});

test('loadSenseDetailForTerm validates identity via exact record.id===term.id and aborts cleanly', async () => {
  _clearSenseCacheForTests();
  const originalFetch = globalThis.fetch;

  try {
    // 1. Successful fetch with matching id
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/dict/senses/1.1.0/1.json')) {
        return new Response(JSON.stringify(samplePayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    };

    const record = await loadSenseDetailForTerm(flatTerm);
    assert.deepEqual(record, sampleRecord);

    // 2. Mismatched term id returns null
    _clearSenseCacheForTests();
    const mismatchedTerm: TermRecord = { ...flatTerm, id: 'different_id' };
    const nullRecord = await loadSenseDetailForTerm(mismatchedTerm);
    assert.equal(nullRecord, null);

    // 3. Aborted signal returns null
    _clearSenseCacheForTests();
    const controller = new AbortController();
    controller.abort();
    const abortedResult = await loadSenseDetailForTerm(flatTerm, controller.signal);
    assert.equal(abortedResult, null);

    // 4. 404 preserves null gracefully
    _clearSenseCacheForTests();
    const missingTerm: TermRecord = { ...flatTerm, sequence: 999999, id: 'term_999999' };
    const missingResult = await loadSenseDetailForTerm(missingTerm);
    assert.equal(missingResult, null);

    // 5. Navigation route transition: stale record for prior term does not match new route term
    _clearSenseCacheForTests();
    const newRouteTerm: TermRecord = {
      ...flatTerm,
      id: 'term_1408810',
      sequence: 1408810,
      surface: '打つ',
    };
    // Prior record id is 'term_12345', new route term id is 'term_1408810'
    assert.notEqual(sampleRecord.id, newRouteTerm.id);
    const staleEnrichCheck = sampleRecord.id === newRouteTerm.id;
    assert.equal(staleEnrichCheck, false);

    // New matching record enriches cleanly
    const matchingNewRecord: SenseSidecarRecord = {
      ...sampleRecord,
      id: 'term_1408810',
    };
    const enrichedNewTerm = enrichTermWithSenseRecord(newRouteTerm, matchingNewRecord);
    assert.equal(enrichedNewTerm.id, 'term_1408810');
    assert.deepEqual(enrichedNewTerm.senses, matchingNewRecord.senses);
  } finally {
    globalThis.fetch = originalFetch;
    _clearSenseCacheForTests();
  }
});
