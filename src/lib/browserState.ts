export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_KEY = 'yomuji_theme';
const THEME_EVENT = 'yomuji:theme-changed';
const BOOKMARKS_KEY = 'yomuji_bookmarks';
const BOOKMARKS_EVENT = 'yomuji:bookmarks-changed';

let bookmarkMemory = new Set<string>();
let bookmarkStorageAvailable: boolean | null = null;

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

function parseBookmarks(value: string | null) {
  if (!value) return new Set<string>();
  try {
    const parsed: unknown = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

export function readBookmarks() {
  if (!canUseBrowser()) return new Set(bookmarkMemory);
  if (bookmarkStorageAvailable === false) return new Set(bookmarkMemory);
  try {
    bookmarkMemory = parseBookmarks(window.localStorage.getItem(BOOKMARKS_KEY));
    bookmarkStorageAvailable = true;
  } catch {
    bookmarkStorageAvailable = false;
  }
  return new Set(bookmarkMemory);
}

export function setBookmark(item: string, saved: boolean) {
  const next = readBookmarks();
  if (saved) next.add(item);
  else next.delete(item);
  bookmarkMemory = next;

  if (canUseBrowser()) {
    try {
      window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...next]));
      bookmarkStorageAvailable = true;
    } catch {
      bookmarkStorageAvailable = false;
    }
    window.dispatchEvent(new CustomEvent(BOOKMARKS_EVENT));
  }
  return new Set(next);
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
