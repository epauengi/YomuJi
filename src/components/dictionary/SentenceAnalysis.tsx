'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { canChunkJapanese, chunkJapanese } from '@/lib/japaneseChunks';
import { lookupReaderWord } from '@/lib/readerLookup';
import { wordHref } from '@/lib/wordRoutes';
import type { Phrase, Role, Token } from '@/lib/sentenceParse';
import type { DictionarySearchResult, TermRecord } from '@/types/dictionary';

// ponytail: cap lookups per query; raise or batch server-side if long paragraphs become common.
const MAX_WORDS = 24;
const JP = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u;
const HAN = /\p{sc=Han}/u;
const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞', '接続詞', '感動詞']);
const POS_VI: Record<string, string> = {
  名詞: 'danh từ', 動詞: 'động từ', 形容詞: 'tính từ', 副詞: 'phó từ', 助詞: 'trợ từ', 助動詞: 'trợ động từ',
  連体詞: 'liên thể từ', 接続詞: 'liên từ', 感動詞: 'thán từ', 接頭詞: 'tiền tố',
};

// Grammar-workbook ink: who acts (blue), what is acted on (green), what describes (amber), the verdict (red).
const ROLE: Record<Role, { label: string; ink: string }> = {
  topic: { label: 'Chủ đề', ink: 'var(--color-info)' },
  subject: { label: 'Chủ ngữ', ink: 'var(--color-info)' },
  object: { label: 'Tân ngữ', ink: 'var(--color-success)' },
  complement: { label: 'Bổ ngữ', ink: 'var(--color-success)' },
  modifier: { label: 'Định ngữ', ink: 'var(--color-warning)' },
  relative: { label: 'Mệnh đề', ink: 'var(--color-warning)' },
  adverbial: { label: 'Trạng ngữ', ink: 'var(--color-primary-700)' },
  predicate: { label: 'Vị ngữ', ink: 'var(--color-error)' },
  connective: { label: 'Vế nối', ink: 'var(--color-primary-700)' },
  conjunction: { label: 'Liên từ', ink: 'var(--color-primary-700)' },
  interjection: { label: 'Thán từ', ink: 'var(--color-text-muted)' },
  other: { label: 'Cụm từ', ink: 'var(--color-text-muted)' },
};
const tint = (ink: string, pct: number) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`;

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

export function SentenceAnalysis({ query, results, onShown }: {
  query: string; results: DictionarySearchResult[]; onShown?: (shown: boolean) => void;
}) {
  const normalized = query.normalize('NFKC').trim();
  const exact = results.some(({ term }) => [term.surface, term.reading, ...term.searchAliases]
    .some((value) => value.normalize('NFKC') === normalized));
  const enabled = !exact && JP.test(normalized);
  const [parsed, setParsed] = useState<{ text: string; sentences: Phrase[][]; offline: boolean } | null>(null);
  const [terms, setTerms] = useState<Record<string, TermRecord | null>>({});
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/api/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: normalized }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then((r) => r.ok ? r.json() as Promise<{ sentences: Phrase[][] }> : Promise.reject(new Error(String(r.status))))
      .then(({ sentences }) => ({ sentences, offline: false }))
      .catch(() => ({ sentences: fallbackSentences(normalized), offline: true }))
      .then((value) => { if (!controller.signal.aborted) setParsed({ text: normalized, ...value }); });
    return () => controller.abort();
  }, [enabled, normalized]);

  const current = enabled && parsed?.text === normalized ? parsed : null;
  const sentences = useMemo(() => current?.sentences.filter((s) => s.length > 1 || current.sentences.length > 1) ?? [], [current]);
  const unique = useMemo(() => [...new Set(sentences.flat().flatMap((p) => p.tokens)
    .filter((t) => t.lookup && CONTENT_POS.has(t.pos) && JP.test(t.base)).map((t) => t.base))].slice(0, MAX_WORDS), [sentences]);
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

  const phraseCount = sentences.reduce((n, s) => n + s.length, 0);
  const focus = (id: string) => {
    setActive(id);
    document.getElementById(`phrase-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return <section aria-label="Phân tích câu" className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
    <p className="flex flex-wrap items-center gap-x-2 border-b border-[var(--color-border-subtle)] px-5 py-3 text-xs font-medium text-[var(--color-text-secondary)] sm:px-7">
      <span>{sentences.length > 1 ? `${sentences.length} câu` : '1 câu'} · {phraseCount} cụm</span>
      {current.offline && <span className="text-[var(--color-text-muted)]">· Ngoại tuyến: chỉ tách từ, chưa có vai trò</span>}
      <span className="ml-auto hidden text-[var(--color-text-muted)] sm:inline">Chọn một cụm để xem chi tiết</span>
    </p>

    <div className="space-y-8 px-5 py-7 sm:px-7 sm:py-9">
      {sentences.map((phrases, si) => <ol key={si} lang="ja" aria-label={sentences.length > 1 ? `Câu ${si + 1}` : 'Các cụm trong câu'} className="flex flex-wrap items-start gap-x-1 gap-y-5">
        {groupClauses(phrases).map((group, gi) => {
          const cells = group.items.map(({ phrase, index }) => {
            const id = `${si}-${index}`;
            const role = ROLE[phrase.role];
            const on = active === id;
            return <li key={id}>
              <button type="button" aria-pressed={on} onClick={() => focus(id)} title={phrase.note || undefined}
                className="group flex flex-col items-stretch rounded-[var(--radius-sm)] px-1.5 pb-1.5 pt-1 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-primary)]"
                style={{ background: on ? tint(role.ink, 14) : undefined }}>
                <span className="font-[family-name:var(--font-serif)] text-[1.75rem] leading-[2.6] text-[var(--color-text-primary)] sm:text-[2rem] [&_rt]:font-[family-name:var(--font-jp)] [&_rt]:text-[0.42em] [&_rt]:text-[var(--color-text-muted)]">
                  <Ruby tokens={phrase.tokens} />
                </span>
                <span aria-hidden="true" className="h-[3px] rounded-full" style={{ background: role.ink }} />
                {!current.offline && <span lang="vi" className="mt-1.5 text-[0.7rem] font-semibold tracking-wide" style={{ color: role.ink }}>{role.label}</span>}
              </button>
            </li>;
          });
          if (!group.clauseOf) return cells;
          return <li key={`clause-${gi}`} className="flex flex-col">
            <ol className="flex flex-wrap items-start gap-x-1 gap-y-5">{cells}</ol>
            <span lang="vi" className="mx-1.5 mt-2 flex items-start gap-1.5 text-[0.7rem] font-medium text-[var(--color-warning)]">
              <span aria-hidden="true" className="mt-0 h-2 flex-1 rounded-b-[4px] border-x-2 border-b-2 border-current" />
              <span className="shrink-0 -translate-y-0.5">bổ nghĩa cho <span lang="ja" className="jp-text font-bold">{group.clauseOf}</span></span>
            </span>
          </li>;
        })}
      </ol>)}
    </div>

    <ol aria-label="Chi tiết từng cụm" className="divide-y divide-[var(--color-border-subtle)] border-t border-[var(--color-border-subtle)]">
      {sentences.flatMap((phrases, si) => phrases.map((phrase, index) => {
        const id = `${si}-${index}`;
        const role = ROLE[phrase.role];
        const on = active === id;
        const parts = phrase.tokens.filter((t) => t.lookup && CONTENT_POS.has(t.pos) && JP.test(t.base));
        const grammar = phrase.tokens.filter((t) => !parts.includes(t));
        const single = parts.length === 1 ? parts[0] : null;
        const singleTerm = single ? terms[single.base] : undefined;
        const linkClass = 'jp-text inline-flex min-h-11 items-center text-lg font-semibold text-[var(--color-text-primary)] underline decoration-[color-mix(in_srgb,var(--color-primary-700)_55%,transparent)] decoration-[1.5px] underline-offset-4 transition-colors hover:text-[var(--color-primary-700)] hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-primary)] sm:min-h-0';
        return <li key={id} id={`phrase-${id}`} className="grid scroll-mt-24 gap-x-6 gap-y-2 px-5 py-4 transition-colors sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:px-7"
          style={{ background: on ? tint(role.ink, 8) : undefined, boxShadow: on ? `inset 3px 0 0 ${role.ink}` : undefined }}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 sm:block">
            <p lang="ja" className="jp-text text-lg font-semibold text-[var(--color-text-primary)]">
              {single ? (singleTerm ? <Link href={wordHref(singleTerm)} title={`Tra từ ${singleTerm.surface}`} className={linkClass}>{phrase.text}</Link> : phrase.text)
                : phrase.tokens.map((t, ti) => {
                  const term = parts.includes(t) ? terms[t.base] : undefined;
                  return term ? <Link key={ti} href={wordHref(term)} title={`Tra từ ${term.surface}`} className={linkClass}>{t.surface}</Link> : <span key={ti}>{t.surface}</span>;
                })}
            </p>
            {!current.offline && <p className="mt-0.5 text-xs font-semibold leading-snug" style={{ color: role.ink }}>{phrase.note || role.label}</p>}
          </div>
          <div className="min-w-0 space-y-2 sm:pt-0.5">
            {single ? <p className="text-[0.95rem] leading-relaxed text-[var(--color-text-primary)]">
              {singleTerm === undefined ? <span className="text-sm text-[var(--color-text-muted)]">Đang tra…</span>
                : singleTerm ? singleTerm.meaningsVi.slice(0, 2).join('; ') || 'Chưa có nghĩa tiếng Việt'
                  : <span className="text-sm text-[var(--color-text-muted)]">Không có trong từ điển</span>}
            </p> : parts.map((t, ti) => {
              const term = terms[t.base];
              return <p key={ti} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span lang="ja" className="jp-text font-semibold text-[var(--color-text-primary)]">{t.surface}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{POS_VI[t.pos] ?? t.pos}{t.base !== t.surface ? ` · gốc ${t.base}` : ''}</span>
                <span className="text-[var(--color-text-secondary)]">
                  {term === undefined ? <span className="text-[var(--color-text-muted)]">Đang tra…</span>
                    : term ? term.meaningsVi.slice(0, 2).join('; ') || 'Chưa có nghĩa tiếng Việt' : <span className="text-[var(--color-text-muted)]">Không có trong từ điển</span>}
                </span>
              </p>;
            })}
            {(single || grammar.length > 0) && <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-[var(--color-text-muted)]">
              {single && <span>{POS_VI[single.pos] ?? single.pos}{single.base !== single.surface ? <> · gốc <span lang="ja" className="jp-text font-medium text-[var(--color-text-secondary)]">{single.base}</span></> : null}</span>}
              {grammar.map((t, ti) => <span key={ti} className="inline-flex items-baseline gap-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                <span lang="ja" className="jp-text font-semibold text-[var(--color-text-primary)]">{t.surface}</span>{POS_VI[t.pos] ?? t.pos}
              </span>)}
            </p>}
          </div>
        </li>;
      }))}
    </ol>

    {!current.offline && <p className="border-t border-[var(--color-border-subtle)] px-5 py-3 text-xs text-[var(--color-text-muted)] sm:px-7">
      Phân tích tự động theo trợ từ và từ loại. Câu lược chủ ngữ hoặc câu phức nhiều tầng có thể chưa chính xác.
    </p>}
  </section>;
}
