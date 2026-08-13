'use client';

// Re-export real dictionary service for 100% seamless FE integration
export {
  useDictionary,
  searchDictionary,
  searchKanjiDictionary,
  findTerm,
  findKanji,
  getPopularTerms,
  getWordOfTheDay,
  getKanjiByLevel,
  getCompoundsForKanji,
  normalizeQuery,
  formatBytes,
  initDictionary,
} from '@/lib/dictionaryService';
