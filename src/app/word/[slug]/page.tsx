import type { Metadata } from 'next';
import { permanentRedirect, redirect } from 'next/navigation';
import { resolveWordRoute } from '@/lib/dictionary/resolveWordRoute';
import { wordHref } from '@/lib/wordRoutes';
import { readSearchOrigin, withSearchOrigin } from '@/lib/dictionary/searchReturn';
import type { TermLookupResponse } from '@/types/dictionary';
import WordDetailPage from './WordDetailPage';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    return { title: `Tra từ ${decodeURIComponent(slug)}` };
  } catch {
    return { title: 'Chi tiết từ vựng' };
  }
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string | string[]; from?: string | string[]; result?: string | string[] }>;
}) {
  const [{ slug: rawSlug }, { id, from, result }] = await Promise.all([params, searchParams]);
  const origin = readSearchOrigin(from, result);
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
    if (current !== canonical) {
      if (origin) redirect(withSearchOrigin(canonical, origin));
      permanentRedirect(canonical);
    }
  }

  return <WordDetailPage slug={slug} sequence={sequence} initial={initial} origin={origin} />;
}
