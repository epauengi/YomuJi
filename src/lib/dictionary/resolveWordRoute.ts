import 'server-only';
import index from './word-route-index.json';
import { getDictionaryRepository, isDictionaryBackendConfigured } from '@/lib/dictionary';
import { wordSlug } from '@/lib/wordRoutes';
import type { TermLookupResponse } from '@/types/dictionary';

const routes: Record<string, string[]> = index;

async function attachHomophones(
  repository: ReturnType<typeof getDictionaryRepository>,
  term: TermLookupResponse['term'],
): Promise<TermLookupResponse> {
  if (!term || !term.reading) return { term };
  try {
    const homophones = await repository.findHomophonesByReading(term.reading, term.id, 12);
    return homophones.length > 0 ? { term, homophones } : { term };
  } catch {
    return { term };
  }
}

export async function resolveWordRoute(slug: string, sequence?: string): Promise<TermLookupResponse> {
  if (!isDictionaryBackendConfigured()) throw new Error('Dictionary backend unavailable');
  const repository = getDictionaryRepository();
  const ids = Object.hasOwn(routes, slug) ? routes[slug] : undefined;
  if (ids) {
    const selected = sequence ? ids.filter((id) => id.endsWith(`-${sequence}`)) : ids;
    const records = await Promise.all(selected.map((id) => repository.getTermByIdOrSlug(id)));
    const terms = records.filter((term) => term !== null);
    if (terms.length > 1) return { term: null, alternatives: terms };
    return attachHomophones(repository, terms[0] ?? null);
  }

  const term = await repository.getTermByIdOrSlug(slug);
  if (sequence && (!term || String(term.sequence) !== sequence || wordSlug(term) !== slug)) {
    return { term: null };
  }
  return attachHomophones(repository, term);
}
