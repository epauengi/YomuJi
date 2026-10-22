import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock, Headphones, BookOpenText } from '@phosphor-icons/react/dist/ssr';
import { getBook, books } from '@/data/books';

export function generateStaticParams() {
  return books.map(({ slug }) => ({ slug }));
}

export default async function BookDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = getBook(slug);
  if (!book) notFound();
  const related = books.filter((item) => item.category === book.category && item.slug !== book.slug).slice(0, 3);

  return <article className="books-page mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
    <Link href="/books" className="inline-flex min-h-10 items-center gap-2 rounded-full pr-3 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary-700)]"><ArrowLeft aria-hidden="true" size={18} /> Thư viện</Link>
    <div className="mt-7 grid items-center gap-8 md:grid-cols-[minmax(220px,0.7fr)_1.3fr] md:gap-16">
      <div className="mx-auto w-[min(62vw,18rem)] md:w-full"><div className="relative isolate flex aspect-[2/3] flex-col items-center justify-between overflow-hidden rounded-[5px_10px_10px_5px] border border-[#26372f]/15 p-5 text-center shadow-[0_18px_26px_-16px_rgba(23,32,42,0.52)]" style={{ background: 'linear-gradient(90deg, rgb(16 39 31 / 0.18), transparent 8%, transparent 94%, rgb(16 39 31 / 0.16)), #d9e4d8' }}>
        <span className="relative z-10 mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#26372f]">YomuJi · truyện mẫu</span><span lang="ja" className="jp-text relative z-10 font-serif text-4xl font-bold text-[#1d2923]">{book.japaneseTitle}</span><span className="relative z-10 mb-4 font-serif text-lg italic text-[#26372f]">{book.title}</span>
      </div></div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary-700)]">{book.category} · Bản xem thử</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{book.title}</h1>
        <p lang="ja" className="jp-text mt-2 text-xl text-[var(--color-text-secondary)]">{book.japaneseTitle}</p>
        <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]"><span lang="ja" className="jp-text">{book.author}</span> · {book.romanizedAuthor}</p>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-text-secondary)]">{book.intro}</p>
        <div className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><Clock aria-hidden="true" size={17} /> Khoảng {book.minutes < 60 ? `${book.minutes} phút` : `${Math.round(book.minutes / 60)} giờ`} đọc · ước tính</div>
        <p className="mt-5 max-w-xl rounded-lg bg-[var(--color-surface-subtle)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">Bản thử nghiệm YomuJi. Đoạn đọc minh họa; chưa phải toàn văn hay dữ liệu đồng bộ.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/books/${book.slug}/read`} className="tactile inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-action-primary)] px-6 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]"><BookOpenText aria-hidden="true" size={19} /> Bắt đầu đọc</Link>
          <button type="button" disabled aria-describedby="audio-unavailable" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-70"><Headphones aria-hidden="true" size={18} /> Nghe</button>
          <span id="audio-unavailable" className="sr-only">Chưa có bản thu âm cho truyện mẫu này.</span>
        </div>
      </div>
    </div>
    <section className="mx-auto mt-14 max-w-3xl border-t border-[var(--color-border)] pt-8">
      <h2 className="font-serif text-2xl font-semibold">Thử đọc một đoạn</h2><p lang="ja" className="jp-text mt-5 text-xl leading-[2] text-[var(--color-text-primary)]">{book.excerpt}</p><p className="mt-3 text-xs text-[var(--color-text-muted)]">Đoạn minh họa ngắn, không đại diện cho toàn văn tác phẩm.</p>
    </section>
    {related.length > 0 && <section className="mt-16"><div className="mb-5 flex items-end justify-between"><h2 className="font-serif text-2xl font-semibold">Cùng chủ đề</h2><Link href="/books" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary-700)]">Thư viện <ArrowRight size={16} /></Link></div><div className="grid gap-3 sm:grid-cols-3">{related.map((item) => <Link key={item.slug} href={`/books/${item.slug}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:bg-[var(--color-surface-subtle)]"><p className="font-semibold">{item.title}</p><p lang="ja" className="jp-text mt-1 text-sm text-[var(--color-text-muted)]">{item.author}</p></Link>)}</div></section>}
  </article>;
}
