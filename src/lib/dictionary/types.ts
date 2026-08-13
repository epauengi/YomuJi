import type { TermRecord, KanjiRecord, DictionarySearchResult, KanjiDictionarySearchResult } from '@/types/dictionary';

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

export interface DictionaryRepository {
  /**
   * Search terms by surface, reading, romaji, Vietnamese meanings, or kanji
   */
  searchTerms(input: SearchTermsInput): Promise<SearchTermsResult>;

  /**
   * Search kanji by literal, Han Viet, readings, or Vietnamese meanings
   */
  searchKanji(input: SearchKanjiInput): Promise<SearchKanjiResult>;

  /**
   * Retrieve a term by its ID, surface, or reading
   */
  getTermByIdOrSlug(slug: string): Promise<TermRecord | null>;

  /**
   * Retrieve a kanji record by its literal character
   */
  getKanjiByLiteral(literal: string): Promise<KanjiRecord | null>;
}
