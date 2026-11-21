import type { Phrase } from '@/lib/sentenceParse';
import type { GrammarPoint, SentenceGrammarMatch } from '@/types/grammar';

interface TokenSpan {
  start: number;
  end: number;
  surface: string;
  base: string;
  pos: string;
  phraseIndex: number;
}

interface CompiledRule {
  grammar: GrammarPoint;
  parts: RegExp[];
  baseLength: number;
  isDiscontinuous: boolean;
  isSingleChar: boolean;
  requiresVerbBefore: boolean;
}

const SKIP_AMBIGUOUS_SINGLE_IDS = new Set([
  // Very noisy 1-char copula/tense suffixes or multi-sense single-char particles
  'wa',
  'ga-subject',
  'o',
  'no',
  'da',
  'ta',
  'desu',
  'masu',
  'ni-time',
  'ni-destination',
  'ni-location',
  'ni-indirect-object',
  'ni-frequency',
  'de-place',
  'de-means',
  'to-and',
  'to-with',
  'ka-or',
  'ka-question',
]);

const REGEX_META = /[.*+?^${}()|[\]\\]/g;
const escapeRegex = (s: string) => s.replace(REGEX_META, '\\$&');

/**
 * Build inflection-tolerant regex source for a single continuous grammar cue.
 */
