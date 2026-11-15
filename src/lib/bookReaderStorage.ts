export type StoredBookReaderPrefs = {
  size?: number;
  dark?: boolean;
  furigana?: boolean;
  saved?: boolean;
  book?: Record<string, unknown>;
};

export type BookReaderStorageResult =
  | { status: 'empty' }
  | { status: 'ok'; value: StoredBookReaderPrefs }
  | { status: 'corrupt' }
  | { status: 'unavailable' };

export type SavedBookRecord = { key: string; slug: string; value: Record<string, unknown> };
export type SavedBookScanResult = { status: 'empty' | 'ok' | 'corrupt' | 'unavailable'; records: SavedBookRecord[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parseBookReaderPrefs(raw: string | null): BookReaderStorageResult {
  if (raw === null) return { status: 'empty' };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: 'corrupt' };
  }

  if (!isRecord(value)
    || (value.size !== undefined && (typeof value.size !== 'number' || !Number.isFinite(value.size)))
    || (value.dark !== undefined && typeof value.dark !== 'boolean')
    || (value.furigana !== undefined && typeof value.furigana !== 'boolean')
    || (value.saved !== undefined && typeof value.saved !== 'boolean')) return { status: 'corrupt' };

  if (value.book !== undefined) {
    const book = value.book;
    if (!isRecord(book)
      || typeof book.slug !== 'string'
      || typeof book.title !== 'string' || !book.title.trim()
      || typeof book.japaneseTitle !== 'string' || !book.japaneseTitle.trim()
      || typeof book.author !== 'string' || !book.author.trim()
      || typeof book.romanizedAuthor !== 'string'
      || (book.minutes !== undefined && (typeof book.minutes !== 'number' || !Number.isFinite(book.minutes)))
      || ['category', 'intro', 'excerpt', 'orthography', 'titleReading', 'credits']
        .some((key) => book[key] !== undefined && typeof book[key] !== 'string')) return { status: 'corrupt' };
  }

  return { status: 'ok', value };
}

export function readBookReaderPrefs(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  expectedSlug: string,
): BookReaderStorageResult {
  try {
    const result = parseBookReaderPrefs(storage.getItem(key));
    if (result.status !== 'ok' || result.value.book === undefined) return result;
    return result.value.book.slug === expectedSlug ? result : { status: 'corrupt' };
  } catch {
    return { status: 'unavailable' };
  }
}

export function writeBookReaderPrefs(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  expectedSlug: string,
  value: StoredBookReaderPrefs,
): 'ok' | 'corrupt' | 'unavailable' {
  try {
    const current = readBookReaderPrefs(storage, key, expectedSlug);
    if (current.status !== 'empty' && current.status !== 'ok') return current.status;
    storage.setItem(key, JSON.stringify(value));
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

export function scanSavedBookRecords(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>,
  prefix: string,
): SavedBookScanResult {
  const records: SavedBookRecord[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = storage.getItem(key);
      if (raw === null) continue;
      const parsed = parseBookReaderPrefs(raw);
      if (parsed.status !== 'ok' || typeof parsed.value.saved !== 'boolean') return { status: 'corrupt', records };
      const slug = key.slice(prefix.length);
      if (parsed.value.book && parsed.value.book.slug !== slug) return { status: 'corrupt', records };
      if (parsed.value.saved) records.push({ key, slug, value: parsed.value as Record<string, unknown> });
    }
  } catch {
    return { status: 'unavailable', records };
  }
  return { status: records.length ? 'ok' : 'empty', records };
}

export function readBookMetadataCache(
  storage: Pick<Storage, 'getItem'>,
  prefix: string,
  slug: string,
): BookReaderStorageResult {
  return readBookReaderPrefs(storage, `${prefix}${slug}`, slug);
}

export function writeBookMetadataCache(
  storage: Pick<Storage, 'setItem'>,
  prefix: string,
  slug: string,
  book: Record<string, unknown>,
): boolean {
  const validated = parseBookReaderPrefs(JSON.stringify({ book }));
  if (validated.status !== 'ok' || validated.value.book?.slug !== slug) return false;
  try {
    storage.setItem(`${prefix}${slug}`, JSON.stringify({ book: validated.value.book }));
    return true;
  } catch {
    return false;
  }
}
