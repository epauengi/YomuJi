// ========================================
// YomuJi Type Definitions
// ========================================

// JLPT Level
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

// Part of Speech
export type PartOfSpeechCode = 
  | 'noun'
  | 'proper-noun'
  | 'adjective'
  | 'i-adjective'
  | 'na-adjective'
  | 'godan-verb'
  | 'ichidan-verb'
  | 'suru-verb'
  | 'kuru-verb'
  | 'adverb'
  | 'particle'
  | 'conjunction'
  | 'interjection'
  | 'expression'
  | 'transitive'
  | 'intransitive';

export interface PartOfSpeech {
  code: PartOfSpeechCode;
  labelVi: string;
  labelJa: string;
}

// Audio
export interface Audio {
  src: string;
  durationMs: number;
  speaker: string;
  waveform: number[];
}

// Sense (Meaning)
export interface Sense {
  id: string;
  order: number;
  meaningVi: string;
  noteVi?: string;
  domain?: string;
}

// Vocabulary
export interface Vocabulary {
  id: string;
  slug: string;
  surface: string;
  reading: string;
  romaji: string;
  language: 'ja' | 'vi';
  direction: 'jp-vn' | 'vn-jp';
  meanings: string[];
  partOfSpeech: PartOfSpeech[];
  jlpt: JLPTLevel;
  isCommon: boolean;
  pitchAccent?: string;
  audio?: Audio;
  senses: Sense[];
  kanji: string[];
  exampleIds: string[];
  relatedWordIds: string[];
  searchAliases: string[];
  isSaved: boolean;
  conjugationId?: string;
}

// Example Sentence
export interface Example {
  id: string;
  surface: string;
  reading: string;
  translation: string;
  note?: string;
  audioSrc?: string;
}

// Kanji
export interface Kanji {
  id: string;
  literal: string;
  grade?: number;
  strokeCount: number;
  frequency?: number;
  jlpt?: JLPTLevel;
  meanings: string[];
  kunReadings: string[];
  onReadings: string[];
  nameReadings: string[];
  radical: string;
  components: string[];
  strokeOrder: string[];
  examples: string[];
  audioSrc?: string;
}

// Conjugation
export interface ConjugationRow {
  form: string;
  label: string;
  surface: string;
}

export interface Conjugation {
  id: string;
  wordId: string;
  type: 'verb' | 'adjective';
  base: string;
  rows: ConjugationRow[];
}

// Deck
export interface Deck {
  id: string;
  name: string;
  description?: string;
  cardCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  dueCount: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  tags: string[];
}

// Flashcard
export interface Flashcard {
  id: string;
  deckId: string;
  vocabularyId: string;
  front: string;
  back: string;
  note?: string;
  createdAt: string;
  nextReview?: string;
  interval: number;
  ease: number;
  repetitions: number;
  state: 'new' | 'learning' | 'review';
}

// Review Session
export interface ReviewSession {
  id: string;
  deckId: string;
  startedAt: string;
  completedAt?: string;
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
}

// Search Result
export interface SearchResult {
  vocabulary: Vocabulary;
  matchType: 'exact' | 'partial' | 'alias';
  highlight?: string;
}

// Filter State
export interface FilterState {
  jlpt: JLPTLevel[];
  partOfSpeech: PartOfSpeechCode[];
  isCommon: boolean | null;
  direction: 'jp-vn' | 'vn-jp' | null;
}

// Settings
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontSize: '90' | '100' | '115' | '130';
  showFurigana: boolean;
  autoPlayAudio: boolean;
  reducedMotion: boolean;
  searchDirection: 'jp-vn' | 'vn-jp' | 'both';
}

// Toast Notification
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// Navigation Item
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}