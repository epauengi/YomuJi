'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CaretRight, ChartBar, SpeakerHigh } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { playJapaneseAudio } from '@/lib/tts';
import type { TermRecord } from '@/types/dictionary';

const POS_LABELS: Record<string, string> = {
  n: 'Danh từ',
  'n-adv': 'Danh từ/trạng từ',
  'n-suf': 'Hậu tố',
  v1: 'Động từ ichidan',
  vs: 'Động từ suru',
  vk: 'Động từ kuru',
  'adj-i': 'Tính từ i',
  'adj-na': 'Tính từ na',
  adv: 'Trạng từ',
  prt: 'Trợ từ',
  conj: 'Liên từ',
  exp: 'Cụm từ',
  pn: 'Đại từ',
};

function posLabel(code: string) {
  if (POS_LABELS[code]) return POS_LABELS[code];
  if (code.startsWith('v5')) return 'Động từ godan';
  return code;
}

export function TermCard({ term }: { term: TermRecord }) {
  const confidence = term.isCommon ? '88%' : term.romaji ? '64%' : '52%';

  return (
    <Link href={`/word/${encodeURIComponent(term.id)}`} className="group block h-full">
      <Card
        variant="default"
        className="surface-lift h-full border-[var(--color-border)] shadow-none hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface)]"
      >
        <div className="flex h-full items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <motion.span
                layoutId={`term-surface-${term.id}`}
                className="jp-text text-xl font-semibold leading-7 text-[var(--color-text-primary)]"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              >
                {term.surface}
              </motion.span>
              {term.reading && term.reading !== term.surface && (
                <span className="jp-text text-sm leading-5 text-[var(--color-text-secondary)]">{term.reading}</span>
              )}
              {term.isCommon && <Badge variant="success" size="sm">Phổ biến</Badge>}
            </div>
            {term.romaji && (
              <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">{term.romaji}</p>
            )}
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              {term.meaningsVi.slice(0, 3).join('; ') || 'Chưa có nghĩa hiển thị'}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <ChartBar size={14} className="text-[var(--color-primary-700)]" />
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div className="confidence-track h-full rounded-full" style={{ '--confidence': confidence } as CSSProperties} />
              </div>
              <span>{term.isCommon ? 'common' : 'match'}</span>
            </div>
            {!!term.partOfSpeech.length && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {term.partOfSpeech.slice(0, 3).map((pos) => (
                  <Badge key={pos} variant="default" size="sm">{posLabel(pos)}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playJapaneseAudio(term.reading || term.surface);
              }}
              title="Nghe phát âm"
              aria-label={`Nghe phát âm ${term.surface}`}
              className="tactile flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
            >
              <SpeakerHigh size={16} />
            </button>
            <CaretRight className="text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-primary-600)]" size={20} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

export { posLabel };
