import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { searchReturnHref, type SearchOrigin } from '@/lib/dictionary/searchReturn';

export function DictionaryReturnLink({ origin, className = '' }: { origin?: SearchOrigin; className?: string }) {
  return (
    <Link
      href={origin ? searchReturnHref(origin) : '/'}
      replace={Boolean(origin)}
      scroll={!origin}
      className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-sm text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary-700)] ${className}`}
    >
      <ArrowLeft aria-hidden="true" size={16} />
      {origin ? 'Về kết quả tra cứu' : 'Quay lại trang chủ'}
    </Link>
  );
}
