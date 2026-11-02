import type { ExampleRecord, TermRecord, TermSense } from '@/types/dictionary';

export const SENSE_DATA_VERSION = '1.1.0';

export interface SenseSidecarRecord {
  id: string;
  writtenForms?: string[];
  readingForms?: string[];
  senses: TermSense[];
}

export interface SenseSidecarPayload {
  schemaVersion: 1;
  dataVersion: string;
  records: Record<string, SenseSidecarRecord>;
}

export function getSenseSidecarUrl(sequence: number): string {
  const bucket = Math.floor(sequence / 10000);
  return `/dict/senses/${SENSE_DATA_VERSION}/${bucket}.json`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isExampleRecord(value: unknown): value is ExampleRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const ex = value as Record<string, unknown>;
  return (
    typeof ex.id === 'string' &&
    typeof ex.termSequence === 'number' &&
    Number.isInteger(ex.termSequence) &&
    typeof ex.textJa === 'string' &&
    typeof ex.textVi === 'string' &&
    (ex.highlight === undefined || typeof ex.highlight === 'string')
  );
}

export function isTermSense(value: unknown): value is TermSense {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    isStringArray(s.meaningsVi) &&
    isStringArray(s.partOfSpeech) &&
    isStringArray(s.misc) &&
    isStringArray(s.appliesToKanji) &&
    isStringArray(s.appliesToReadings) &&
    Array.isArray(s.examples) &&
    s.examples.every(isExampleRecord)
  );
}

export function isValidSenseRecord(value: unknown): value is SenseSidecarRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  if (typeof rec.id !== 'string' || rec.id.length === 0) return false;
  if (
    rec.writtenForms !== undefined &&
    (!Array.isArray(rec.writtenForms) || !rec.writtenForms.every((w) => typeof w === 'string'))
  ) {
    return false;
  }
  if (
    rec.readingForms !== undefined &&
    (!Array.isArray(rec.readingForms) || !rec.readingForms.every((r) => typeof r === 'string'))
  ) {
    return false;
  }
  if (!Array.isArray(rec.senses) || rec.senses.length === 0 || !rec.senses.every(isTermSense)) {
    return false;
  }
  return true;
}

export function isValidSenseSidecarPayload(value: unknown): value is SenseSidecarPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (payload.schemaVersion !== 1) return false;
  if (payload.dataVersion !== SENSE_DATA_VERSION) return false;
  if (
    typeof payload.records !== 'object' ||
    payload.records === null ||
    Array.isArray(payload.records)
  ) {
    return false;
  }
  return true;
}

export function enrichTermWithSenseRecord(
  term: TermRecord,
  record: SenseSidecarRecord
): TermRecord {
  if (term.senses && term.senses.length > 0) {
    return term;
  }
  return {
    ...term,
    senses: record.senses,
    writtenForms:
      term.writtenForms && term.writtenForms.length > 0
        ? term.writtenForms
        : (record.writtenForms ?? term.writtenForms),
    readingForms:
      term.readingForms && term.readingForms.length > 0
        ? term.readingForms
        : (record.readingForms ?? term.readingForms),
  };
}

// ponytail: memory bucket cache; upgrade to persistent worker storage if offline full-sense dictionary is requested
const payloadCache = new Map<number, SenseSidecarPayload | null>();
const inFlightRequests = new Map<number, Promise<SenseSidecarPayload | null>>();

export async function fetchSenseSidecarBucket(
  bucket: number,
  signal?: AbortSignal
): Promise<SenseSidecarPayload | null> {
  const cached = payloadCache.get(bucket);
  if (cached !== undefined) return cached;
  if (signal?.aborted) return null;

  let promise = inFlightRequests.get(bucket);
  if (!promise) {
    promise = (async () => {
      try {
        const url = getSenseSidecarUrl(bucket * 10000);
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) {
            payloadCache.set(bucket, null);
          }
          return null;
        }
        const json: unknown = await response.json();
        if (isValidSenseSidecarPayload(json)) {
          payloadCache.set(bucket, json);
          return json;
        }
        return null;
      } catch {
        return null;
      } finally {
        inFlightRequests.delete(bucket);
      }
    })();
    inFlightRequests.set(bucket, promise);
  }

  if (!signal) return promise;
  if (signal.aborted) return null;

  return new Promise<SenseSidecarPayload | null>((resolve) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      resolve(null);
    };
    signal.addEventListener('abort', onAbort);

    promise.then((result) => {
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) {
        resolve(null);
      } else {
        resolve(result);
      }
    });
  });
}

export async function loadSenseDetailForTerm(
  term: TermRecord,
  signal?: AbortSignal
): Promise<SenseSidecarRecord | null> {
  if (!term || (term.senses && term.senses.length > 0)) {
    return null;
  }
  if (
    typeof term.sequence !== 'number' ||
    !Number.isInteger(term.sequence) ||
    term.sequence <= 0
  ) {
    return null;
  }
  if (typeof term.id !== 'string' || !term.id) {
    return null;
  }

  const bucket = Math.floor(term.sequence / 10000);
  const payload = await fetchSenseSidecarBucket(bucket, signal);
  if (!payload || signal?.aborted) {
    return null;
  }

  const record = payload.records[term.sequence] ?? payload.records[String(term.sequence)];
  if (!record) {
    return null;
  }

  if (record.id !== term.id) {
    return null;
  }

  if (!isValidSenseRecord(record)) {
    return null;
  }

  return record;
}

export function _clearSenseCacheForTests(): void {
  payloadCache.clear();
  inFlightRequests.clear();
}
