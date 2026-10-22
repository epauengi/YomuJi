'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookmarkSimple, WarningCircle, ArrowsClockwise } from '@phosphor-icons/react';
import { getBook, type Book } from '@/data/books';

const STORAGE_KEY = 'yomuji_book_reader_v1';
const PREFIX = `${STORAGE_KEY}:`;
const CHUNK_SIZE = 50;

function isValidSlug(slug: string): boolean {
  return !!getBook(slug) || /^work-[1-9]\d{0,5}$/.test(slug);
}

function isValidStoredBook(obj: unknown, expectedSlug: string): obj is Book {
  if (!obj || typeof obj !== 'object') return false;
  const b = obj as Record<string, unknown>;
  if (typeof b.slug !== 'string' || b.slug !== expectedSlug) return false;
  if (typeof b.title !== 'string' || !b.title.trim()) return false;
  if (typeof b.japaneseTitle !== 'string' || !b.japaneseTitle.trim()) return false;
  if (typeof b.author !== 'string' || !b.author.trim()) return false;
  if (typeof b.romanizedAuthor !== 'string') return false;
  if (b.minutes !== undefined && (typeof b.minutes !== 'number' || !Number.isFinite(b.minutes))) return false;
  return true;
}

function normalizeStoredBook(b: Record<string, unknown>, slug: string): Book {
  return {
    slug,
    title: String(b.title),
    japaneseTitle: String(b.japaneseTitle),
    author: String(b.author),
    romanizedAuthor: typeof b.romanizedAuthor === 'string' ? b.romanizedAuthor : '',
    minutes: typeof b.minutes === 'number' && Number.isFinite(b.minutes) ? b.minutes : undefined,
    category: typeof b.category === 'string' ? b.category : 'Khác',
    intro: typeof b.intro === 'string' ? b.intro : '',
    excerpt: typeof b.excerpt === 'string' ? b.excerpt : '',
    orthography: typeof b.orthography === 'string' ? b.orthography : undefined,
    titleReading: typeof b.titleReading === 'string' ? b.titleReading : undefined,
    credits: typeof b.credits === 'string' ? b.credits : undefined,
  };
}

