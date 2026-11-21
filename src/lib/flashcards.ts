import { demoDecks, demoWords } from '../data/mockData';

export type Flashcard = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  dueAt: number;
  reviewedAt: number | null;
  known: boolean | null;
  sentence?: string;
  source?: { title: string; href: string };
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
  sentence: 500,
  sourceTitle: 200,
  sourceHref: 300,
};
const CARD_KEYS = ['id', 'word', 'reading', 'meaning', 'dueAt', 'reviewedAt', 'known'];
const READER_DECK = { id: 'reader-words', name: 'Từ trong truyện', description: 'Từ lưu khi đọc truyện, kèm câu gốc.' };

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
    || !exactKeys(value, [...CARD_KEYS, ...['sentence', 'source'].filter((key) => Object.hasOwn(value, key))])) invalid();
  const card = value as Record<string, unknown>;
  if (card.known !== null && typeof card.known !== 'boolean') invalid();
  if (card.reviewedAt !== null) timestamp(card.reviewedAt);
  let source: Flashcard['source'];
  if (card.source !== undefined) {
    const value = card.source;
    if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, ['title', 'href'])) invalid();
    const { title, href } = value as Record<string, unknown>;
    source = { title: text(title, STRING_LIMITS.sourceTitle, true), href: text(href, STRING_LIMITS.sourceHref, true) };
    // Same-origin reader links only; stored data must never become an open redirect or javascript: URL.
    if (!/^\/books\/[\w-]+(?:\/read)?$/u.test(source.href)) invalid();
  }
  return {
    ...(card.sentence !== undefined ? { sentence: text(card.sentence, STRING_LIMITS.sentence, true) } : {}),
    ...(source ? { source } : {}),
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

export type ReaderCardInput = { word: string; reading: string; meaning: string; sentence: string; source: { title: string; href: string } };

/** Adds a card to the "Từ trong truyện" deck, creating it if needed. Returns false when the same word+sentence exists. */
export async function saveReaderCard(input: ReaderCardInput): Promise<boolean> {
  const { data, raw } = loadFlashcards();
  const deck = data.decks.find((item) => item.id === READER_DECK.id);
  if (deck?.cards.some((card) => card.word === input.word && card.sentence === input.sentence)) return false;
  if ((!deck && data.decks.length >= MAX_DECKS) || data.decks.reduce((count, item) => count + item.cards.length, 0) >= MAX_CARDS) {
    invalid('Đã đạt giới hạn 100 bộ thẻ hoặc 10.000 thẻ trên thiết bị. Hãy xóa bớt dữ liệu trước.');
  }
  const card: Flashcard = {
    id: crypto.randomUUID(),
    word: input.word.slice(0, STRING_LIMITS.word),
    reading: input.reading.slice(0, STRING_LIMITS.reading),
    meaning: input.meaning.slice(0, STRING_LIMITS.meaning),
    dueAt: 0, reviewedAt: null, known: null,
    sentence: input.sentence.slice(0, STRING_LIMITS.sentence),
    source: input.source,
  };
  const decks = deck
    ? data.decks.map((item) => item === deck ? { ...item, cards: [...item.cards, card] } : item)
    : [...data.decks, { ...READER_DECK, sample: false, cards: [card] }];
  await saveFlashcards({ ...data, decks }, raw);
  return true;
}

const tsvField = (value: string) => {
  const flat = value.replace(/[\t\r\n]+/gu, ' ').trim();
  return flat.includes('"') ? `"${flat.replaceAll('"', '""')}"` : flat;
};

/** Anki "Import File" text format: https://docs.ankiweb.net/importing/text-files.html
 * Reader cards copy their meaning from Omoha, whose translation licence is unverified, so it is opt-in. */
export function toAnkiTsv(deck: Deck, origin: string, dictionaryMeanings = false): string {
  const rows = deck.cards.map((card) => [card.word, card.reading, !card.source || dictionaryMeanings ? card.meaning : '', card.sentence ?? '',
    card.source ? `${card.source.title} ${origin}${card.source.href}` : ''].map(tsvField).join('\t'));
  return ['#separator:tab', '#html:false', '#columns:Từ\tCách đọc\tNghĩa\tCâu\tNguồn', ...rows].join('\n') + '\n';
}

export function gradeCard(card: Flashcard, known: boolean, now: number): Flashcard {
  if (typeof known !== 'boolean') invalid();
  timestamp(now);
  const validated = validateCard(card);
  const dueAt = now + (known ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000);
  timestamp(dueAt);
  return { ...validated, reviewedAt: now, known, dueAt };
}
