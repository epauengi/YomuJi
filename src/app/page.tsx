import { HomePage } from '@/components/HomePage';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.trim() || '';

  return <HomePage initialQuery={initialQuery} />;
}
