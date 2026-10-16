import { wordHref } from './wordRoutes';
import type { KanjiRecord, TermRecord } from '@/types/dictionary';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_KEY = 'yomuji_theme';
const THEME_EVENT = 'yomuji:theme-changed';
const BOOKMARKS_KEY = 'yomuji_bookmarks';
const BOOKMARKS_EVENT = 'yomuji:bookmarks-changed';

export type SavedBookmark = {
  id: string;
  kind: 'term' | 'kanji' | 'legacy';
  surface: string;
  reading: string;
  meanings: string[];
  href: string;
};

export function termBookmark(term: TermRecord): SavedBookmark {
  return {
    id: `term:${term.id}`, kind: 'term', surface: term.surface, reading: term.reading,
    meanings: term.meaningsVi.slice(0, 3), href: wordHref(term),
  };
}

export function kanjiBookmark(kanji: KanjiRecord): SavedBookmark {
  return {
    id: `kanji:${kanji.literal}`, kind: 'kanji', surface: kanji.literal,
    reading: kanji.hanViet.join(', '), meanings: kanji.meanings.slice(0, 3),
    href: `/kanji/${encodeURIComponent(kanji.literal)}`,
  };
}

let bookmarkMemory: SavedBookmark[] = [];
let bookmarkStorageAvailable = true;
let bookmarkDataInvalid = false;

function canUseBrowser() {
  return typeof window !== 'undefined';
}

export function readThemePreference(): ThemePreference {
  if (!canUseBrowser()) return 'system';
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyThemePreference(preference: ThemePreference) {
  if (!canUseBrowser()) return;
  const dark = preference === 'dark'
    || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function writeThemePreference(preference: ThemePreference) {
  if (!canUseBrowser()) return;
  try {
    window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // The applied theme still works for this page when storage is blocked.
  }
  applyThemePreference(preference);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: preference }));
}

export function subscribeToTheme(listener: (preference: ThemePreference) => void) {
  if (!canUseBrowser()) return () => {};

  let removeSystemListener = () => {};
  const apply = (preference: ThemePreference) => {
    removeSystemListener();
    applyThemePreference(preference);
    if (preference === 'system') {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = () => applyThemePreference('system');
      query.addEventListener('change', handleSystemChange);
      removeSystemListener = () => query.removeEventListener('change', handleSystemChange);
    } else {
      removeSystemListener = () => {};
    }
    listener(preference);
  };
  const handleThemeChange = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    apply(detail === 'light' || detail === 'dark' || detail === 'system' ? detail : readThemePreference());
  };
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === THEME_KEY) apply(readThemePreference());
  };

  window.addEventListener(THEME_EVENT, handleThemeChange);
  window.addEventListener('storage', handleStorage);
  apply(readThemePreference());
  return () => {
    removeSystemListener();
    window.removeEventListener(THEME_EVENT, handleThemeChange);
    window.removeEventListener('storage', handleStorage);
  };
}

function isBookmark(value: unknown): value is SavedBookmark {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedBookmark>;
  return typeof item.id === 'string' && item.id.length > 0
    && ['term', 'kanji', 'legacy'].includes(item.kind || '')
    && typeof item.surface === 'string' && item.surface.length > 0
    && typeof item.reading === 'string'
    && Array.isArray(item.meanings) && item.meanings.every((meaning) => typeof meaning === 'string')
    && typeof item.href === 'string'
    && (item.kind === 'term' ? /^\/word\/[^/?#]+(?:\?id=\d+)?$/u.test(item.href)
      : item.kind === 'kanji' ? /^\/kanji\/[^/?#]+$/u.test(item.href)
        : /^\/\?q=[^&#]+$/u.test(item.href));
}

function parseBookmarks(value: string | null): SavedBookmark[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
    return [...new Set(parsed)].filter((surface) => surface.trim()).map((surface) => ({
      id: `legacy:${surface}`, kind: 'legacy', surface, reading: '', meanings: [],
      href: `/?q=${encodeURIComponent(surface)}`,
    }));
  }
  if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 2
    || !('items' in parsed) || !Array.isArray(parsed.items) || !parsed.items.every(isBookmark)) {
    throw new Error('Dữ liệu đã lưu không hợp lệ');
  }
  return [...new Map(parsed.items.map((item) => [item.id, item])).values()];
}

export function readBookmarks(): SavedBookmark[] {
  if (!canUseBrowser() || (!bookmarkStorageAvailable && !bookmarkDataInvalid)) return [...bookmarkMemory];
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(BOOKMARKS_KEY);
  } catch {
    bookmarkStorageAvailable = false;
    return [...bookmarkMemory];
  }
  try {
    bookmarkMemory = parseBookmarks(raw);
    bookmarkStorageAvailable = true;
    bookmarkDataInvalid = false;
  } catch {
    // Preserve unreadable storage rather than overwriting potentially recoverable data.
    bookmarkStorageAvailable = false;
    bookmarkDataInvalid = true;
  }
  return [...bookmarkMemory];
}

export function readBookmarkStorageAvailable() {
  return bookmarkStorageAvailable;
}

export function setBookmark(item: SavedBookmark, saved: boolean) {
  if (!isBookmark(item)) throw new Error('Mục lưu không hợp lệ');
  const current = readBookmarks();
  if (bookmarkDataInvalid) throw new Error('Không thể đọc dữ liệu đã lưu. Dữ liệu gốc được giữ nguyên; hãy kiểm tra bộ nhớ trình duyệt.');
  const next = current.filter((entry) => entry.id !== item.id
    && !(saved && item.kind !== 'legacy' && entry.kind === 'legacy' && entry.surface === item.surface));
  if (saved) next.unshift(item);
  bookmarkMemory = next;

  if (canUseBrowser()) {
    try {
      window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify({ version: 2, items: next }));
      bookmarkStorageAvailable = true;
    } catch {
      bookmarkStorageAvailable = false;
    }
    window.dispatchEvent(new CustomEvent(BOOKMARKS_EVENT));
  }
  return [...next];
}

export function subscribeToBookmarks(listener: () => void) {
  if (!canUseBrowser()) return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === BOOKMARKS_KEY) listener();
  };
  window.addEventListener(BOOKMARKS_EVENT, listener);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(BOOKMARKS_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}
