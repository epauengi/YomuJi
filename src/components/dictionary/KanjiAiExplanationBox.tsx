'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  BookOpenText,
  Brain,
  CaretRight,
  Compass,
  Lightbulb,
  Sparkle,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { KanjiAiExplanation } from '@/app/api/ai/explain-kanji/route';

interface KanjiAiExplanationBoxProps {
  literal: string;
  explanation: KanjiAiExplanation | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

export function KanjiAiExplanationBox({
  literal,
  explanation,
  isLoading,
  error,
  onClose,
  onRetry,
}: KanjiAiExplanationBoxProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -12, height: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-[--radius-lg] border border-[var(--color-primary-300)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] md:p-6"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
            <Sparkle size={18} weight="fill" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              AI Giải thích Hán tự <span className="jp-text font-black text-[var(--color-primary-700)]">{literal}</span>
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
          aria-label="Đóng bảng giải thích"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content Body */}
      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary-700)]">
              <span className="h-2 w-2 animate-ping rounded-full bg-[var(--color-primary-600)]" />
              Đang phân tích cấu trúc và ngữ nghĩa chữ {literal}...
            </div>
            <div className="space-y-2.5">
              <div className="skeleton-quiet h-4 w-5/6 rounded-md bg-[var(--color-surface-subtle)]" />
              <div className="skeleton-quiet h-4 w-full rounded-md bg-[var(--color-surface-subtle)]" />
              <div className="skeleton-quiet h-4 w-4/6 rounded-md bg-[var(--color-surface-subtle)]" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
              <div className="skeleton-quiet h-20 rounded-[--radius-md] bg-[var(--color-surface-subtle)]" />
              <div className="skeleton-quiet h-20 rounded-[--radius-md] bg-[var(--color-surface-subtle)]" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <WarningCircle size={36} className="mb-2 text-[var(--color-error)]" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Không thể tải giải thích từ AI</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)] max-w-sm">{error}</p>
            <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
              Thử lại
            </Button>
          </div>
        ) : explanation ? (
          <div className="space-y-5 text-sm">
            {/* 1. Ý nghĩa tiếng Việt */}
            <div className="rounded-[--radius-md] bg-[var(--color-surface-subtle)] p-3.5 border border-[var(--color-border)]">
              <div className="flex items-center gap-2 font-bold text-[var(--color-primary-800)]  mb-1">
                <BookOpenText size={17} weight="duotone" />
                <span>Ý nghĩa tiếng Việt:</span>
              </div>
              <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
                {explanation.vietnameseMeaning}
              </p>
            </div>

            {/* 2. Nguồn gốc & Mẹo nhớ (Grid 2 cột) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Nguồn gốc / Chiết tự */}
              <div className="flex flex-col rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-[var(--color-hanviet-text)] mb-1.5">
                  <Compass size={17} weight="duotone" />
                  <span>Nguồn gốc & Chiết tự:</span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {explanation.etymology}
                </p>
              </div>

              {/* Mẹo nhớ */}
              <div className="flex flex-col rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-[var(--color-kunyomi-text)] mb-1.5">
                  <Lightbulb size={17} weight="duotone" />
                  <span>Mẹo nhớ nhanh:</span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {explanation.mnemonic}
                </p>
              </div>
            </div>

            {/* 3. Sắc thái & Cách dùng */}
            {explanation.nuance && (
              <div>
                <div className="flex items-center gap-1.5 font-bold text-[var(--color-text-primary)] mb-1">
                  <Brain size={17} weight="duotone" className="text-[var(--color-primary-700)]" />
                  <span>Sắc thái & Cách dùng trong tiếng Nhật:</span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {explanation.nuance}
                </p>
              </div>
            )}

            {/* 4. Từ ghép tiêu biểu */}
            {explanation.compounds && explanation.compounds.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 font-bold text-[var(--color-text-primary)] mb-2">
                  <Sparkle size={16} weight="duotone" className="text-[var(--color-primary-700)]" />
                  <span>Từ ghép tiêu biểu thường gặp:</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {explanation.compounds.map((c, idx) => (
                    <Link
                      key={`${c.word}-${idx}`}
                      href={`/word/${encodeURIComponent(c.word)}`}
                      className="group flex flex-col justify-between rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 transition-all hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)]/30"
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="jp-text text-base font-bold text-[var(--color-primary-800)]  group-hover:underline">
                          {c.word}
                        </span>
                        {c.jlpt && (
                          <Badge variant="jlpt" jlptLevel={c.jlpt as any} size="sm">
                            {c.jlpt}
                          </Badge>
                        )}
                      </div>
                      <span className="jp-text text-xs text-[var(--color-text-muted)]">{c.reading}</span>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)] line-clamp-1">{c.meaning}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
