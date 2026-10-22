import 'server-only';
import type { Book } from '@/data/books';

type OpenLibraryDoc = {
  title?: string;
  author_name?: string[];
  cover_i?: number;
};

function normalizeMatch(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[澤]/g, '沢')
    .replace(/[齋齊]/g, '斎')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

export function mapOpenLibraryCovers(books: Book[], docs: OpenLibraryDoc[]): Record<string, string> {
  const covers: Record<string, string> = {};

  for (const book of books) {
    const exactTitle = normalizeMatch(book.japaneseTitle);
    const canonicalTitle = normalizeMatch(book.japaneseTitle.replace(/[「『](.+?)[」』](?:序|新刊案内|広告文)?$/, '$1'));
    const matchesTitle = (doc: OpenLibraryDoc) => !!doc.cover_i && !!doc.title && normalizeMatch(doc.title) === exactTitle;
    const exactMatches = docs.filter(matchesTitle);
    const candidates = exactMatches.length || canonicalTitle === exactTitle
      ? exactMatches
      : docs.filter((doc) => !!doc.cover_i && !!doc.title && normalizeMatch(doc.title) === canonicalTitle);
    const author = normalizeMatch(book.author);
    const match = candidates.find((doc) => doc.author_name?.some((name) => normalizeMatch(name) === author));

    if (match?.cover_i) {
      covers[book.slug] = `https://covers.openlibrary.org/b/id/${match.cover_i}-M.jpg?default=false`;
    }
  }

  return covers;
}

export async function getBookCoverUrls(books: Book[]): Promise<Record<string, string>> {
  if (!books.length) return {};

  const titles = [...new Set(books.map((book) => book.japaneseTitle).filter(Boolean))];
  const query = titles.map((title) => `title:"${title.replace(/[\\"]/g, '\\$&')}"`).join(' OR ');
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'title,author_name,cover_i');
  url.searchParams.set('limit', '100');

  try {
    // ponytail: one cached batch per visible shelf; add a shared cache only if request volume outgrows Open Library's limits.
    const response = await fetch(url, {
      headers: { 'User-Agent': 'YomuJi/1.0 (personal Japanese reading library)' },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return {};

    const data = await response.json() as { docs?: OpenLibraryDoc[] };
    return mapOpenLibraryCovers(books, data.docs ?? []);
  } catch {
    return {};
  }
}
