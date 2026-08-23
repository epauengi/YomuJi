'use client';

import Link from 'next/link';
import { ArrowLeft, HourglassMedium } from '@phosphor-icons/react';

export default function JLPTPage() {
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[--radius-lg] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
        <HourglassMedium size={40} weight="duotone" />
      </div>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
        Tính năng này sẽ sớm ra mắt
      </h1>

      <p className="mt-3 max-w-md text-base leading-relaxed text-[var(--color-text-secondary)]">
        Hệ thống tra cứu và luyện tập theo cấp độ JLPT đang được phát triển. Vui lòng quay lại sau!
      </p>

      <div className="mt-8 flex items-center justify-center">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center gap-2 rounded-[--radius-md] bg-[var(--color-primary-700)] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-800)] focus-visible:outline-offset-2"
        >
          <ArrowLeft size={18} weight="bold" />
          Quay lại trang chủ
        </Link>
      </div>
    </div>
  );
}
