import { HomePage } from '@/components/HomePage';

type SearchParams = Promise<{ q?: string | string[]; focus?: string | string[] }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim();
  return query ? { title: `Tra cứu “${query.slice(0, 80)}” | YomuJi` } : {};
}

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, focus } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.trim() || '';

  return <HomePage initialQuery={initialQuery} returnFocus={typeof focus === 'string' ? focus : undefined} />;
}
