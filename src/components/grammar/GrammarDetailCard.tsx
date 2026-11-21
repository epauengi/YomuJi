'use client';

import Link from 'next/link';
import { ArrowUpRight, SpeakerHigh, X } from '@phosphor-icons/react';
import { playJapaneseAudio } from '@/lib/tts';
import { parseFurigana } from '@/lib/grammar/furigana';
import { formatGrammarTagVi } from '@/lib/grammar/tags';
import type { GrammarLevel, GrammarPoint } from '@/types/grammar';
import { GrammarText } from './GrammarText';

export const LEVEL_INK: Record<GrammarLevel, string> = {
  N5: 'var(--color-success)',
  N4: 'var(--color-primary-700)',
  N3: 'var(--color-info)',
  N2: 'var(--color-warning)',
  N1: 'var(--color-error)',
};

export function GrammarLevelPill({ level }: { level: GrammarLevel }) {
  const ink = LEVEL_INK[level] ?? 'var(--color-primary-700)';
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide tabular-nums"
      style={{
        color: ink,
        backgroundColor: `color-mix(in srgb, ${ink} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${ink} 28%, transparent)`,
      }}
    >
      {level}
    </span>
  );
}

function FuriganaText({ text, furigana }: { text: string; furigana?: string }) {
  if (!furigana) {
    return <span>{text}</span>;
  }
  const segments = parseFurigana(furigana);
  return (
    <>
      {segments.map((seg, i) =>
        seg.reading ? (
          <ruby key={i}>
            {seg.text}
            <rt className="select-none text-[0.62em] font-normal text-[var(--color-text-muted)]">
              {seg.reading}
            </rt>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

interface GrammarDetailCardProps {
  grammar: GrammarPoint;
  matchedText?: string;
  onClose?: () => void;
  showDirectoryLink?: boolean;
  className?: string;
}

export function GrammarDetailCard({
  grammar,
  matchedText,
  onClose,
  showDirectoryLink = false,
  className = '',
}: GrammarDetailCardProps) {
  const formationVariants = grammar.formation
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const speakPattern = grammar.pattern
    .replace(/[〜~・…]/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .split(/[/／]/)[0]
    ?.trim();

  const showReading =
    grammar.reading &&
    grammar.reading.replace(/[〜~]/g, '') !== grammar.pattern.replace(/[〜~]/g, '');

  return (
    <article
      aria-label={`Chi tiết ngữ pháp ${grammar.pattern}`}
      className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 ${className}`}
    >
      {/* Top metadata & actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <GrammarLevelPill level={grammar.level} />
            {matchedText && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-50)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary-700)]">
                Khớp trong câu:
                <span lang="ja" className="jp-text font-semibold">
                  {matchedText}
                </span>
              </span>
            )}
          </div>

          <h2 className="mt-2.5 text-2xl font-bold leading-snug tracking-[-0.02em] text-[var(--color-text-primary)]">
            <GrammarText text={grammar.pattern} />
          </h2>

          {(showReading || grammar.romaji) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-text-muted)]">
              {showReading && (
                <GrammarText text={grammar.reading} className="font-medium text-[var(--color-text-secondary)]" />
              )}
              {grammar.romaji && <span>[{grammar.romaji}]</span>}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {speakPattern && (
            <button
              type="button"
              onClick={() => playJapaneseAudio(speakPattern)}
              title="Nghe phát âm mẫu câu"
              aria-label={`Nghe phát âm ${grammar.pattern}`}
              className="tactile inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
            >
              <SpeakerHigh size={18} aria-hidden="true" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng thẻ giải thích ngữ pháp"
              className="tactile inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Meaning */}
      <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Ý nghĩa
        </p>
        <p className="mt-1 text-base font-semibold leading-relaxed text-[var(--color-text-primary)]">
          {grammar.meaningVi}
        </p>
      </div>

      {/* Formation */}
      {formationVariants.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Cấu trúc kết hợp
          </p>
          <div className="mt-1.5 flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3.5 py-2.5">
            {formationVariants.map((variant, idx) => (
              <p
                key={idx}
                className="text-sm font-medium leading-relaxed text-[var(--color-text-primary)]"
              >
                <GrammarText text={variant} />
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Nuance / Usage Notes */}
      {grammar.nuanceVi && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Sắc thái &amp; Lưu ý
          </p>
          <p className="mt-1.5 border-l-2 border-[var(--color-primary-600)] pl-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {grammar.nuanceVi}
          </p>
        </div>
      )}

      {/* Examples */}
      {grammar.examples.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Ví dụ ({grammar.examples.length})
          </p>
          <ol className="mt-2 divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
            {grammar.examples.map((ex, idx) => (
              <li key={idx} className="flex items-start gap-2.5 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p
                    lang="ja"
                    className="jp-text text-[0.98rem] font-medium leading-[2.05] text-[var(--color-text-primary)]"
                  >
                    <FuriganaText text={ex.ja} furigana={ex.furigana} />
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {ex.vi}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => playJapaneseAudio(ex.ja)}
                  title="Nghe câu ví dụ"
                  aria-label={`Nghe ví dụ ${idx + 1}`}
                  className="tactile mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
                >
                  <SpeakerHigh size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Tags & Directory link */}
      {(grammar.tags.length > 0 || showDirectoryLink) && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-3.5">
          <div className="flex flex-wrap gap-1.5">
            {grammar.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]"
              >
                {formatGrammarTagVi(tag)}
              </span>
            ))}
          </div>

          {showDirectoryLink && (
            <Link
              href={`/grammar?level=${grammar.level}&selected=${encodeURIComponent(grammar.slug)}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary-700)] hover:underline"
            >
              Mở trong Tra cứu Ngữ pháp
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
