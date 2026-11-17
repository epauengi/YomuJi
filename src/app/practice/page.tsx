import Link from 'next/link';
import { ArrowRight, Cards, GraduationCap, Hash } from '@phosphor-icons/react/dist/ssr';

export const metadata = { title: 'Luyện tập' };

export default function PracticePage() {
  return <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Luyện tập</h1>
    <p className="mt-3 text-[var(--color-text-secondary)]">Ôn từ bằng bộ thẻ hoặc luyện đề theo cấp độ JLPT.</p>
    <div className="mt-8 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
      <Link href="/counters" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><Hash size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold group-hover:underline">Đếm sao cho đúng?</h2><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Tìm cách đếm đúng người, con vật và đồ vật trong tiếng Nhật.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
      <Link href="/flashcards" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><Cards size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold group-hover:underline">Flashcards</h2><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Ôn bộ thẻ, tạo thẻ riêng hoặc nhập từ Anki.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
      <Link href="/jlpt" className="group flex min-h-28 items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"><GraduationCap size={28} aria-hidden="true" className="shrink-0 text-[var(--color-primary-700)]" /><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold group-hover:underline">Luyện JLPT</h2><p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">Chọn cấp độ, luyện từng phần hoặc làm đề thi thử.</p></div><ArrowRight size={21} aria-hidden="true" className="shrink-0" /></Link>
    </div>
  </div>;
}