export default function SavedBooksPage() {
  const [savedBooks, setSavedBooks] = useState<Book[]>([]);
  const [unavailableSlugs, setUnavailableSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);

    setLoading(true);
    setError('');

    async function loadSavedBooks() {
      // 1. Scan localStorage for keys with prefix
      const savedSlugs: string[] = [];
      const offlineMap = new Map<string, Book>();
      const unresolvedSlugs: string[] = [];

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(PREFIX)) continue;
          const slug = key.slice(PREFIX.length);
          if (!isValidSlug(slug)) continue;

          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || parsed.saved !== true) continue;

            savedSlugs.push(slug);

            // Local curated first
            const curated = getBook(slug);
            if (curated) {
              offlineMap.set(slug, curated);
              continue;
            }

            // Valid stored metadata
            if (isValidStoredBook(parsed.book, slug)) {
              offlineMap.set(slug, normalizeStoredBook(parsed.book as Record<string, unknown>, slug));
              continue;
            }

            // Needs remote resolution
            unresolvedSlugs.push(slug);
          } catch {
            // Corrupt records ignore only that record
          }
        }
      } catch {
        // LocalStorage access failure
      }

      // No saved books at all
      if (savedSlugs.length === 0) {
        if (active) {
          setSavedBooks([]);
          setUnavailableSlugs([]);
          setLoading(false);
          setReady(true);
        }
        window.clearTimeout(timeout);
        return;
      }

      // If no unresolved slugs, render immediately offline
      if (unresolvedSlugs.length === 0) {
        if (active) {
          const ordered = savedSlugs.map((slug) => offlineMap.get(slug)).filter((b): b is Book => Boolean(b));
          setSavedBooks(ordered);
          setUnavailableSlugs([]);
          setLoading(false);
          setReady(true);
        }
        window.clearTimeout(timeout);
        return;
      }

      // Fetch unresolved in chunks of max 50
      const fetchedMap = new Map<string, Book>();
      const chunks: string[][] = [];
      for (let i = 0; i < unresolvedSlugs.length; i += CHUNK_SIZE) {
        chunks.push(unresolvedSlugs.slice(i, i + CHUNK_SIZE));
      }

      try {
        for (const chunk of chunks) {
          const res = await fetch(`/api/books?slugs=${encodeURIComponent(chunk.join(','))}`, {
            signal: controller.signal,
          });
          if (!res.ok) {
            throw new Error(`Catalogue unavailable: ${res.status}`);
          }
          const data = await res.json();
          if (Array.isArray(data?.books)) {
            for (const book of data.books as Book[]) {
              if (book && typeof book.slug === 'string') {
                fetchedMap.set(book.slug, book);

                // Cache metadata back to localStorage safely
                try {
                  const raw = localStorage.getItem(`${PREFIX}${book.slug}`);
                  if (raw) {
                    const record = JSON.parse(raw);
                    if (record && typeof record === 'object' && record.saved === true) {
                      record.book = {
                        slug: book.slug,
                        title: book.title,
                        japaneseTitle: book.japaneseTitle,
                        author: book.author,
                        romanizedAuthor: book.romanizedAuthor,
                        ...(book.minutes !== undefined ? { minutes: book.minutes } : {}),
                        ...(book.category ? { category: book.category } : {}),
                        ...(book.intro ? { intro: book.intro } : {}),
                        ...(book.excerpt ? { excerpt: book.excerpt } : {}),
                        ...(book.orthography ? { orthography: book.orthography } : {}),
                        ...(book.titleReading ? { titleReading: book.titleReading } : {}),
                        ...(book.credits ? { credits: book.credits } : {}),
                      };
                      localStorage.setItem(`${PREFIX}${book.slug}`, JSON.stringify(record));
                    }
                  }
                } catch {
                  // Storage quota or blocked
                }
              }
            }
          }
        }

        const missing = unresolvedSlugs.filter((slug) => !fetchedMap.has(slug));
        const allResolved: Book[] = [];
        for (const slug of savedSlugs) {
          const match = offlineMap.get(slug) || fetchedMap.get(slug);
          if (match) allResolved.push(match);
        }

        if (active) {
          setSavedBooks(allResolved);
          setUnavailableSlugs(missing);
          setLoading(false);
          setReady(true);
        }
      } catch {
        if (active) {
          // Preserve any offline books available; do not masquerade as empty
          const fallback = savedSlugs.map((slug) => offlineMap.get(slug)).filter((b): b is Book => Boolean(b));
          setSavedBooks(fallback);
          setError('Chưa kết nối được với máy chủ để tải thông tin các truyện đã lưu.');
          setLoading(false);
          setReady(true);
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadSavedBooks();

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  const removeUnavailable = useCallback(() => {
    setUnavailableSlugs((slugs) => {
      for (const slug of slugs) {
        try {
          localStorage.removeItem(`${PREFIX}${slug}`);
        } catch {
          // ignore
        }
      }
      return [];
    });
  }, []);

  return (
    <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/books"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary-700)]"
      >
        <ArrowLeft size={18} aria-hidden="true" /> Thư viện
      </Link>
      <div className="mt-8 flex items-center gap-3">
        <BookmarkSimple size={25} className="text-[var(--color-primary-700)]" aria-hidden="true" />
        <h1 className="font-serif text-3xl font-semibold">Sách của tôi</h1>
      </div>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">Đã lưu trên thiết bị này.</p>

      {!ready || loading ? (
        <p className="mt-8 text-sm text-[var(--color-text-muted)]">Đang tải…</p>
      ) : error && savedBooks.length === 0 ? (
        <div role="alert" className="mt-8 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
            <WarningCircle size={20} className="text-amber-600" aria-hidden="true" />
            <h2 className="font-serif text-xl font-semibold">Nội dung chưa sẵn sàng</h2>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-action-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)]"
          >
            <ArrowsClockwise size={16} aria-hidden="true" /> Thử lại
          </button>
        </div>
      ) : savedBooks.length > 0 ? (
        <>
          {error && (
            <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">{error}</span>
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="inline-flex min-h-9 items-center gap-1 font-semibold text-[var(--color-primary-700)] hover:underline"
              >
                <ArrowsClockwise size={15} aria-hidden="true" /> Thử lại
              </button>
            </div>
          )}

          <ul className="mt-7 divide-y divide-[var(--color-border-subtle)] border-y border-[var(--color-border-subtle)]">
            {savedBooks.map((book) => (
              <li key={book.slug}>
                <Link
                  href={`/books/${book.slug}`}
                  className="flex min-h-16 items-center justify-between gap-4 py-3 hover:text-[var(--color-primary-700)]"
                >
                  <span>
                    <span className="block font-semibold">{book.title}</span>
                    <span lang="ja" className="jp-text text-sm text-[var(--color-text-muted)]">
                      {book.author}
                    </span>
                  </span>
                  <span className="text-sm">Mở truyện →</span>
                </Link>
              </li>
            ))}
          </ul>

          {unavailableSlugs.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
              <span>{unavailableSlugs.length} truyện đã lưu không còn trong thư viện.</span>
              <button
                type="button"
                onClick={removeUnavailable}
                className="font-medium underline hover:text-[var(--color-text-primary)]"
              >
                Xóa khỏi danh sách
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center">
          <p className="font-medium">Chưa lưu truyện nào.</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Mở một truyện rồi nhấn biểu tượng dấu trang.</p>
          <Link
            href="/books"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--color-action-primary)] px-5 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]"
          >
            Khám phá thư viện
          </Link>
        </div>
      )}
    </main>
  );
}
