import type { IpadicFeatures } from 'kuromoji';

export type Role = 'topic' | 'subject' | 'object' | 'complement' | 'modifier' | 'relative' | 'adverbial'
  | 'predicate' | 'connective' | 'conjunction' | 'interjection' | 'other';
export type Token = { surface: string; base: string; reading: string; pos: string; lookup: boolean };
export type Phrase = { text: string; reading: string; role: Role; note: string; tokens: Token[]; clauseOf?: string };

const INDEPENDENT = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞', '接続詞', '感動詞', '接頭詞', 'フィラー']);
const SENTENCE_END = /^[。！？!?]$/u;
const CASE: Record<string, [Role, string]> = {
  が: ['subject', 'Chủ ngữ (が)'],
  を: ['object', 'Tân ngữ (を)'],
  に: ['complement', 'Bổ ngữ (に): đích, thời điểm, nơi tồn tại, đối tượng'],
  へ: ['complement', 'Bổ ngữ (へ): hướng'],
  で: ['complement', 'Bổ ngữ (で): nơi diễn ra, phương tiện, nguyên nhân'],
  と: ['complement', 'Bổ ngữ (と): cùng với'],
  から: ['complement', 'Bổ ngữ (から): khởi điểm'],
  まで: ['complement', 'Bổ ngữ (まで): giới hạn'],
  より: ['complement', 'Bổ ngữ (より): so sánh, khởi điểm'],
};
const CONJUNCTIVE: Record<string, [Role, string]> = {
  て: ['connective', 'Vế nối (て)'], で: ['connective', 'Vế nối (で)'],
  ば: ['relative', 'Mệnh đề điều kiện (ば)'], たら: ['relative', 'Mệnh đề điều kiện (たら)'],
  から: ['relative', 'Mệnh đề lý do (から)'], ので: ['relative', 'Mệnh đề lý do (ので)'],
  が: ['relative', 'Mệnh đề tương phản (が)'], けど: ['relative', 'Mệnh đề tương phản (けど)'],
  けれど: ['relative', 'Mệnh đề tương phản (けれど)'], けれども: ['relative', 'Mệnh đề tương phản (けれども)'],
  のに: ['relative', 'Mệnh đề nhượng bộ (のに)'], ながら: ['relative', 'Mệnh đề đồng thời (ながら)'],
  し: ['connective', 'Vế liệt kê (し)'], と: ['relative', 'Mệnh đề điều kiện (と)'],
};
const ROLE_STOPS = new Set<Role>(['topic', 'predicate', 'connective', 'relative', 'conjunction', 'interjection']);

