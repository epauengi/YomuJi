'use client';

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { CaretDown, Info } from '@phosphor-icons/react';
import { canChunkJapanese, chunkJapanese } from '@/lib/japaneseChunks';
import { lookupReaderWord } from '@/lib/readerLookup';
import { wordHref } from '@/lib/wordRoutes';
import type { Phrase, Role, Token } from '@/lib/sentenceParse';
import type { DictionarySearchResult, TermRecord } from '@/types/dictionary';
import type { SentenceGrammarMatch } from '@/types/grammar';
import { GrammarDetailCard } from '@/components/grammar/GrammarDetailCard';
import { GrammarText } from '@/components/grammar/GrammarText';
import styles from './SentenceAnalysis.module.css';

// ponytail: cap lookups per query; raise or batch server-side if long paragraphs become common.
const MAX_WORDS = 24;
const JP = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u;
const HAN = /\p{sc=Han}/u;
const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞', '接続詞', '感動詞']);
const POS_VI: Record<string, string> = {
  名詞: 'danh từ', 動詞: 'động từ', 形容詞: 'tính từ', 副詞: 'phó từ', 助詞: 'trợ từ', 助動詞: 'trợ động từ',
  連体詞: 'liên thể từ', 接続詞: 'liên từ', 感動詞: 'thán từ', 接頭詞: 'tiền tố',
};
const ROLE: Record<Role, string> = {
  topic: 'Chủ đề', subject: 'Chủ ngữ', object: 'Tân ngữ', complement: 'Bổ ngữ', modifier: 'Định ngữ',
  relative: 'Mệnh đề', adverbial: 'Trạng ngữ', predicate: 'Vị ngữ', connective: 'Vế nối',
  conjunction: 'Liên từ', interjection: 'Thán từ', other: 'Cụm từ',
};

function fallbackSentences(text: string): Phrase[][] {
  if (!canChunkJapanese()) return [];
  const words = chunkJapanese(text).filter((c) => c.word);
  return words.length > 1 ? [words.map((c) => ({ text: c.text, reading: '', role: 'other', note: '', tokens: [{ surface: c.text, base: c.text, reading: '', pos: '名詞', lookup: true }] }))] : [];
}

function Ruby({ tokens }: { tokens: Token[] }) {
  return <>{tokens.map((t, i) => HAN.test(t.surface) && t.reading && t.reading !== t.surface
    ? <ruby key={i}>{t.surface}<rt>{t.reading}</rt></ruby> : <span key={i}>{t.surface}</span>)}</>;
}

/** Consecutive phrases inside the same noun-modifying clause share one bracket. */
function groupClauses(phrases: Phrase[]) {
  const groups: { clauseOf?: string; items: { phrase: Phrase; index: number }[] }[] = [];
  phrases.forEach((phrase, index) => {
    const last = groups.at(-1);
    if (phrase.clauseOf && last?.clauseOf === phrase.clauseOf) last.items.push({ phrase, index });
    else groups.push({ clauseOf: phrase.clauseOf, items: [{ phrase, index }] });
  });
  return groups;
}

const isContentWord = (t: Token) => t.lookup && CONTENT_POS.has(t.pos) && JP.test(t.base);
const grammarKey = (match: SentenceGrammarMatch) => `${match.sentenceIndex}:${match.grammar.id}`;
type Tab = 'phrases' | 'grammar';

function Meaning({ term }: { term: TermRecord | null | undefined }) {
  if (term) return term.meaningsVi.slice(0, 2).join('; ') || 'Chưa có nghĩa tiếng Việt';
  return <span className={styles.muted}>{term === undefined ? 'Đang tra…' : 'Không có trong từ điển'}</span>;
}

function WordType({ token }: { token: Token }) {
  return <>{POS_VI[token.pos] ?? token.pos}{token.base !== token.surface && <> · gốc <span lang="ja" className="jp-text">{token.base}</span></>}</>;
}

