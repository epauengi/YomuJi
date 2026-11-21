import Link from 'next/link';
import { ArrowRight, Cards, GraduationCap, Hash, PencilSimpleLine, SquaresFour, TextAlignLeft } from '@phosphor-icons/react/dist/ssr';

export const metadata = { title: 'Luyện tập' };

export default function PracticePage() {
  return <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Luyện tập</h1>
    <p className="mt-3 text-[var(--color-text-secondary)]">Công cụ tra cứu chuyên sâu, ôn tập bộ thẻ và luyện thi theo cấp độ JLPT.</p>

    <section aria-labelledby="practice-lookup-heading" className="mt-10">
      <h2 id="practice-lookup-heading" className="text-base font-semibold text-[var(--color-text-primary)]">Tra cứu nâng cao</h2>
      <div className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        <Link href="/analyze" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><TextAlignLeft size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold group-hover:underline">Dán đoạn để tra</h3><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Dán văn bản tiếng Nhật ngắn, chạm vào từ để xem nghĩa và dạng gốc.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
        <Link href="/kanji-components" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><SquaresFour size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold group-hover:underline">Tra Kanji theo bộ</h3><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Chọn nhiều thành phần và lọc theo số nét để tìm chữ Hán.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
        <Link href="/counters" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><Hash size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold group-hover:underline">Đếm tiếng Nhật</h3><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Tìm cách đếm đúng người, con vật và đồ vật trong tiếng Nhật.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
      </div>
    </section>

    <section aria-labelledby="practice-memory-heading" className="mt-10">
      <h2 id="practice-memory-heading" className="text-base font-semibold text-[var(--color-text-primary)]">Luyện tập &amp; Ghi nhớ</h2>
      <div className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        <Link href="/jlpt" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><GraduationCap size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold group-hover:underline">Luyện JLPT</h3><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Chọn cấp độ, luyện từng phần hoặc làm đề thi thử.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
        <Link href="/flashcards" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><Cards size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold group-hover:underline">Flashcards</h3><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Ôn bộ thẻ, tạo thẻ riêng hoặc nhập từ Anki.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
        <Link href="/handwriting" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><PencilSimpleLine size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold group-hover:underline">Giấy luyện viết</h3><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Chọn Kanji, Kana và kiểu giấy; tải PDF để luyện viết tay.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
      </div>
    </section>
  </div>;
}
