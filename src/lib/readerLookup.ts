import { getConjugation } from './conjugationClient';
import { searchDictionary } from './dictionaryService';
import { isConjugationQuery } from '../types/kotoba';
import type { TermRecord } from '../types/dictionary';

const LIMIT = 12;

function exactTerms(query: string, signal: AbortSignal) {
  return searchDictionary(query, LIMIT, signal).then((results) => results
    .map(({ term }) => term)
    .filter((term) => [term.surface, term.reading, ...(term.writtenForms ?? []), ...(term.readingForms ?? [])]
      .some((form) => form.normalize('NFKC') === query)));
}

export async function lookupReaderWord(query: string, signal: AbortSignal): Promise<TermRecord[]> {
  const direct = await exactTerms(query, signal);
  // ponytail: Kotoba can stop at the lexicalized られる form. Check the narrow ichidan pattern
  // against actual dictionary POS; leave general deinflection to Kotoba.
  const ichidan = query.replace(/(.+)られ(?:る|た|て|ない|なかった|ます|ました|ません|ませんでした)$/u, '$1る');
  if (!isConjugationQuery(query) || (direct.length && ichidan === query)) return direct;
  signal.throwIfAborted();

  const [root, analyzed] = await Promise.allSettled([
    ichidan !== query
      ? exactTerms(ichidan, signal).then((terms) => terms.filter(({ partOfSpeech }) =>
        partOfSpeech.some((pos) => pos === 'v1' || pos === 'v1-s')))
      : [],
    direct.length ? [] : getConjugation('search', query).then(async ({ baseForm, entries }) => {
      signal.throwIfAborted();
      const base = baseForm?.normalize('NFKC');
      if (!base || base === query) return [];
      const sequences = new Set(entries.map(({ sequence }) => sequence));
      return (await exactTerms(base, signal)).filter(({ sequence }) => sequences.has(sequence));
    }),
  ]);
  signal.throwIfAborted();

  const terms = [...direct, ...(root.status === 'fulfilled' ? root.value : []),
    ...(analyzed.status === 'fulfilled' ? analyzed.value : [])];
  if (!terms.length) {
    if (root.status === 'rejected') throw root.reason;
    if (analyzed.status === 'rejected') throw analyzed.reason;
  }
  const seen = new Set<string>();
  return terms.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, LIMIT);
}
