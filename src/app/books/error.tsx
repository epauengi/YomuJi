'use client';

import Link from 'next/link';

export default function BooksError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-3xl px-5 py-16">
    <h1 className="font-serif text-3xl font-semibold">Thư viện tạm thời chưa sẵn sàng</h1>
    <p role="alert" className="mt-4 text-[var(--color-text-secondary)]">Chưa tải được thông tin truyện. Vui lòng thử lại.</p>
    <div className="mt-6 flex flex-wrap gap-4"><button type="button" onClick={reset} className="min-h-11 rounded-full bg-[var(--color-action-primary)] px-5 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Thử lại</button><Link href="/books" className="inline-flex min-h-11 items-center font-semibold text-[var(--color-primary-700)] hover:underline">Quay lại thư viện</Link></div>
  </div>;
}
