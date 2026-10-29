export interface ConjugationForm {
  id: string;
  form: string;
  reading?: string;
  alternative?: string;
  matched: boolean;
}

export interface ConjugationSection {
  id: string;
  forms: ConjugationForm[];
}

export interface ConjugationEntry {
  sequence: number;
  surface: string;
  reading: string;
}

export interface ConjugationData {
  query: string;
  baseForm?: string;
  rules: string[];
  entries: Array<{
    sequence: number;
    surface: string;
    reading: string;
  }>;
  sections: Array<{
    id: string;
    forms: Array<{
      id: string;
      form: string;
      reading?: string;
      alternative?: string;
      matched: boolean;
    }>;
  }>;
  group?: string;
}

export type KotobaMode = 'search' | 'forms';

const JAPANESE_CHAR_RE = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\u3005]+$/;
const HAS_KANA_RE = /[\u3041-\u3096\u30A1-\u30FA]/;

export function isConjugationQuery(query: string): boolean {
  if (typeof query !== 'string') return false;
  const q = query.trim();
  if (q.length === 0 || q.length > 80) return false;
  if (/\s/.test(q)) return false;
  if (!JAPANESE_CHAR_RE.test(q)) return false;
  return HAS_KANA_RE.test(q);
}