function cueToRegexSource(cue: string): string {
  const esc = escapeRegex(cue);

  // Te-form voiced variants: 〜てもいい / 〜てはいけない / 〜ている / 〜てしまう / 〜てください / 〜てみる / 〜ておく / 〜てある / 〜てくる / 〜ていく
  if (cue === 'ている') return '[てで](?:い(?:る|ます|た|ました|ない|ません|なかった|ませんでした)|る|ます|た|ない)';
  if (cue === 'てしまう') return '(?:[てで]しま(?:う|います|った|いました|わない|いません|おう)|(?:ちゃ|じゃ)(?:う|った|わない))';
  if (cue === 'てもいい') return '[てで]も(?:いい|よい|よかった)';
  if (cue === 'てはいけない') return '(?:[てで]はいけ(?:ない|ません|なかった)|(?:ちゃ|じゃ)いけ(?:ない|ません))';
  if (cue === 'てはいられない') return '[てで]はいられ(?:ない|ません|なかった)';
  if (cue === 'てください') return '[てで]ください';
  if (cue === 'てみる') return '[てで]み(?:る|ます|た|ました|ない|よう)';
  if (cue === 'ておく') return '[てで]お(?:く|きます|いた|きました|かない|こう)';
  if (cue === 'てある') return '[てで]あ(?:る|ります|った|りました)';
  if (cue === 'てくる') return '[てで](?:くる|きます|きた|きました|こない)';
  if (cue === 'ていく') return '[てで](?:いく|いきます|いった|いきました|かない)';
  if (cue === 'てあげる') return '[てで]あげ(?:る|ます|た|ました|ない)';
  if (cue === 'てくれる') return '[てで]くれ(?:る|ます|た|ました|ない|ませんか)';
  if (cue === 'てもらう') return '[てで]もら(?:う|います|った|いました|えない|えます)';
  if (cue === 'なければならない') return 'なければ(?:なら(?:ない|なかった)|なり(?:ません|ませんでした))';
  if (cue === 'なくてはいけない') return 'なくてはいけ(?:ない|ません|なかった|ませんでした)';
  if (cue === 'なくてもいい') return 'なくても(?:いい|よい)';
  if (cue === 'たい') return 'た(?:い|くない|かった|くなかった)';
  if (cue === 'がほしい') return 'がほし(?:い|くない|かった)';
  if (cue === 'ことができる') return 'ことができ(?:る|ます|た|ました|ない|ません|なかった)';

  // General ending inflection patterns for multi-character grammar cues
  if (cue.length >= 3) {
    if (cue.endsWith('ない')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:ない|なかった|なくて|ません|ませんでした|ありません|ありませんでした)`;
    }
    if (cue.endsWith('する')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:してい(?:る|ます|た|ました|ない|ません)|します|しました|しません|しない|する|した|して)`;
    }
    if (cue.endsWith('なる')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:なってい(?:る|ます|た|ました)|なります|なりました|なりません|ならない|なる|なった|なって)`;
    }
    if (cue.endsWith('ある')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:ある|あります|あった|ありました)`;
    }
    if (cue.endsWith('いる')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:いる|います|いた|いました|いない|いません)`;
    }
    if (cue.endsWith('だ')) {
      const stem = escapeRegex(cue.slice(0, -1));
      return `${stem}(?:だ|です|だった|でした|な|に)`;
    }
    if (cue.endsWith('して')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:して|し|する|した)`;
    }
    if (cue.endsWith('って')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:って|い|う|る|った)`;
    }
    if (cue.endsWith('いて')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:いて|き|く|いた)`;
    }
    if (cue.endsWith('じて')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:じて|じ|じる|じた)`;
    }
    if (cue.endsWith('えて')) {
      const stem = escapeRegex(cue.slice(0, -2));
      return `${stem}(?:えて|え|える|えた)`;
    }
  }

  return esc;
}

const compiledCache = new WeakMap<GrammarPoint[], CompiledRule[]>();

function compileGrammarPoints(grammarPoints: GrammarPoint[]): CompiledRule[] {
  const cached = compiledCache.get(grammarPoints);
  if (cached) return cached;

  const rules: CompiledRule[] = [];
  for (const grammar of grammarPoints) {
    if (SKIP_AMBIGUOUS_SINGLE_IDS.has(grammar.id)) continue;

    const rawPatterns = grammar.matchPatterns?.length ? grammar.matchPatterns : [grammar.pattern];
    const seenKeys = new Set<string>();

    for (const raw of rawPatterns) {
      const cleaned = raw
        .replace(/^[〜~・…\s]+/, '')
        .replace(/[〜~・…\s]+$/, '')
        .trim();
      if (!cleaned) continue;

      const splitParts = cleaned.split(/[〜~…]+/).map((p) => p.trim()).filter(Boolean);
      if (splitParts.length === 0 || splitParts.length > 2) continue;

      const key = splitParts.join('〜');
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const isDiscontinuous = splitParts.length === 2;
      const baseLength = splitParts.reduce((sum, p) => sum + p.length, 0);
      const isSingleChar = !isDiscontinuous && baseLength === 1;

      // Skip single-character non-particle/too-generic cues unless explicitly meaningful
      if (isSingleChar && !['や', 'も', 'ね', 'よ', 'へ', 'し'].includes(splitParts[0])) {
        continue;
      }

      const regexes = splitParts.map((part) => new RegExp(cueToRegexSource(part), 'g'));
      const requiresVerbBefore = grammar.id === 'tai' || grammar.id === 'masen' || grammar.id === 'mashita' || grammar.id === 'mashou' || grammar.id === 'mashou-ka' || grammar.id === 'masen-ka' || grammar.id === 'nai';

      rules.push({
        grammar,
        parts: regexes,
        baseLength,
        isDiscontinuous,
        isSingleChar,
        requiresVerbBefore,
      });
    }
  }

  compiledCache.set(grammarPoints, rules);
  return rules;
}

function buildSentenceTokenSpans(phrases: Phrase[]): {
  text: string;
  tokens: TokenSpan[];
  starts: Map<number, TokenSpan>;
  ends: Map<number, TokenSpan>;
} {
  const tokens: TokenSpan[] = [];
  const starts = new Map<number, TokenSpan>();
  const ends = new Map<number, TokenSpan>();
  let offset = 0;

  phrases.forEach((phrase, phraseIndex) => {
    for (const token of phrase.tokens) {
      const start = offset;
      const end = offset + token.surface.length;
      const span: TokenSpan = {
        start,
        end,
        surface: token.surface,
        base: token.base,
        pos: token.pos,
        phraseIndex,
      };
      tokens.push(span);
      starts.set(start, span);
      ends.set(end, span);
      offset = end;
    }
  });

  return { text: phrases.map((p) => p.text).join(''), tokens, starts, ends };
}

function isTokenAligned(
  start: number,
  end: number,
  starts: Map<number, TokenSpan>,
  ends: Map<number, TokenSpan>,
  tokens: TokenSpan[],
  rule: CompiledRule
): boolean {
  const startToken = starts.get(start);
  const endToken = ends.get(end);
  if (!startToken || !endToken) return false;

  // Reject short 1-2 char cues that fall entirely inside a single content word (e.g., `から` in `からだ`, `なり` in `なります`)
  if (
    startToken === endToken &&
    (startToken.pos === '名詞' || startToken.pos === '動詞' || startToken.pos === '形容詞') &&
    rule.baseLength <= 2 &&
    !rule.isDiscontinuous
  ) {
    return false;
  }

  // Disambiguate 〜から (from) vs 〜から (reason) using preceding token POS
  if (rule.grammar.id === 'kara-from' || rule.grammar.id === 'kara-reason') {
    const startIdx = tokens.indexOf(startToken);
    const prev = startIdx > 0 ? tokens[startIdx - 1] : undefined;
    const afterClause = prev && (prev.pos === '動詞' || prev.pos === '形容詞' || prev.pos === '助動詞');
    if (rule.grammar.id === 'kara-from' && afterClause) return false;
    if (rule.grammar.id === 'kara-reason' && prev && prev.pos === '名詞') return false;
  }

  // Single-char cues must match a particle token only
  if (rule.isSingleChar && startToken.pos !== '助詞') {
    return false;
  }

  // Verb-attached auxiliaries like 〜たい / 〜ましょう require a verb/auxiliary right before
  if (rule.requiresVerbBefore) {
    const startIdx = tokens.indexOf(startToken);
    const prev = startIdx > 0 ? tokens[startIdx - 1] : undefined;
    if (!prev || (prev.pos !== '動詞' && prev.pos !== '助動詞')) {
      return false;
    }
  }

  return true;
}

interface CandidateMatch {
  grammar: GrammarPoint;
  matchedText: string;
  sentenceIndex: number;
  charStart: number;
  charEnd: number;
  spans: Array<[number, number]>;
  phraseIndices: number[];
  score: number;
  isSingleChar: boolean;
}

function collectPhraseIndices(tokens: TokenSpan[], start: number, end: number): number[] {
  const set = new Set<number>();
  for (const t of tokens) {
    if (t.end > start && t.start < end) {
      set.add(t.phraseIndex);
    }
  }
  return [...set].sort((a, b) => a - b);
}

const LEVEL_PRIORITY: Record<string, number> = {
  N1: 5,
  N2: 4,
  N3: 3,
  N4: 2,
  N5: 1,
};

/**
 * Detect JLPT grammar patterns inside parsed Kuromoji sentences.
 * Returns deduplicated, non-overlapping high-signal grammar matches linked to phrase indices.
 */
export function matchSentenceGrammar(
  sentences: Phrase[][],
  grammarPoints: GrammarPoint[],
  maxPerSentence = 8
): SentenceGrammarMatch[] {
  if (!sentences.length || !grammarPoints.length) return [];
  const rules = compileGrammarPoints(grammarPoints);
  const allResults: SentenceGrammarMatch[] = [];
  const seenGlobal = new Set<string>();

  sentences.forEach((phrases, sentenceIndex) => {
    const { text, tokens, starts, ends } = buildSentenceTokenSpans(phrases);
    if (!text) return;

    const candidates: CandidateMatch[] = [];

    for (const rule of rules) {
      if (!rule.isDiscontinuous) {
        const re = rule.parts[0];
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          const start = m.index;
          const end = start + m[0].length;
          if (!isTokenAligned(start, end, starts, ends, tokens, rule)) continue;

          const phraseIndices = collectPhraseIndices(tokens, start, end);
          if (!phraseIndices.length) continue;

          const score =
            m[0].length * 14 +
            (rule.isSingleChar ? -30 : 20) +
            (LEVEL_PRIORITY[rule.grammar.level] ?? 0);

          candidates.push({
            grammar: rule.grammar,
            matchedText: m[0],
            sentenceIndex,
            charStart: start,
            charEnd: end,
            spans: [[start, end]],
            phraseIndices,
            score,
            isSingleChar: rule.isSingleChar,
          });
          break; // one match per rule per sentence
        }
      } else {
        const [re1, re2] = rule.parts;
        re1.lastIndex = 0;
        const m1 = re1.exec(text);
        if (!m1) continue;
        const s1 = m1.index;
        const e1 = s1 + m1[0].length;
        if (!isTokenAligned(s1, e1, starts, ends, tokens, rule)) continue;

        re2.lastIndex = e1;
        let m2: RegExpExecArray | null;
        while ((m2 = re2.exec(text)) !== null) {
          const s2 = m2.index;
          const e2 = s2 + m2[0].length;
          if (s2 - e1 > 32) break;
          if (!isTokenAligned(s2, e2, starts, ends, tokens, rule)) continue;

          const phraseIndices = [
            ...new Set([
              ...collectPhraseIndices(tokens, s1, e1),
              ...collectPhraseIndices(tokens, s2, e2),
            ]),
          ].sort((a, b) => a - b);
          if (!phraseIndices.length) continue;

          const score =
            (m1[0].length + m2[0].length) * 16 +
            35 +
            (LEVEL_PRIORITY[rule.grammar.level] ?? 0);

          candidates.push({
            grammar: rule.grammar,
            matchedText: `${m1[0]}…${m2[0]}`,
            sentenceIndex,
            charStart: s1,
            charEnd: e2,
            spans: [
              [s1, e1],
              [s2, e2],
            ],
            phraseIndices,
            score,
            isSingleChar: false,
          });
          break;
        }
      }
    }

    // Sort strongest / longest matches first
    candidates.sort((a, b) => b.score - a.score || a.charStart - b.charStart);

    const accepted: CandidateMatch[] = [];
    const seenIds = new Set<string>();
    const hasCompound = candidates.some((c) => !c.isSingleChar);

    for (const cand of candidates) {
      if (accepted.length >= maxPerSentence) break;
      if (seenIds.has(cand.grammar.id)) continue;
      // If we already found real multi-mora grammar structures, skip trivial 1-char particles
      if (cand.isSingleChar && hasCompound) continue;

      // Suppress if every span of cand is strictly covered by an already-accepted match span
      const isContained = accepted.some((existing) =>
        cand.spans.every(([cs, ce]) => existing.spans.some(([es, ee]) => cs >= es && ce <= ee))
      );
      if (isContained) continue;

      seenIds.add(cand.grammar.id);
      accepted.push(cand);
    }

    // Order accepted matches by reading position in the sentence
    accepted.sort((a, b) => a.charStart - b.charStart);

    for (const item of accepted) {
      const dedupeKey = `${sentenceIndex}:${item.grammar.id}`;
      if (seenGlobal.has(dedupeKey)) continue;
      seenGlobal.add(dedupeKey);
      allResults.push({
        grammar: item.grammar,
        matchedText: item.matchedText,
        sentenceIndex: item.sentenceIndex,
        phraseIndices: item.phraseIndices,
      });
    }
  });

  return allResults;
}
