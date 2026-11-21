export type PitchLevel = 'H' | 'L';

export type PitchKind = 'heiban' | 'atamadaka' | 'nakadaka' | 'odaka';

export interface PitchClassification {
  kind: PitchKind;
  labelJa: string;
  labelVi: string;
}

// Small combining kana (yōon / small vowels) attach to the preceding kana as a single mora.
// Small っ/ッ (sokuon) and ー (chōonpu) are NOT in this set because each is its own mora.
const COMBINING_KANA = new Set([
  'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ',
  'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ヮ', 'ヵ', 'ヶ',
]);

/**
 * Split a Japanese kana reading into morae.
 * Example: きょう -> ['きょ', 'う'], がっこう -> ['が', 'っ', 'こ', 'う'], コーヒー -> ['コ', 'ー', 'ヒ', 'ー']
 */
export function splitMorae(reading: string): string[] {
  const cleaned = reading.replace(/[\s・･\-‐]/g, '').trim();
  if (!cleaned) return [];

  const morae: string[] = [];
  for (const ch of cleaned) {
    if (COMBINING_KANA.has(ch) && morae.length > 0) {
      morae[morae.length - 1] += ch;
    } else {
      morae.push(ch);
    }
  }
  return morae;
}

/**
 * Compute standard Tokyo pitch accent H/L contour for `moraCount` morae + 1 trailing particle position.
 * Returns length `moraCount + 1` (last element is the following particle e.g. が,
 * which distinguishes Heiban [0] from Odaka [N]).
 */
export function getPitchPattern(moraCount: number, downstep: number): PitchLevel[] {
  if (moraCount <= 0) return [];
  const n = Math.max(0, Math.min(Math.trunc(downstep), moraCount));
  const pattern: PitchLevel[] = [];

  if (n === 0) {
    // Heiban: L H H ... H (particle H)
    pattern.push('L');
    for (let i = 1; i <= moraCount; i++) pattern.push('H');
    return pattern;
  }

  if (n === 1) {
    // Atamadaka: H L L ... L (particle L)
    pattern.push('H');
    for (let i = 1; i <= moraCount; i++) pattern.push('L');
    return pattern;
  }

  // Nakadaka (1 < n < moraCount) or Odaka (n === moraCount):
  // L H ... H (up to mora n) L ... L (particle L)
  for (let i = 1; i <= moraCount + 1; i++) {
    if (i === 1) pattern.push('L');
    else if (i <= n) pattern.push('H');
    else pattern.push('L');
  }
  return pattern;
}

/**
 * Classify a pitch downstep number for a word of `moraCount` morae.
 */
export function classifyPitchAccent(moraCount: number, downstep: number): PitchClassification {
  const n = Math.max(0, Math.trunc(downstep));
  if (n === 0) {
    return { kind: 'heiban', labelJa: '平板', labelVi: 'Bằng' };
  }
  if (n === 1) {
    return { kind: 'atamadaka', labelJa: '頭高', labelVi: 'Cao đầu' };
  }
  if (n >= moraCount && moraCount > 1) {
    return { kind: 'odaka', labelJa: '尾高', labelVi: 'Cao cuối' };
  }
  return { kind: 'nakadaka', labelJa: '中高', labelVi: 'Cao giữa' };
}

/**
 * Sanitize unknown/raw pitch accent values into deduplicated non-negative integers.
 */
export function normalizePitchAccents(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    const num = typeof item === 'number' ? item : Number(item);
    if (Number.isInteger(num) && num >= 0 && num <= 30 && !out.includes(num)) {
      out.push(num);
    }
  }
  return out;
}
