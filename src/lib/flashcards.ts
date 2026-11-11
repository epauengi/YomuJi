import { demoDecks, demoWords } from '../data/mockData';

export type Flashcard = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  dueAt: number;
  reviewedAt: number | null;
  known: boolean | null;
};

export type Deck = {
  id: string;
  name: string;
  description: string;
  sample: boolean;
  cards: Flashcard[];
};

export type FlashcardData = { version: 1; decks: Deck[] };

export const STORAGE_KEY = 'yomuji_flashcards';

const MAX_DECKS = 100;
const MAX_CARDS = 10000;
const STRING_LIMITS = {
  id: 200,
  name: 80,
  description: 300,
  word: 100,
  reading: 200,
  meaning: 1000,
};

function invalid(message = 'Dữ liệu flashcard không hợp lệ') : never {
  throw new Error(message);
}

function exactKeys(value: object, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function text(value: unknown, limit: number, required: boolean) {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) invalid();
  return value;
}

function timestamp(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 8.64e15) {
    invalid('Thời gian flashcard không hợp lệ');
  }
  return value;
}

function validateCard(value: unknown): Flashcard {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !exactKeys(value, ['id', 'word', 'reading', 'meaning', 'dueAt', 'reviewedAt', 'known'])) invalid();
  const card = value as Record<string, unknown>;
  if (card.known !== null && typeof card.known !== 'boolean') invalid();
  if (card.reviewedAt !== null) timestamp(card.reviewedAt);
  return {
    id: text(card.id, STRING_LIMITS.id, true),
    word: text(card.word, STRING_LIMITS.word, true),
    reading: text(card.reading, STRING_LIMITS.reading, false),
    meaning: text(card.meaning, STRING_LIMITS.meaning, true),
    dueAt: timestamp(card.dueAt),
    reviewedAt: card.reviewedAt as number | null,
    known: card.known as boolean | null,
  };
}

function validateData(value: unknown): FlashcardData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const root = value as Record<string, unknown>;
  if (root.version !== 1) invalid('Phiên bản dữ liệu flashcard không được hỗ trợ');
  if (!exactKeys(root, ['version', 'decks']) || !Array.isArray(root.decks) || root.decks.length > MAX_DECKS) invalid();

  let totalCards = 0;
  const ids = new Set<string>();
  const decks = root.decks.map((value): Deck => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || !exactKeys(value, ['id', 'name', 'description', 'sample', 'cards'])) invalid();
    const deck = value as Record<string, unknown>;
    if (typeof deck.sample !== 'boolean' || !Array.isArray(deck.cards)) invalid();
    totalCards += deck.cards.length;
    if (totalCards > MAX_CARDS) invalid();
    const id = text(deck.id, STRING_LIMITS.id, true);
    const cards = deck.cards.map(validateCard);
    for (const card of cards) {
      if (ids.has(card.id)) invalid('Mã flashcard bị trùng lặp');
      ids.add(card.id);
    }
    if (ids.has(id)) invalid('Mã flashcard bị trùng lặp');
    ids.add(id);
    return {
      id,
      name: text(deck.name, STRING_LIMITS.name, true),
      description: text(deck.description, STRING_LIMITS.description, false),
      sample: deck.sample,
      cards,
    };
  });

  return { version: 1, decks };
}

export function initialFlashcards(): FlashcardData {
  return {
    version: 1,
    decks: demoDecks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      sample: true,
      cards: demoWords.filter((word) => word.deck === deck.id).map((word) => ({
        id: word.id,
        word: word.word,
        reading: word.reading,
        meaning: word.meaning,
        dueAt: 0,
        reviewedAt: null,
        known: null,
      })),
    })),
  };
}

export function parseFlashcards(raw: string): FlashcardData {
  if (typeof raw !== 'string') invalid();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    invalid('Dữ liệu flashcard bị lỗi định dạng JSON');
  }
  return validateData(value);
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    throw new Error('Không thể truy cập bộ nhớ flashcard của trình duyệt');
  }
}

export function loadFlashcards(): { data: FlashcardData; raw: string | null } {
  const localStorage = storage();
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error('Không thể đọc flashcard từ bộ nhớ trình duyệt');
  }
  return { data: raw === null ? initialFlashcards() : parseFlashcards(raw), raw };
}

export function saveFlashcards(data: FlashcardData, previousRaw: string | null): Promise<string> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks || typeof locks.request !== 'function') {
    return Promise.reject(new Error('Trình duyệt không hỗ trợ khóa đồng bộ flashcard an toàn'));
  }
  return locks.request(STORAGE_KEY, () => {
    const validated = validateData(data);
    const raw = JSON.stringify(validated);
    const localStorage = storage();
    let currentRaw: string | null;
    try {
      currentRaw = localStorage.getItem(STORAGE_KEY);
    } catch {
      throw new Error('Không thể đọc flashcard từ bộ nhớ trình duyệt');
    }
    if (currentRaw !== previousRaw) {
      throw new Error('Flashcard đã được thay đổi ở thẻ khác. Hãy tải lại trước khi lưu.');
    }
    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      throw new Error('Không thể lưu flashcard vào bộ nhớ trình duyệt');
    }
    return raw;
  });
}

export function gradeCard(card: Flashcard, known: boolean, now: number): Flashcard {
  if (typeof known !== 'boolean') invalid();
  timestamp(now);
  const validated = validateCard(card);
  const dueAt = now + (known ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000);
  timestamp(dueAt);
  return { ...validated, reviewedAt: now, known, dueAt };
}
