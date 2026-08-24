export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface ExampleRecord {
  id: string;
  termSequence: number;
  textJa: string;
  textVi: string;
  highlight?: string;
}

export interface RelatedTerm {
  label: string;
  id?: string;
}

export interface TermRecord {
  id: string;
  sequence: number;
  surface: string;
  reading: string;
  romaji: string;
  hanVietStr?: string;
  kanjiReadings?: Array<{
    literal: string;
    hanViet: string[];
  }>;
  meaningsVi: string[];
  glossesRaw: string[];
  partOfSpeech: string[];
  tags: string[];
  score: number;
  isCommon: boolean;
  kanji: string[];
  examples: ExampleRecord[];
  related: RelatedTerm[];
  searchAliases: string[];
  source: {
    jmdict?: boolean;
    omoha?: boolean;
    omohaOnly?: boolean;
  };
}

export interface StrokePath {
  id: number;
  d: string;
  type?: string;
  duration?: number;
}

export interface KanjiRecord {
  literal: string;
  onReadings: string[];
  kunReadings: string[];
  hanViet: string[];
  meanings: string[];
  meaningsRaw?: string[];
  radical?: string;
  penStrokes?: string;
  strokeCount?: number;
  jlpt?: JLPTLevel;
  grade?: number;
  frequency?: number;
  unicode?: string;
  tags: string[];
  components: string[];
  strokePaths: StrokePath[];
  strokeSvgRaw?: string;
  rawReadings?: {
    on?: string;
    kun?: string;
    other?: string[];
  };
}

export interface TermLookupResponse {
  term: TermRecord | null;
}

export interface KanjiLookupResponse {
  kanji: KanjiRecord | null;
}

export interface SearchIndexEntry {
  termId: string;
  sequence: number;
  surface: string;
  reading: string;
  romaji: string;
  meaningsPreview: string[];
  partOfSpeech: string[];
  tags: string[];
  score: number;
  isCommon: boolean;
  kanji: string[];
  tokens: string[];
}

export interface KanjiSearchIndexEntry {
  literal: string;
  meaningsPreview: string[];
  onReadings: string[];
  kunReadings: string[];
  hanViet: string[];
  jlpt?: JLPTLevel;
  frequency?: number;
  tokens: string[];
}

export interface DictionaryShard {
  id: string;
  type: 'terms' | 'search' | 'kanji' | 'kanji-search' | 'examples' | 'meta';
  url: string;
  compressedUrl?: string;
  bytes: number;
  compressedBytes?: number;
  sha256: string;
  compressedSha256?: string;
  recordCount: number;
}

export interface DictionaryManifest {
  schemaVersion: number;
  dataVersion: string;
  generatedAt: string;
  basePath?: string;
  totals: {
    terms: number;
    kanji: number;
    examples: number;
    termShards: number;
    searchShards: number;
    kanjiShards: number;
    exampleShards?: number;
  };
  shards: DictionaryShard[];
  attribution: Array<{
    name: string;
    sourcePath: string;
    license?: string;
    note?: string;
  }>;
}

export interface DictionaryShardPayload<T> {
  schemaVersion: number;
  dataVersion: string;
  type: DictionaryShard['type'];
  format?: 'compact-array';
  records: T[];
}

export type DictionaryStatus = 'idle' | 'checking' | 'downloading' | 'indexing' | 'ready' | 'error';

export interface DictionaryProgress {
  status: DictionaryStatus;
  message: string;
  dataVersion?: string;
  downloadedBytes: number;
  totalBytes: number;
  downloadedShards: number;
  totalShards: number;
  error?: string;
}

export interface DictionaryState {
  progress: DictionaryProgress;
  manifest?: DictionaryManifest;
  isReady: boolean;
  isOfflineCapable: boolean;
}

export type SearchMatchType =
  | 'exact-surface'
  | 'exact-reading'
  | 'exact-romaji'
  | 'exact-meaning'
  | 'prefix'
  | 'partial';

export interface DictionarySearchResult {
  term: TermRecord;
  score: number;
  matchType: SearchMatchType;
}

export interface KanjiDictionarySearchResult {
  kanji: KanjiRecord;
  score: number;
  matchType: SearchMatchType | 'exact-kanji' | 'han-viet';
}
