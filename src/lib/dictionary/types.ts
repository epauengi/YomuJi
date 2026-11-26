import type { TermRecord, KanjiRecord, DictionarySearchResult, KanjiDictionarySearchResult, HomophoneTerm } from '@/types/dictionary';

export interface SearchTermsInput {
  query: string;
  limit?: number;
}

export interface SearchTermsResult {
  terms: DictionarySearchResult[];
}

export interface SearchKanjiInput {
  query: string;
  limit?: number;
}

export interface SearchKanjiResult {
  kanji: KanjiDictionarySearchResult[];
}

export type NameCategory =
  | 'surname'
  | 'given'
  | 'fem'
  | 'masc'
  | 'person'
  | 'place'
  | 'station';

export type NameMatchType =
  | 'exact-surface'
  | 'exact-reading'
  | 'prefix-surface'
  | 'prefix-reading';

export interface ProperNameSearchResult {
  surface: string;
  reading: string;
  categories: NameCategory[];
  categoryLabels: string[];
  matchType: NameMatchType;
}

export interface SearchNamesInput {
  query: string;
  limit?: number;
}

export interface SearchNamesResult {
  names: ProperNameSearchResult[];
  supported: boolean;
}

export interface DictionaryRepository {
  getRandomTerm(dayKey: string): Promise<TermRecord | null>;

  /**
   * Search terms by surface, reading, romaji, Vietnamese meanings, or kanji
   */
  searchTerms(input: SearchTermsInput): Promise<SearchTermsResult>;

  /**
   * Search kanji by literal, Han Viet, readings, or Vietnamese meanings
   */
  searchKanji(input: SearchKanjiInput): Promise<SearchKanjiResult>;

  /**
   * Search proper names by normalized surface or reading
   */
  searchNames(input: SearchNamesInput): Promise<SearchNamesResult>;

  /**
   * Retrieve a term by its ID, surface, or reading
   */
  getTermByIdOrSlug(slug: string): Promise<TermRecord | null>;

  /**
   * Retrieve a kanji record by its literal character
   */
  getKanjiByLiteral(literal: string): Promise<KanjiRecord | null>;

  /**
   * Find other terms sharing the same kana reading (homophones)
   */
  findHomophonesByReading(reading: string, excludeId: string, limit?: number): Promise<HomophoneTerm[]>;
}
