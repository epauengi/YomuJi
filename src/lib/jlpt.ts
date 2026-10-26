export type Category = 'vocabulary_kanji' | 'grammar' | 'reading';
export type Mode = 'mock' | 'practice';

export const CATEGORIES = [
  { id: 'vocabulary_kanji', label: 'Từ vựng / Kanji' },
  { id: 'grammar', label: 'Ngữ pháp' },
  { id: 'reading', label: 'Đọc hiểu' },
] as const;

export interface PaperQuestionChoice {
  id: number;
  text: string;
}

export interface PaperQuestionPassageText {
  label: string;
  text: string;
}

export interface PaperQuestionPassage {
  id: string;
  text?: string;
  texts?: PaperQuestionPassageText[];
}

export interface PaperQuestion {
  id: string;
  format: string;
  question: string;
  choices: PaperQuestionChoice[];
  focus?: string;
  answer_rule?: string;
  passage_id?: string;
  blank_number?: number;
  star_blank_index?: number;
  category: Category;
  categoryLabel: string;
  problemNumber: number;
  subtype: string;
  instruction: string;
  passage?: PaperQuestionPassage;
}

export interface Paper {
  title: string;
  number: number;
  mode: Mode;
  durationMinutes: number | null;
  questions: PaperQuestion[];
}

export interface CatalogPart {
  category: Category;
  label: string;
  questionCount: number;
}

export interface CatalogExam {
  number: number;
  questionCount: number;
  parts: CatalogPart[];
}

export interface Catalog {
  exams: CatalogExam[];
  durationMinutes: number;
  totalQuestions: number;
}

export interface GradeSection {
  category: Category;
  label: string;
  correct: number;
  total: number;
}

export interface AnswerDetail {
  answer: number;
  full_order?: number[];
  completed_sentence?: string;
}

export interface Grade {
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  sections: GradeSection[];
  answers: Record<string, AnswerDetail>;
}

export function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
