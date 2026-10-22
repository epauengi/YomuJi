'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BookmarkSimple } from '@phosphor-icons/react';
import { books } from '@/data/books';

const STORAGE_KEY = 'yomuji_book_reader_v1';

export default function SavedBooksPage() {
  const [savedBooks, setSavedBooks] = useState<typeof books>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setSavedBooks(books.filter((book) => {
        const raw = localStorage.getItem(`${STORAGE_KEY}:${book.slug}`);
        if (!raw) return false;
        const value: unknown = JSON.parse(raw);
        return typeof value === 'object' && value !== null && 'saved' in value && value.saved === true;
      }));
    } catch { setSavedBooks([]); }
    setReady(true);
  }, []);

  return <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-8 sm:px-6">
    <Link href="/books" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary-700)]"><ArrowLeft size={18} /> Thư viện</Link>
    <div className="mt-8 flex items-center gap-3"><BookmarkSimple size={25} className="text-[var(--color-primary-700)]" /><h1 className="font-serif text-3xl font-semibold">Sách của tôi</h1></div>
    <p className="mt-2 text-sm text-[var(--color-text-muted)]">Đã lưu trên thiết bị này.</p>
    {!ready ? <p className="mt-8 text-sm text-[var(--color-text-muted)]">Đang tải…</p> : savedBooks.length ? <ul className="mt-7 divide-y divide-[var(--color-border-subtle)] border-y border-[var(--color-border-subtle)]">{savedBooks.map((book) => <li key={book.slug}><Link href={`/books/${book.slug}`} className="flex min-h-16 items-center justify-between gap-4 py-3 hover:text-[var(--color-primary-700)]"><span><span className="block font-semibold">{book.title}</span><span lang="ja" className="jp-text text-sm text-[var(--color-text-muted)]">{book.author}</span></span><span className="text-sm">Mở truyện →</span></Link></li>)}</ul> : <div className="mt-8 rounded-xl border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center"><p className="font-medium">Chưa lưu truyện nào.</p><p className="mt-1 text-sm text-[var(--color-text-muted)]">Mở một truyện rồi nhấn biểu tượng dấu trang.</p><Link href="/books" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--color-action-primary)] px-5 font-semibold text-white">Khám phá thư viện</Link></div>}
  </main>;
}
