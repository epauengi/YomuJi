const PARTICLE = /^(?:は|が|を|に|へ|で|と|も|の|や|か|から|まで|より)$/u;
const STARTS_WORD = /^[\p{sc=Han}\p{sc=Katakana}ー々]/u;

export const canChunkJapanese = () => typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';

/** Intl.Segmenter splits conjugations finely (食|べら|れ|なか|っ|た), so glue kana tails back onto their stem. */
export function chunkJapanese(text: string) {
  const chunks: { text: string; word: boolean }[] = [];
  for (const { segment, isWordLike } of new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)) {
    const last = chunks.at(-1);
    const japanese = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u.test(segment);
    const glue = last?.word && isWordLike && japanese && !STARTS_WORD.test(segment)
      && !PARTICLE.test(last.text) && !(PARTICLE.test(segment) && STARTS_WORD.test(last.text.at(-1) ?? ''));
    if (glue) last.text += segment;
    else chunks.push({ text: segment, word: Boolean(isWordLike && japanese) });
  }
  return chunks;
}
