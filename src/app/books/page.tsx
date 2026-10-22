'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react';
import { bookCategories, books, type Book } from '@/data/books';

type CataloguePage = { books: Book[]; total: number; page: number; pages: number; authors: { name: string; count: number }[]; categories: { name: string; count: number }[] };

const featured = [books[5], books[8], books[4]];
const jacketColors = ['#c9d9cb', '#c8dce2', '#ead6c2', '#d8cadf', '#e8c4b7', '#d4d9bd'];

export default function BooksPage() {
  const [query, setQuery] = useState('');
  const [activeAuthor, setActiveAuthor] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [catalogue, setCatalogue] = useState<CataloguePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const browsing = !!(query.trim() || activeAuthor || category || page > 1);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const timer = window.setTimeout(async () => {
      const timeout = window.setTimeout(() => controller.abort(), 45000);
      try {
        const params = new URLSearchParams({ q: query.trim(), author: activeAuthor, category, page: String(page) });
        const response = await fetch(`/api/books?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Catalogue unavailable');
        const result: CataloguePage = await response.json();
        if (active) setCatalogue(result);
      } catch { if (active) setError(true); }
      finally { window.clearTimeout(timeout); if (active) setLoading(false); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [query, activeAuthor, category, page, attempt]);

  const resetFilters = () => { setQuery(''); setActiveAuthor(''); setCategory(''); setPage(1); };
  const selectAuthor = (author: string) => { setActiveAuthor(author); setPage(1); document.getElementById('shelves')?.scrollIntoView(); };

  return (
    <div className="books-page pb-20">
      <section className="mx-auto grid max-w-[84rem] items-center gap-8 px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div>
          <h1 className="font-serif text-[2.8rem] font-medium italic leading-[1.03] tracking-tight sm:text-6xl">Đọc truyện Nhật hiểu tiếng Nhật</h1>
          <p className="mt-4 max-w-lg text-sm text-[var(--color-text-secondary)] sm:text-base">Những tác phẩm tiếng Nhật để đọc chậm, tra sâu và làm quen với ngôn ngữ trong ngữ cảnh.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#shelves" className="tactile inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-action-primary)] px-5 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Chọn truyện để đọc <ArrowRight aria-hidden="true" size={17} /></a>
            <Link href="/books/saved" className="tactile inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 font-semibold hover:bg-[var(--color-surface-subtle)]">Sách của tôi</Link>
          </div>
          <div className="mt-7 max-w-lg">
            <label htmlFor="book-search" className="sr-only">Tìm truyện hoặc tác giả</label>
            <div className="relative">
              <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={19} />
              <input id="book-search" value={query} maxLength={120} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm truyện, tên Nhật hoặc tác giả" className="h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-11 pr-11 text-base outline-none transition focus:border-[var(--color-primary-600)] focus:ring-2 focus:ring-[var(--color-primary-100)]" />
              {query && <button type="button" onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full hover:bg-[var(--color-surface-subtle)]" aria-label="Xóa từ khóa"><X size={17} /></button>}
            </div>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[40rem] items-end justify-center gap-3 sm:gap-5 lg:pt-4" aria-label="Một vài truyện trong thư viện">
          {featured.map((book, index) => <Link key={book.slug} href={`/books/${book.slug}`} className={`group w-[31%] max-w-[13rem] text-center ${index === 1 ? 'mb-8 sm:mb-12' : index === 2 ? 'mb-2' : ''}`}>
            <Jacket book={book} index={index} className="aspect-[2/3] rounded-[5px_10px_10px_5px]" />
            <p className="mt-3 line-clamp-1 text-xs font-semibold sm:text-sm">{book.title}</p>
            <p lang="ja" className="jp-text mt-0.5 text-[11px] text-[var(--color-text-muted)] sm:text-xs">{book.author}</p>
          </Link>)}
        </div>
      </section>

      <div id="shelves" className="mx-auto max-w-[84rem] scroll-mt-24 px-4 pb-16 sm:px-6">
        {!browsing && <nav aria-label="Chọn nhanh theo chủ đề" className="-mx-4 mb-9 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap">
          <a href="#catalogue" className="inline-flex h-9 shrink-0 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[13px] font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-surface-subtle)]">Toàn bộ tác phẩm</a>
          {bookCategories.map((category, index) => <a key={category} href={`#shelf-${index}`} className="inline-flex h-9 shrink-0 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[13px] font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]">{category}</a>)}
        </nav>}

        <section id="catalogue" className="mb-12 scroll-mt-24 sm:mb-16" aria-labelledby="catalogue-heading" aria-busy={loading}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div><h2 id="catalogue-heading" className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{browsing ? 'Kết quả tìm kiếm' : 'Khám phá thư viện'}</h2><p className="mt-2 text-sm text-[var(--color-text-muted)]" role="status">{loading ? 'Đang tải danh mục truyện…' : error ? 'Danh mục tạm thời chưa sẵn sàng' : `${catalogue?.total.toLocaleString('vi-VN') ?? 0} tác phẩm · Nguyên tác tiếng Nhật`}</p></div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-[var(--color-text-secondary)]" htmlFor="book-category">Thể loại</label>
              <select id="book-category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="min-h-11 max-w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base">
                <option value="">Tất cả</option>{catalogue?.categories.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count.toLocaleString('vi-VN')})</option>)}
              </select>
              {browsing && <button type="button" onClick={resetFilters} className="min-h-11 text-sm font-semibold text-[var(--color-primary-700)] hover:underline">Xóa bộ lọc</button>}
            </div>
          </div>
          {activeAuthor && <p className="mb-4 text-sm text-[var(--color-text-secondary)]">Tác giả: <span lang="ja" className="jp-text">{activeAuthor}</span></p>}
          {error ? <div role="alert" className="border-y border-[var(--color-border-subtle)] py-8"><p>Chưa tải được danh mục. Kiểm tra kết nối rồi thử lại.</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-4 min-h-11 rounded-full bg-[var(--color-action-primary)] px-5 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Thử lại</button></div>
            : loading ? <div aria-hidden="true" className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-[2/3] rounded-lg bg-[var(--color-surface-subtle)]" />)}</div>
              : catalogue?.books.length ? <>
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6" role="list">{catalogue.books.map((book, index) => <Link role="listitem" prefetch={false} key={book.slug} href={`/books/${book.slug}`} className="group min-w-0 text-center">
                  <Jacket book={book} index={index} className="aspect-[2/3]" />
                  <p className="mt-3 line-clamp-2 min-h-10 break-words text-sm font-semibold leading-snug">{book.title}</p><p lang="ja" className="jp-text mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">{book.author}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{book.orthography || book.category}</p>
                </Link>)}</div>
                <nav aria-label="Phân trang truyện" className="mt-8 flex items-center justify-center gap-4 text-sm">
                  <button type="button" disabled={catalogue.page <= 1} onClick={() => { setPage(catalogue.page - 1); document.getElementById('catalogue')?.scrollIntoView(); }} className="min-h-11 rounded-full border border-[var(--color-border)] px-4 font-semibold hover:bg-[var(--color-surface-subtle)] disabled:opacity-40">Trang trước</button>
                  <span className="tabular-nums">{catalogue.page} / {catalogue.pages}</span>
                  <button type="button" disabled={catalogue.page >= catalogue.pages} onClick={() => { setPage(catalogue.page + 1); document.getElementById('catalogue')?.scrollIntoView(); }} className="min-h-11 rounded-full border border-[var(--color-border)] px-4 font-semibold hover:bg-[var(--color-surface-subtle)] disabled:opacity-40">Trang sau</button>
                </nav>
              </> : <p className="border-y border-[var(--color-border-subtle)] py-12 text-center text-[var(--color-text-secondary)]">Chưa tìm thấy truyện phù hợp. Thử tên tiếng Nhật, cách đọc hoặc tác giả.</p>}
          {!loading && !error && !!catalogue?.authors.length && <div className="mt-8"><h3 className="text-sm font-semibold">Theo tác giả</h3><div className="mt-3 flex gap-2 overflow-x-auto pb-2">{catalogue.authors.map((author) => <button key={author.name} type="button" aria-pressed={activeAuthor === author.name} onClick={() => selectAuthor(author.name)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm hover:bg-[var(--color-surface-subtle)]"><span lang="ja" className="jp-text">{author.name}</span><span className="text-xs tabular-nums text-[var(--color-text-muted)]">{author.count}</span></button>)}</div></div>}
        </section>

        {!browsing && bookCategories.map((category, index) => {
          const entries = books.filter((book) => book.category === category);
          if (!entries.length) return null;
          return <section key={category} id={`shelf-${index}`} className="mb-12 scroll-mt-24 sm:mb-16">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div><h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-[2.35rem]">{category}</h2><p className="mt-1 text-xs text-[var(--color-text-muted)]">{entries.length} truyện</p></div>
              <a href="#shelves" className="mb-1 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-primary-700)] hover:underline sm:text-sm">Về đầu <ArrowRight aria-hidden="true" size={15} /></a>
            </div>
            <BookRail entries={entries} />
          </section>;
        })}

        <div className="mt-12 border-t border-[var(--color-border-subtle)] pt-4 text-xs text-[var(--color-text-muted)]"><p>Đọc nguyên tác tiếng Nhật. Dấu trang được lưu trên thiết bị này.</p><Link href="/legal" className="inline-flex min-h-11 items-center text-[var(--color-text-secondary)] hover:underline">Nguồn dữ liệu và giấy phép</Link></div>
      </div>
    </div>
  );
}

function BookRail({ entries }: { entries: typeof books }) {
  return <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-5 sm:mx-0 sm:gap-6 sm:px-0" role="list">
    {entries.map((book, index) => <Link role="listitem" key={book.slug} href={`/books/${book.slug}`} className="group w-[42vw] max-w-[11.5rem] shrink-0 snap-start text-center sm:w-[calc((100%-7.5rem)/6)] sm:max-w-none">
      <Jacket book={book} index={index} className="aspect-[2/3] rounded-[5px_10px_10px_5px]" />
      <p className="mt-3 line-clamp-2 min-h-10 text-[13px] font-semibold leading-snug sm:text-sm">{book.title}</p>
      <p lang="ja" className="jp-text mt-0.5 text-xs text-[var(--color-text-muted)]">{book.author}</p>
      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{book.minutes ? `${book.minutes < 60 ? `${book.minutes} phút` : `${Math.round(book.minutes / 60)} giờ`} · ước tính` : book.orthography}</p>
    </Link>)}
  </div>;
}

function Jacket({ book, index, className }: { book: (typeof books)[number]; index: number; className: string }) {
  const palette = jacketColors[index % jacketColors.length];
  return <div style={{ background: `linear-gradient(90deg, rgb(16 39 31 / 0.18), transparent 8%, transparent 94%, rgb(16 39 31 / 0.16)), ${palette}` }} className={`relative isolate flex flex-col items-center justify-between overflow-hidden rounded-[5px_10px_10px_5px] border border-[#26372f]/15 p-3 text-center shadow-[0_18px_26px_-16px_rgba(23,32,42,0.52)] transition duration-300 group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5 ${className}`}>
    <span className="relative z-10 mt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#26372f]/90">YomuJi</span>
    <span lang="ja" className="jp-text relative z-10 line-clamp-3 break-words font-serif text-lg font-bold leading-snug text-[#1d2923] sm:text-2xl">{book.japaneseTitle}</span>
    <span className="relative z-10 mb-2 line-clamp-2 font-serif text-[10px] italic leading-tight text-[#26372f] sm:text-xs">{book.title === book.japaneseTitle ? book.author : book.title}</span>
  </div>;
}
