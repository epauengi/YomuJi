'use client';

import Link from 'next/link';
import { CaretRight, SpeakerHigh } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { playJapaneseAudio } from '@/lib/tts';
import {
  formatMatchType,
  formatPartOfSpeech,
} from '@/lib/dictionary/formatters';
import type { DictionarySearchResult, TermRecord } from '@/types/dictionary';

export function TermCard({
  term,
  matchType,
}: {
  term: TermRecord;
  matchType?: DictionarySearchResult['matchType'];
}) {
  return (
    <Card
      variant="default"
      className="surface-lift group relative h-full border-[var(--color-border)] p-0 shadow-none hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface)]"
    >
      <Link
        href={`/word/${encodeURIComponent(term.id)}`}
        className="block h-full rounded-[--radius-lg] p-4 pr-16"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <motion.span
              lang="ja"
              layoutId={`term-surface-${term.id}`}
              className="jp-text text-xl font-semibold leading-7 text-[var(--color-text-primary)]"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            >
              {term.surface}
            </motion.span>
            {term.reading && term.reading !== term.surface && (
              <span lang="ja" className="jp-text text-sm leading-5 text-[var(--color-text-secondary)]">{term.reading}</span>
            )}
            {term.isCommon && <Badge variant="success" size="sm">Phổ biến</Badge>}
            {matchType && (
              <span className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                {formatMatchType(matchType)}
              </span>
            )}
          </div>
          {term.romaji && (
            <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">{term.romaji}</p>
          )}
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {term.meaningsVi.slice(0, 3).join('; ') || 'Chưa có nghĩa hiển thị'}
          </p>
          {!!term.partOfSpeech.length && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {term.partOfSpeech.slice(0, 3).map((pos) => (
                <Badge key={pos} variant="default" size="sm">{formatPartOfSpeech(pos)}</Badge>
              ))}
            </div>
          )}
        </div>
        <CaretRight
          aria-hidden="true"
          className="absolute bottom-4 right-5 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-primary-600)]"
          size={20}
        />
      </Link>
      <button
        type="button"
        onClick={() => playJapaneseAudio(term.reading || term.surface)}
        title="Nghe phát âm"
        aria-label={`Nghe phát âm ${term.surface}`}
        className="tactile absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
      >
        <SpeakerHigh aria-hidden="true" size={16} />
      </button>
    </Card>
  );
}

export { formatPartOfSpeech as posLabel };
