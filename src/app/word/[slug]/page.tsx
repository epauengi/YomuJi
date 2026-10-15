import { permanentRedirect } from 'next/navigation';
import { resolveWordRoute } from '@/lib/dictionary/resolveWordRoute';
import { wordHref } from '@/lib/wordRoutes';
import type { TermLookupResponse } from '@/types/dictionary';
import WordDetailPage from './WordDetailPage';

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const [{ slug: rawSlug }, { id }] = await Promise.all([params, searchParams]);
  let slug: string;
  try { slug = decodeURIComponent(rawSlug); } catch { slug = ''; }
  const sequence = typeof id === 'string' ? id : undefined;
  const valid = slug.length <= 512 && (id === undefined || (typeof id === 'string' && /^[1-9]\d{0,14}$/.test(id)));
  let initial: TermLookupResponse | undefined;
  if (valid) {
    try {
      initial = await resolveWordRoute(slug, sequence);
    } catch {
      // API unavailable: let the client retry using its offline cache.
    }
  } else {
    initial = { term: null };
  }

  if (initial?.term) {
    const canonical = wordHref(initial.term);
    const current = `/word/${encodeURIComponent(slug)}${sequence ? `?id=${sequence}` : ''}`;
    if (current !== canonical) permanentRedirect(canonical);
  }

  return <WordDetailPage slug={slug} sequence={sequence} initial={initial} />;
}
