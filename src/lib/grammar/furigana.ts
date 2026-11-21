export interface RubySegment {
  text: string;
  reading?: string;
}

const RUBY_RE = /\{([^|{}]+)\|([^{}]+)\}/g;

/**
 * Parse `{漢字|かんじ}` furigana markup into renderable segments.
 */
export function parseFurigana(input: string): RubySegment[] {
  if (!input) return [];
  const segments: RubySegment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(RUBY_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ text: input.slice(lastIndex, idx) });
    }
    segments.push({ text: match[1], reading: match[2] });
    lastIndex = idx + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex) });
  }
  return segments;
}
