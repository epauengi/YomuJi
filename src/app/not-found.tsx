import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: { absolute: 'Không tìm thấy trang | YomuJi' } };

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:py-24">
      <h1 className="text-balance text-3xl font-bold">Không tìm thấy trang</h1>
      <p className="mt-3 text-[var(--color-text-secondary)]">Kiểm tra lại địa chỉ hoặc chọn nơi bạn muốn đến.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-action-primary)] px-4 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Tra từ điển</Link>
        <Link href="/books" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-border)] px-4 font-semibold hover:bg-[var(--color-surface-subtle)]">Mở thư viện</Link>
      </div>
    </section>
  );
}
