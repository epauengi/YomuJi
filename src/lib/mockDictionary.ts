'use client';

// Re-export real dictionary service for 100% seamless FE integration
export {
  useDictionary,
  useNameDictionary,
  searchDictionary,
  searchKanjiDictionary,
  searchNameDictionary,
  findTerm,
  findKanji,
  getPopularTerms,
  getWordOfTheDay,
  getKanjiByLevel,
  getCompoundsForKanji,
  normalizeQuery,
  formatBytes,
  initDictionary,
  initNameDictionary,
  downloadOfflineDictionary,
  downloadNameDictionary,
  getNameDictionaryStatus,
} from '@/lib/dictionaryService';
export type {
  NameDictionaryProgress,
  NameDictionaryProgressStatus,
  NameDictionaryStatus,
  NameEntry,
  SearchNamesOptions,
} from '@/lib/dictionaryService';
