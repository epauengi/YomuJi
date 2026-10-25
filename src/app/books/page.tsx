'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react';
import { bookCategories, books, type Book } from '@/data/books';
import BookCoverImage from '@/components/books/BookCoverImage';

type CataloguePage = { books: Book[]; covers?: Record<string, string>; total: number; page: number; pages: number; authors: { name: string; count: number }[]; categories: { name: string; count: number }[] };

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
  const covers = catalogue?.covers;

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
  const selectAuthor = (author: string) => { setActiveAuthor(author); setPage(1); document.getElementById('catalogue')?.scrollIntoView(); };

  return (
    <div className="books-page pb-20">
      <section className="mx-auto grid max-w-[84rem] items-center gap-8 px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div>
          <h1 className="font-serif text-[2.8rem] font-medium italic leading-[1.03] tracking-tight sm:text-4xl lg:text-5xl">Đọc truyện Nhật hiểu tiếng Nhật</h1>
          <p className="mt-4 max-w-lg text-sm text-[var(--color-text-secondary)] sm:text-base">Những tác phẩm tiếng Nhật để đọc chậm, tra sâu và làm quen với ngôn ngữ trong ngữ cảnh.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#shelves" className="tactile inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-action-primary)] px-5 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Chọn truyện để đọc <ArrowRight aria-hidden="true" size={17} /></a>
            <Link href="/books/saved" className="tactile inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 font-semibold hover:bg-[var(--color-surface-subtle)]">Sách của tôi</Link>
          </div>
          <div className="mt-7 max-w-lg">
            <label htmlFor="book-search" className="sr-only">Tìm truyện hoặc tác giả</label>
            <div className="relative">
              <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={19} />
              <input id="book-search" value={query} maxLength={120} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm truyện, tên Nhật hoặc tác giả" className="h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-11 pr-11 text-base placeholder:text-[var(--color-text-secondary)] placeholder:opacity-100 outline-none transition focus:border-[var(--color-primary-600)] focus:ring-2 focus:ring-[var(--color-primary-100)]" />
              {query && <button type="button" onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full hover:bg-[var(--color-surface-subtle)]" aria-label="Xóa từ khóa"><X size={17} /></button>}
            </div>
          </div>
        </div>
        <div role="group" aria-label="Một vài truyện trong thư viện" className="mx-auto flex w-full max-w-[40rem] items-end justify-center gap-3 sm:gap-5 lg:pt-4">
          {featured.map((book, index) => <Link key={book.slug} href={`/books/${book.slug}`} className={`group w-[31%] max-w-[13rem] text-center ${index === 1 ? 'mb-8 sm:mb-12' : index === 2 ? 'mb-2' : ''}`}>
            <Jacket book={book} index={index} coverUrl={covers?.[book.slug]} className="aspect-[2/3] rounded-[5px_10px_10px_5px]" />
            <p className="mt-3 line-clamp-2 min-h-10 break-words text-sm font-semibold leading-5">{book.title}</p>
            <p lang="ja" className="jp-text mt-1 text-[13px] leading-5 text-[var(--color-text-secondary)]">{book.author}</p>
          </Link>)}
        </div>
      </section>

      <div id="shelves" className="mx-auto max-w-[84rem] scroll-mt-24 px-4 pb-16 sm:px-6">
        {!browsing && <nav aria-label="Chủ đề tuyển chọn" className="mb-8 flex flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] pb-6 sm:mb-12 sm:pb-8">
          <span className="mr-1 text-sm font-semibold text-[var(--color-text-secondary)]">Tuyển chọn</span>
          {bookCategories.map((category, index) => books.some((book) => book.category === category) && <a key={category} href={`#shelf-${index}`} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[13px] font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]">{category}</a>)}
        </nav>}



        {!browsing && <section aria-labelledby="curated-heading" className="mb-14 scroll-mt-24 sm:mb-20">
          <div className="mb-7 max-w-xl sm:mb-9">
            <h2 id="curated-heading" className="font-sans text-3xl font-semibold tracking-tight sm:text-4xl">Bắt đầu từ một câu chuyện</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">Truyện được tuyển chọn theo chủ đề để bạn dễ tìm cuốn muốn đọc tiếp.</p>
          </div>
          {bookCategories.map((category, index) => {
            const entries = books.filter((book) => book.category === category);
            if (!entries.length) return null;
            return <section key={category} id={`shelf-${index}`} aria-labelledby={`shelf-heading-${index}`} className="mb-9 scroll-mt-24 last:mb-0 sm:mb-12">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div><h3 id={`shelf-heading-${index}`} className="font-sans text-2xl font-semibold tracking-tight sm:text-3xl">{category}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">{entries.length} truyện</p></div>
                <a href="#shelves" className="mb-1 inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-primary-700)] hover:underline sm:text-sm">Về chủ đề <ArrowRight aria-hidden="true" size={15} /></a>
              </div>
              <BookRail entries={entries} covers={covers} />
            </section>;
          })}
        </section>}

        <section id="catalogue" className="scroll-mt-24 border-t border-[var(--color-border-subtle)] pt-8 sm:pt-10" aria-labelledby="catalogue-heading" aria-busy={loading}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div><h2 id="catalogue-heading" className="font-sans text-3xl font-semibold tracking-tight sm:text-4xl">{browsing ? 'Kết quả tìm kiếm' : 'Kho lưu trữ Aozora'}</h2><p className="mt-2 text-sm text-[var(--color-text-muted)]" role="status">{loading ? 'Đang tải danh mục truyện…' : error ? 'Danh mục tạm thời chưa sẵn sàng' : `${catalogue?.total.toLocaleString('vi-VN') ?? 0} tác phẩm · Nguyên tác tiếng Nhật`}</p></div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-[var(--color-text-secondary)]" htmlFor="book-category">Phân loại lưu trữ</label>
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
                <ul className="grid list-none grid-cols-2 gap-x-5 gap-y-8 p-0 sm:grid-cols-4 lg:grid-cols-6">{catalogue.books.map((book, index) => <li key={book.slug} className="min-w-0"><Link prefetch={false} href={`/books/${book.slug}`} className="group block text-center">
                  <Jacket book={book} index={index} coverUrl={catalogue.covers?.[book.slug]} className="aspect-[2/3]" />
                  <p className="mt-3 line-clamp-3 min-h-14 break-words text-sm font-semibold leading-5 sm:line-clamp-2 sm:min-h-10 sm:text-base sm:leading-snug">{book.title}</p><p lang="ja" className="jp-text mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">{book.author}</p><p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{book.orthography || book.category}</p>
                </Link></li>)}</ul>
                <nav aria-label="Phân trang truyện" className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <button type="button" aria-label="Trang trước" disabled={catalogue.page <= 1} onClick={() => { setPage(catalogue.page - 1); document.getElementById('catalogue')?.scrollIntoView(); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--color-border)] px-3 font-semibold hover:bg-[var(--color-surface-subtle)] disabled:opacity-40"><ArrowRight aria-hidden="true" className="rotate-180 sm:hidden" size={18} /><span className="sr-only sm:not-sr-only">Trang trước</span></button>
                  {Array.from(new Set([1, catalogue.page - 1, catalogue.page, catalogue.page + 1, catalogue.pages].filter((value) => value >= 1 && value <= catalogue.pages))).map((value, index, pages) => <span key={value} className="contents">
                    {index > 0 && pages[index - 1] < value - 1 && <span aria-hidden="true" className="px-1 text-[var(--color-text-muted)]">…</span>}
                    <button type="button" aria-label={`Trang ${value}`} aria-current={value === catalogue.page ? 'page' : undefined} onClick={() => { setPage(value); document.getElementById('catalogue')?.scrollIntoView(); }} className={`min-h-11 min-w-11 rounded-full border px-3 font-semibold tabular-nums transition ${value === catalogue.page ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-white' : 'border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)]'}`}>{value}</button>
                  </span>)}
                  <span className="sr-only">Trang {catalogue.page} / {catalogue.pages}</span>
                  <button type="button" aria-label="Trang sau" disabled={catalogue.page >= catalogue.pages} onClick={() => { setPage(catalogue.page + 1); document.getElementById('catalogue')?.scrollIntoView(); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--color-border)] px-3 font-semibold hover:bg-[var(--color-surface-subtle)] disabled:opacity-40"><span className="sr-only sm:not-sr-only">Trang sau</span><ArrowRight aria-hidden="true" className="sm:hidden" size={18} /></button>
                </nav>
              </> : <p className="border-y border-[var(--color-border-subtle)] py-12 text-center text-[var(--color-text-secondary)]">Chưa tìm thấy truyện phù hợp. Thử tên tiếng Nhật, cách đọc hoặc tác giả.</p>}
          {!loading && !error && !!catalogue?.authors.length && <div className="mt-8"><h3 className="text-sm font-semibold">Theo tác giả</h3><div className="mt-3 flex gap-2 overflow-x-auto pb-2">{catalogue.authors.map((author) => <button key={author.name} type="button" aria-pressed={activeAuthor === author.name} onClick={() => selectAuthor(author.name)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm hover:bg-[var(--color-surface-subtle)]"><span lang="ja" className="jp-text">{author.name}</span><span className="text-xs tabular-nums text-[var(--color-text-muted)]">{author.count}</span></button>)}</div></div>}
        </section>

        <div className="mt-12 border-t border-[var(--color-border-subtle)] pt-4 text-xs text-[var(--color-text-muted)]"><p>Đọc nguyên tác tiếng Nhật. Dấu trang được lưu trên thiết bị này.</p><Link href="/legal" className="inline-flex min-h-11 items-center text-[var(--color-text-secondary)] hover:underline">Nguồn dữ liệu và giấy phép</Link></div>
      </div>
    </div>
  );
}

function BookRail({ entries, covers }: { entries: typeof books; covers?: Record<string, string> }) {
  return <ul className="-mx-4 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-5 sm:mx-0 sm:gap-6 sm:px-0">
    {entries.map((book, index) => <li key={book.slug} className="w-[42vw] max-w-[11.5rem] shrink-0 snap-start sm:w-[calc((100%-7.5rem)/6)] sm:max-w-none"><Link href={`/books/${book.slug}`} className="group block text-center">
      <Jacket book={book} index={index} coverUrl={covers?.[book.slug]} className="aspect-[2/3] rounded-[5px_10px_10px_5px]" />
      <p className="mt-3 line-clamp-2 min-h-11 break-words text-sm font-semibold leading-snug sm:text-base">{book.title}</p>
      <p lang="ja" className="jp-text mt-1 text-[13px] leading-5 text-[var(--color-text-secondary)]">{book.author}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{book.minutes ? `${book.minutes < 60 ? `${book.minutes} phút` : `${Math.round(book.minutes / 60)} giờ`} · ước tính` : book.orthography}</p>
    </Link></li>)}
  </ul>;
}

function Jacket({ book, index, coverUrl, className }: { book: (typeof books)[number]; index: number; coverUrl?: string; className: string }) {
  const palette = jacketColors[index % jacketColors.length];
  return <div style={{ background: `linear-gradient(90deg, rgb(16 39 31 / 0.18), transparent 8%, transparent 94%, rgb(16 39 31 / 0.16)), ${palette}` }} className={`relative isolate flex flex-col items-center justify-between overflow-hidden rounded-[5px_10px_10px_5px] border border-[#26372f]/15 p-3 text-center shadow-[0_18px_26px_-16px_rgba(23,32,42,0.52)] transition duration-300 group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5 ${className}`}>
    <BookCoverImage src={coverUrl} alt={`Bìa ${book.title}`} className="absolute inset-0 size-full object-cover">
      <span lang="ja" className="jp-text relative z-10 line-clamp-3 break-words font-serif text-lg font-semibold leading-snug tracking-[0.01em] text-[#1d2923] sm:text-2xl">{book.japaneseTitle}</span>
    </BookCoverImage>
  </div>;
}
