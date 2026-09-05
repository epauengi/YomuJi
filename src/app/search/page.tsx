import { redirect } from 'next/navigation';
import { searchHref } from '@/lib/navigation';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q) || '';
  redirect(searchHref(query));
}

