import { HomePage } from '@/components/HomePage';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; focus?: string | string[] }>;
}) {
  const { q, focus } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.trim() || '';

  return <HomePage initialQuery={initialQuery} returnFocus={typeof focus === 'string' ? focus : undefined} />;
}
