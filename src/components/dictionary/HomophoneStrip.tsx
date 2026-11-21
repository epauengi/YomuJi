'use client';

import { useState } from 'react';
import Link from 'next/link';
import { wordHref } from '@/lib/wordRoutes';
import { withSearchOrigin, type SearchOrigin } from '@/lib/dictionary/searchReturn';
import { normalizePitchAccents } from '@/lib/pitchAccent';
import type { HomophoneTerm } from '@/types/dictionary';

interface HomophoneStripProps {
  reading: string;
  currentPitches?: number[];
  homophones?: HomophoneTerm[];
  origin?: SearchOrigin;
}

const INITIAL_VISIBLE = 6;

export function HomophoneStrip({
  reading,
  currentPitches,
  homophones,
  origin,
}: HomophoneStripProps) {
  const [expanded, setExpanded] = useState(false);

  if (!reading || !homophones || homophones.length === 0) return null;

  const currentPrimary = normalizePitchAccents(currentPitches)[0];
  const visible = expanded ? homophones : homophones.slice(0, INITIAL_VISIBLE);
  const hiddenCount = homophones.length - visible.length;

  return (
    <section
      aria-label={`Từ đồng âm ${reading}`}
      className="mt-4 flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Đồng âm <span lang="ja" className="jp-text normal-case text-[var(--color-text-primary)]">「{reading}」</span>
        </span>
        {currentPrimary !== undefined && homophones.some((h) => {
          const hp = normalizePitchAccents(h.pitchAccents)[0];
          return hp !== undefined && hp !== currentPrimary;
        }) && (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            · Nhãn đỏ = khác trọng âm
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((item) => {
          const itemPitches = normalizePitchAccents(item.pitchAccents);
          const itemPrimary = itemPitches[0];
          const isDifferentPitch =
            currentPrimary !== undefined &&
            itemPrimary !== undefined &&
            itemPrimary !== currentPrimary;
          const shortGloss = item.meaningsVi[0] || '';
          const href = withSearchOrigin(wordHref(item), origin);

          return (
            <Link
              key={item.id}
              href={href}
              className="group inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-sm transition-colors hover:border-[var(--color-primary-500)] hover:bg-[var(--color-primary-50)]"
              title={`${item.surface} (${item.reading})${itemPrimary !== undefined ? ` [${itemPrimary}]` : ''}${shortGloss ? ` — ${shortGloss}` : ''}`}
            >
              <span lang="ja" className="jp-text shrink-0 font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary-700)]">
                {item.surface}
              </span>
              {itemPrimary !== undefined && (
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[11px] font-bold leading-none tabular-nums ${
                    isDifferentPitch
                      ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
                      : 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                  }`}
                >
                  [{itemPrimary}]
                </span>
              )}
              {shortGloss && (
                <span className="max-w-[140px] truncate text-xs text-[var(--color-text-muted)]">
                  {shortGloss}
                </span>
              )}
            </Link>
          );
        })}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)]"
          >
            +{hiddenCount} từ khác
          </button>
        )}
      </div>
    </section>
  );
}
