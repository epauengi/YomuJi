import collisionSlugs from './word-route-collisions.json';

const collisions = new Set(collisionSlugs);

type WordRouteTerm = {
  surface: string;
  reading: string;
  id?: string;
  sequence?: number;
};

/** Keep Han surfaces exact; normalize kana-only routes to hiragana. */
export function wordSlug({ surface, reading }: Pick<WordRouteTerm, 'surface' | 'reading'>): string {
  if (/\p{Script=Han}/u.test(surface)) return surface;
  return (reading || surface).normalize('NFKC').replace(/[\u30a1-\u30fa\u30fd\u30fe]/g, (kana) => {
    const code = kana.charCodeAt(0);
    // ヷ–ヺ have no precomposed hiragana equivalents.
    return code >= 0x30f7 && code <= 0x30fa
      ? 'わゐゑを'[code - 0x30f7] + '\u3099'
      : String.fromCharCode(code - 0x60);
  }).normalize('NFC');
}

/** Extract the sequence without reconstructing or modifying the original ID. */
export function wordSequence(id: string): number | null {
  const suffix = /-(\d+)$/.exec(id);
  const sequence = suffix ? Number(suffix[1]) : NaN;
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

export function wordHref(term: WordRouteTerm | string): string {
  if (typeof term === 'string') return `/word/${encodeURIComponent(term)}`;
  const slug = wordSlug(term);
  const href = `/word/${encodeURIComponent(slug)}`;
  if (!collisions.has(slug)) return href;
  const sequence = term.sequence ?? wordSequence(term.id ?? '');
  if (sequence === null || !Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error(`Missing valid sequence for colliding word slug: ${slug}`);
  }
  return `${href}?id=${sequence}`;
}
