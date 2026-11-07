const STORAGE_KEY = 'yomuji_recent_searches';

export function readRecentSearches() {
  const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Lịch sử tìm kiếm không hợp lệ.');
  }
  return parsed.filter((item) => item.trim().length > 0).slice(0, 8);
}

function writeRecentSearches(items: string[]) {
  if (items.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  else window.localStorage.removeItem(STORAGE_KEY);
}

function notifyRecentSearchesChanged() {
  window.dispatchEvent(new CustomEvent('yomuji:recent_searches'));
}

export function removeRecentSearches(query?: string) {
  const latest = readRecentSearches();
  const removed = query === undefined ? latest : latest.filter((item) => item === query);
  const searches = query === undefined ? [] : latest.filter((item) => item !== query);

  if (removed.length) {
    writeRecentSearches(searches);
    notifyRecentSearchesChanged();
  }

  return { searches, removed };
}

export function restoreRecentSearches(snapshot: string[]) {
  const latest = readRecentSearches();
  const restored = Array.from(new Set([...latest, ...snapshot])).slice(0, 8);
  if (restored.length !== latest.length || restored.some((item, index) => item !== latest[index])) {
    writeRecentSearches(restored);
    notifyRecentSearchesChanged();
  }
  return restored;
}