export function SentenceAnalysis({ query, results, onShown }: {
  query: string; results: DictionarySearchResult[]; onShown?: (shown: boolean) => void;
}) {
  const normalized = query.normalize('NFKC').trim();
  const exact = results.some(({ term }) => [term.surface, term.reading, ...term.searchAliases]
    .some((value) => value.normalize('NFKC') === normalized));
  const enabled = !exact && JP.test(normalized);
  const [parsed, setParsed] = useState<{ text: string; sentences: Phrase[][]; grammarMatches: SentenceGrammarMatch[]; offline: boolean } | null>(null);
  const [terms, setTerms] = useState<Partial<Record<string, TermRecord | null>>>({});
  const [tab, setTab] = useState<Tab>('phrases');
  const [active, setActive] = useState<string | null>(null);
  const [activeGrammarKey, setActiveGrammarKey] = useState<string | null>(null);
  const uid = useId();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/api/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: normalized }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then((r) => r.ok ? r.json() as Promise<{ sentences: Phrase[][]; grammarMatches?: SentenceGrammarMatch[] }> : Promise.reject(new Error(String(r.status))))
      .then(({ sentences, grammarMatches }) => ({ sentences, grammarMatches: grammarMatches ?? [], offline: false }))
      .catch(() => ({ sentences: fallbackSentences(normalized), grammarMatches: [], offline: true }))
      .then((value) => {
        if (!controller.signal.aborted) {
          setParsed({ text: normalized, ...value });
          setTab('phrases');
          setActive(null);
          setActiveGrammarKey(null);
        }
      });
    return () => controller.abort();
  }, [enabled, normalized]);

  const current = enabled && parsed?.text === normalized ? parsed : null;
  const sentences = useMemo(() => current?.sentences.filter((s) => s.length > 1 || current.sentences.length > 1) ?? [], [current]);
  const grammarMatches = current?.grammarMatches ?? [];
  const unique = useMemo(() => [...new Set(sentences.flat().flatMap((p) => p.tokens)
    .filter(isContentWord).map((t) => t.base))].slice(0, MAX_WORDS), [sentences]);
  const shown = sentences.length > 0;

  useEffect(() => { onShown?.(shown); return () => onShown?.(false); }, [onShown, shown]);

  useEffect(() => {
    if (!unique.length) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    unique.forEach((word) => lookupReaderWord(word, signal)
      .then((found) => found[0] ?? null, () => null)
      .then((term) => { if (!controller.signal.aborted) setTerms((prev) => word in prev ? prev : { ...prev, [word]: term }); }));
    return () => controller.abort();
  }, [unique]);

  if (!enabled) return null;
  if (!current) return <div role="status" aria-label="Đang phân tích câu" className="skeleton-quiet mb-8 h-40 rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)]" />;
  if (!shown) return null;

  const tabs: Tab[] = grammarMatches.length ? ['phrases', 'grammar'] : ['phrases'];
  const phraseCount = sentences.reduce((n, s) => n + s.length, 0);
  const selectedGrammar = tab === 'grammar' ? grammarMatches.find((m) => grammarKey(m) === activeGrammarKey) : undefined;
  const termFor = (word: string) => Object.hasOwn(terms, word) || unique.includes(word) ? terms[word] : null;

  function selectPhrase(id: string) {
    setTab('phrases');
    setActive(id);
    requestAnimationFrame(() => {
      const row = document.getElementById(`${uid}-phrase-${id}`);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: 'nearest' });
    });
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? last
      : event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index + last) % tabs.length : -1;
    if (target === -1) return;
    event.preventDefault();
    setTab(tabs[target]);
    document.getElementById(`${uid}-${tabs[target]}-tab`)?.focus();
  }

  return <section aria-label="Sơ đồ và chi tiết câu" className={styles.analysis}>
    <div className={styles.reading}>
      <div className={styles.readingHeader}>
        <h3>Cấu trúc câu{sentences.length > 1 && <span className={styles.count}>{sentences.length} câu</span>}</h3>
        <p>{current.offline ? 'Ngoại tuyến: chỉ tách từ, chưa có vai trò.' : 'Chọn một cụm để xem nghĩa và vai trò.'}</p>
      </div>
      {sentences.map((phrases, si) => <ol key={si} lang="ja" aria-label={sentences.length > 1 ? `Câu ${si + 1}` : 'Các cụm trong câu'} className={styles.sentence}>
        {groupClauses(phrases).map((group, gi) => {
          const cells = group.items.map(({ phrase, index }) => {
            const id = `${si}-${index}`;
            const selected = tab === 'phrases' && active === id;
            const matched = selectedGrammar?.sentenceIndex === si && selectedGrammar.phraseIndices.includes(index);
            return <li key={id} className={styles.cell}>
              <button type="button" aria-pressed={selected} aria-controls={`${uid}-phrase-${id}`}
                data-matched={matched || undefined} onClick={() => selectPhrase(id)} className={styles.fragment}>
                <span className={styles.japanese}><Ruby tokens={phrase.tokens} /></span>
                {!current.offline && <span lang="vi" className={styles.role}>{ROLE[phrase.role]}</span>}
              </button>
            </li>;
          });
          return group.clauseOf ? <li key={`clause-${gi}`} className={styles.clause}>
            <ol className={styles.sentence}>{cells}</ol>
            <p lang="vi" className={styles.clauseNote}>Bổ nghĩa cho <span lang="ja" className="jp-text font-semibold">{group.clauseOf}</span></p>
          </li> : cells;
        })}
      </ol>)}
    </div>

    {tabs.length > 1 ? <div role="tablist" aria-label="Chi tiết phân tích" className={styles.tabs}>
      {tabs.map((item, index) => <button key={item} type="button" role="tab" id={`${uid}-${item}-tab`}
        aria-controls={`${uid}-${item}`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1}
        onClick={() => setTab(item)} onKeyDown={(event) => onTabKey(event, index)}>
        {item === 'phrases' ? 'Cụm từ' : 'Ngữ pháp'} <span className={styles.count}>{item === 'phrases' ? phraseCount : grammarMatches.length}</span>
      </button>)}
    </div> : <h3 className={styles.singleHeading}>Cụm từ <span className={styles.count}>{phraseCount}</span></h3>}

    <div id={`${uid}-phrases`} role={tabs.length > 1 ? 'tabpanel' : undefined}
      aria-labelledby={tabs.length > 1 ? `${uid}-phrases-tab` : undefined} tabIndex={tabs.length > 1 ? 0 : undefined}
      hidden={tab !== 'phrases'}>
      <ol aria-label="Chi tiết từng cụm" className={styles.list}>
        {sentences.flatMap((phrases, si) => phrases.map((phrase, index) => {
          const id = `${si}-${index}`;
          const parts = phrase.tokens.filter(isContentWord);
          const grammar = phrase.tokens.filter((t) => !parts.includes(t));
          const single = parts.length === 1 ? parts[0] : null;
          const term = single ? termFor(single.base) : null;
          return <li key={id} id={`${uid}-phrase-${id}`} tabIndex={-1} data-selected={active === id || undefined} className={styles.phraseRow}>
            <div>
              <p lang="ja" className={`jp-text ${styles.phraseName}`}>
                {single ? (term ? <Link href={wordHref(term)} title={`Tra từ ${term.surface}`}>{phrase.text}</Link> : phrase.text)
                  : phrase.tokens.map((t, ti) => {
                    const entry = parts.includes(t) ? termFor(t.base) : null;
                    return entry ? <Link key={ti} href={wordHref(entry)} title={`Tra từ ${entry.surface}`}>{t.surface}</Link> : <span key={ti}>{t.surface}</span>;
                  })}
              </p>
              {!current.offline && <p className={styles.meta}>{phrase.note || ROLE[phrase.role]}</p>}
            </div>
            <div>
              {single ? <p><Meaning term={term} /></p> : parts.map((t, ti) => <p key={ti} className={styles.wordMeaning}>
                <strong lang="ja" className="jp-text">{t.surface}</strong> <Meaning term={termFor(t.base)} /> <small className={styles.meta}><WordType token={t} /></small>
              </p>)}
              {(single || grammar.length > 0) && <ul aria-label="Từ loại" className={styles.wordTypes}>
                {single && <li><WordType token={single} /></li>}
                {grammar.map((t, ti) => <li key={ti}><strong lang="ja" className="jp-text">{t.surface}</strong> {POS_VI[t.pos] ?? t.pos}</li>)}
              </ul>}
            </div>
          </li>;
        }))}
      </ol>
    </div>

    {grammarMatches.length > 0 && <div id={`${uid}-grammar`} role="tabpanel" aria-labelledby={`${uid}-grammar-tab`} hidden={tab !== 'grammar'}>
      <ul className={styles.list}>
        {grammarMatches.map((match, index) => {
          const key = grammarKey(match);
          const open = activeGrammarKey === key;
          const triggerId = `${uid}-grammar-trigger-${index}`;
          return <li key={key}>
            <button type="button" id={triggerId} aria-expanded={open} aria-controls={`${uid}-grammar-detail-${index}`}
              onClick={() => setActiveGrammarKey(open ? null : key)} className={styles.grammarRow}>
              <span className={styles.level}>{match.grammar.level}</span>
              <GrammarText text={match.grammar.pattern} className="font-semibold" />
              <span className={styles.grammarMeaning}>{match.grammar.meaningVi}</span>
              <CaretDown size={16} aria-hidden="true" className={styles.caret} />
            </button>
            <div id={`${uid}-grammar-detail-${index}`} hidden={!open} className={styles.grammarDetail}>
              {open && <GrammarDetailCard grammar={match.grammar} matchedText={match.matchedText} showDirectoryLink
                className="!border-0 !bg-transparent !p-0" onClose={() => {
                  setActiveGrammarKey(null);
                  document.getElementById(triggerId)?.focus();
                }} />}
            </div>
          </li>;
        })}
      </ul>
    </div>}

    {!current.offline && <p className={styles.disclaimer}>
      <Info size={16} aria-hidden="true" />
      <span>Phân tích tự động theo trợ từ và từ loại. Câu lược chủ ngữ hoặc câu phức nhiều tầng có thể chưa chính xác.</span>
    </p>}
  </section>;
}
