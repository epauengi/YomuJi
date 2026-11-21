export type GrammarLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export const GRAMMAR_LEVELS: readonly GrammarLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

export interface GrammarExample {
  ja: string;
  furigana?: string;
  vi: string;
  en?: string;
}

export interface GrammarPoint {
  id: string;
  slug: string;
  pattern: string;
  reading: string;
  romaji: string;
  level: GrammarLevel;
  meaningVi: string;
  meaningEn: string;
  formation: string;
  nuanceVi: string;
  tags: string[];
  examples: GrammarExample[];
  matchPatterns: string[];
  order: number;
}

export interface GrammarListResponse {
  items: GrammarPoint[];
  total: number;
  countsByLevel: Record<GrammarLevel, number>;
}

export interface SentenceGrammarMatch {
  grammar: GrammarPoint;
  matchedText: string;
  sentenceIndex: number;
  phraseIndices: number[];
}
