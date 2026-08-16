'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { KanjiRecord } from '@/types/dictionary';

interface KanjiCardProps {
  kanji: KanjiRecord;
  showStrokes?: boolean;
}

export function KanjiCard({ kanji, showStrokes = true }: KanjiCardProps) {
  return (
    <Card className="content-rise border-[var(--color-border)] bg-[var(--color-surface)] shadow-none transition-all hover:border-[var(--color-primary-400)]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        {/* Left main block */}
        <div className="flex items-start gap-4">
          <Link
            href={`/kanji/${encodeURIComponent(kanji.literal)}`}
            className="flex flex-col items-center justify-center rounded-[--radius-lg] bg-[var(--color-surface-subtle)] px-5 py-4 border border-[var(--color-border)] hover:border-[var(--color-primary-500)] transition-colors"
          >
            <motion.span
              layoutId={`kanji-literal-${kanji.literal}`}
              className="jp-text text-5xl font-bold leading-none text-[var(--color-primary-800)] dark:text-[var(--color-primary-400)]"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            >
              {kanji.literal}
            </motion.span>
            <span className="mt-2 text-sm font-semibold text-[var(--color-hanviet-text)]">
              {kanji.hanViet.join(', ') || 'Không rõ'}
            </span>
          </Link>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {kanji.jlpt && (
                <Badge variant="jlpt" jlptLevel={kanji.jlpt}>
                  {kanji.jlpt}
                </Badge>
              )}
              {kanji.grade && <Badge variant="default">Lớp {kanji.grade}</Badge>}
              {kanji.strokeCount && <Badge variant="default">{kanji.strokeCount} nét</Badge>}
            </div>

            <p className="text-base font-medium text-[var(--color-text-primary)]">
              {kanji.meanings.join('; ') || 'Chưa có nghĩa tiếng Việt'}
            </p>

            {kanji.radical && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--color-radical-text)]">Bộ thủ:</span>
                <span className="rounded-[--radius-sm] bg-[var(--color-radical-bg)] px-2 py-0.5 font-medium text-[var(--color-radical-text)] border border-[var(--color-radical-border)]">
                  {kanji.radical}
                </span>
              </div>
            )}

            {kanji.penStrokes && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span className="font-medium">Thứ tự nét:</span>
                <span className="font-mono">{kanji.penStrokes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right readings block */}
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-4">
          {!!kanji.onReadings.length && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-8 font-semibold text-[var(--color-onyomi-text)]">On:</span>
              <div className="flex flex-wrap gap-1">
                {kanji.onReadings.map((r) => (
                  <span
                    key={r}
                    className="jp-text rounded bg-[var(--color-onyomi-bg)] px-1.5 py-0.5 font-medium text-[var(--color-onyomi-text)] border border-[var(--color-onyomi-border)]"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!kanji.kunReadings.length && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-8 font-semibold text-[var(--color-kunyomi-text)]">Kun:</span>
              <div className="flex flex-wrap gap-1">
                {kanji.kunReadings.map((r) => (
                  <span
                    key={r}
                    className="jp-text rounded bg-[var(--color-kunyomi-bg)] px-1.5 py-0.5 font-medium text-[var(--color-kunyomi-text)] border border-[var(--color-kunyomi-border)]"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