const hira = (s: string) => s.replace(/[ァ-ヶ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

function startsPhrase(t: IpadicFeatures, prev: IpadicFeatures | undefined) {
  if (!prev || prev.pos === '接頭詞') return !prev;
  if (!INDEPENDENT.has(t.pos) || t.pos_detail_1 === '非自立' || t.pos_detail_1 === '接尾') return false;
  // ponytail: nouns in a row = compound noun unless the first is a time-like 副詞可能 noun (昨日 私).
  if (t.pos === '名詞' && prev.pos === '名詞') return prev.pos_detail_1 === '副詞可能';
  if (t.pos === '動詞' && prev.pos === '名詞' && prev.pos_detail_1 === 'サ変接続') return false;
  return true;
}

function caseRole(tokens: IpadicFeatures[]): [Role, string] | null {
  for (let i = tokens.length - 1; i >= 0 && tokens[i].pos === '助詞'; i--) {
    const t = tokens[i], s = t.surface_form;
    if (t.pos_detail_1 === '係助詞' && s === 'は') return ['topic', 'Chủ đề (は) — thường là chủ ngữ'];
    if (t.pos_detail_1 === '係助詞' && s === 'も') return ['topic', 'Chủ đề (も): cũng'];
    if (t.pos_detail_1 === '連体化') return ['modifier', 'Định ngữ (の): bổ nghĩa danh từ sau'];
    if (t.pos_detail_1 === '接続助詞') return CONJUNCTIVE[s] ?? ['connective', `Vế nối (${s})`];
    if (t.pos_detail_1 === '格助詞' && s === 'と' && t.pos_detail_2 === '引用') return ['complement', 'Trích dẫn (と)'];
    if (t.pos_detail_1 === '格助詞' && CASE[s]) return CASE[s];
  }
  return null;
}

function parseSentence(tokens: IpadicFeatures[]): Phrase[] {
  const groups: IpadicFeatures[][] = [];
  tokens.forEach((t, i) => {
    if (t.pos === '記号') return;
    if (startsPhrase(t, tokens[i - 1]) || !groups.length || tokens[i - 1]?.pos === '記号') groups.push([t]);
    else groups.at(-1)!.push(t);
  });

  const phrases = groups.map((g): Phrase => ({
    text: g.map((t) => t.surface_form).join(''),
    reading: hira(g.map((t) => t.reading ?? t.surface_form).join('')),
    role: 'other', note: 'Thành phần khác',
    tokens: g.map((t) => ({
      surface: t.surface_form, base: t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form,
      reading: hira(t.reading ?? ''), pos: t.pos,
      lookup: t.pos !== '助動詞' && t.pos_detail_1 !== '接尾' && !(t.pos === '動詞' && t.pos_detail_1 === '非自立'),
    })),
  }));

  groups.forEach((g, i) => {
    const p = phrases[i], next = groups[i + 1];
    const content = g.findLast((t) => t.pos !== '助詞') ?? g[0];
    const head = g.find((t) => t.pos !== '接頭詞') ?? g[0];
    const byCase = caseRole(g);
    const finalParticle = g.at(-1)!.pos_detail_1 === '終助詞';
    let [role, note]: [Role, string] = byCase ?? ['other', 'Thành phần khác'];
    if (!next && (!byCase || finalParticle)) [role, note] = ['predicate', 'Vị ngữ'];
    else if (!byCase && g.at(-1)!.pos !== '助詞') {
      const form = content.conjugated_form;
      const nounNext = next?.find((t) => t.pos !== '接頭詞')?.pos === '名詞';
      if (/^(動詞|形容詞|助動詞)$/u.test(content.pos) && nounNext && /^(基本形|体言接続)/u.test(form))
        [role, note] = ['modifier', `Định ngữ: bổ nghĩa cho ${phrases[i + 1].text}`];
      else if (head.pos === '副詞' || (content.pos === '形容詞' && form.startsWith('連用')) || head.pos_detail_1 === '副詞可能')
        [role, note] = ['adverbial', 'Trạng ngữ'];
      else if (content.pos === '動詞' && form.startsWith('連用')) [role, note] = ['connective', 'Vế nối (liên dụng)'];
      else if (head.pos === '連体詞') [role, note] = ['modifier', 'Định ngữ'];
      else if (head.pos === '接続詞') [role, note] = ['conjunction', 'Liên từ'];
      else if (head.pos === '感動詞') [role, note] = ['interjection', 'Thán từ'];
    }
    p.role = role; p.note = note;
  });

  // A noun-modifying predicate takes its preceding arguments with it: 私が昨日買った本 → [私が 昨日 買った] 本.
  // ponytail: adjective clauses only absorb an adjacent が (背が高い人); verb clauses absorb back to the
  // nearest topic/predicate, so 友達と昨日買った本を読んだ may over-attach 友達と. Needs a dependency parser to fix.
  phrases.forEach((p, i) => {
    if (p.role !== 'modifier' || !p.note.startsWith('Định ngữ: bổ nghĩa cho')) return;
    const noun = groups[i + 1].filter((t) => t.pos !== '助詞').map((t) => t.surface_form).join('');
    const adjective = groups[i].find((t) => t.pos !== '接頭詞')?.pos === '形容詞';
    let j = i - 1;
    if (adjective) j = phrases[j]?.role === 'subject' ? j - 1 : j;
    else while (j >= 0 && !ROLE_STOPS.has(phrases[j].role)) j--;
    if (j === i - 1) { p.note = `Định ngữ: bổ nghĩa cho ${noun}`; return; }
    p.role = 'relative';
    p.note = `Mệnh đề định ngữ: bổ nghĩa cho ${noun}`;
    for (let k = j + 1; k <= i; k++) phrases[k].clauseOf ??= noun;
  });
  return phrases;
}

/** Returns one phrase list per sentence. */
export function analyzeTokens(tokens: IpadicFeatures[]): Phrase[][] {
  const sentences: IpadicFeatures[][] = [[]];
  for (const t of tokens) {
    sentences.at(-1)!.push(t);
    if (SENTENCE_END.test(t.surface_form)) sentences.push([]);
  }
  return sentences.filter((s) => s.some((t) => t.pos !== '記号')).map(parseSentence);
}
