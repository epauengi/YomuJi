import 'server-only';
import index from './word-route-index.json';
import { getDictionaryRepository, isDictionaryBackendConfigured } from '@/lib/dictionary';
import { wordSlug } from '@/lib/wordRoutes';
import type { TermLookupResponse } from '@/types/dictionary';

const routes: Record<string, string[]> = index;

export async function resolveWordRoute(slug: string, sequence?: string): Promise<TermLookupResponse> {
  if (!isDictionaryBackendConfigured()) throw new Error('Dictionary backend unavailable');
  const repository = getDictionaryRepository();
  const ids = Object.hasOwn(routes, slug) ? routes[slug] : undefined;
  if (ids) {
    const selected = sequence ? ids.filter((id) => id.endsWith(`-${sequence}`)) : ids;
    const records = await Promise.all(selected.map((id) => repository.getTermByIdOrSlug(id)));
    const terms = records.filter((term) => term !== null);
    return terms.length > 1 ? { term: null, alternatives: terms } : { term: terms[0] ?? null };
  }

  const term = await repository.getTermByIdOrSlug(slug);
  if (sequence && (!term || String(term.sequence) !== sequence || wordSlug(term) !== slug)) {
    return { term: null };
  }
  return { term };
}
