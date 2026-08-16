'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowsClockwise,
  ArrowSquareOut,
  Columns,
  Globe,
  Rows,
  SpeakerHigh,
} from '@phosphor-icons/react';
import { AudioButton } from '@/components/AudioButton';
import { playJapaneseAudio } from '@/lib/tts';

interface InteractiveArticleProps {
  title: string;
  extract: string;
  url: string;
  onRefresh: () => void;
  isLoading: boolean;
}

interface HoverWordInfo {
  word: string;
  x: number;
  y: number;
}

export function InteractiveJapaneseReader({
  title,
  extract,
  url,
  onRefresh,
  isLoading,
}: InteractiveArticleProps) {
  const [isVertical, setIsVertical] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<HoverWordInfo | null>(null);

  // Split text into inspectable segments (words/kanji clusters vs punctuation)
  const segments = React.useMemo(() => {
    if (!extract) return [];
    // Regex matching Japanese character clusters (Kanji, Hiragana, Katakana) or other characters
    const parts = extract.split(/([\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]{1,6}|[、。・「」\n\s])/g);
    return parts.filter(Boolean);
  }, [extract]);

  const handleWordHover = (e: React.MouseEvent<HTMLSpanElement>, text: string) => {
    const isJapaneseWord = /[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]/.test(text);
    if (!isJapaneseWord || text.length === 0) {
      setHoveredWord(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredWord({
      word: text,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  return (
    <div className="relative flex h-full flex-col justify-between">
      {/* Top Bar Header */}
      <div>
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Globe size={14} weight="duotone" />
              <span>Bài đọc Nhật ngữ</span>
            </div>
            <span className="hidden text-xs text-[var(--color-text-muted)] sm:inline">
              (Rê chuột vào từ để tra nhanh)
            </span>
          </div>

          {/* Controls: Vertical Mode Toggle & Refresh */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsVertical(!isVertical)}
              className={`tactile flex h-8 items-center gap-1 rounded-[--radius-md] border px-2.5 text-xs font-semibold transition-colors ${
                isVertical
                  ? 'border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-300'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
              title={isVertical ? 'Chuyển sang chế độ đọc ngang' : 'Chuyển sang chế độ đọc dọc kiểu Nhật (縦書き)'}
            >
              {isVertical ? <Rows size={15} /> : <Columns size={15} />}
              <span>{isVertical ? 'Đọc ngang' : 'Đọc dọc (縦書き)'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3 py-4">
              <div className="skeleton-quiet h-7 w-2/5 rounded bg-[var(--color-surface-subtle)]" />
              <div className="skeleton-quiet h-4 w-full rounded bg-[var(--color-surface-subtle)]" />
              <div className="skeleton-quiet h-4 w-11/12 rounded bg-[var(--color-surface-subtle)]" />
              <div className="skeleton-quiet h-4 w-4/5 rounded bg-[var(--color-surface-subtle)]" />
            </div>
          ) : (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="jp-text text-2xl font-extrabold text-[var(--color-text-primary)]">
                  {title}
                </h3>
                <AudioButton text={title} label="Phát âm tiêu đề" variant="icon-only" />
              </div>

              {/* Japanese Text Rendering with Vertical or Horizontal Mode */}
              <div
                className={`mt-3 font-ja text-base leading-relaxed text-[var(--color-text-secondary)] transition-all duration-300 ${
                  isVertical
                    ? 'h-52 overflow-x-auto whitespace-pre-wrap py-2 [writing-mode:vertical-rl] leading-loose text-lg tracking-wider border-l border-[var(--color-border-subtle)] pl-4'
                    : 'line-clamp-6 text-sm sm:text-base leading-7'
                }`}
                onMouseLeave={() => setHoveredWord(null)}
              >
                {segments.map((seg, idx) => {
                  const isJp = /[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]/.test(seg);
                  if (!isJp) return <span key={idx}>{seg}</span>;

                  return (
                    <span
                      key={idx}
                      onMouseEnter={(e) => handleWordHover(e, seg)}
                      className="cursor-pointer rounded-[3px] transition-colors duration-150 hover:bg-teal-100 dark:hover:bg-teal-900/60 hover:text-teal-900 dark:hover:text-teal-200 hover:underline decoration-teal-500 underline-offset-4"
                    >
                      {seg}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Hover Inspector Popover */}
      <AnimatePresence>
        {hoveredWord && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: hoveredWord.x,
              top: hoveredWord.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 100,
            }}
            className="pointer-events-auto rounded-[--radius-lg] border border-teal-500/40 bg-[var(--color-surface)] p-2.5 shadow-xl backdrop-blur-md min-w-[150px] max-w-[240px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="jp-text text-lg font-bold text-[var(--color-primary-800)] dark:text-[var(--color-primary-300)]">
                {hoveredWord.word}
              </span>
              <button
                type="button"
                onClick={() => playJapaneseAudio(hoveredWord.word)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                title="Nghe phát âm"
              >
                <SpeakerHigh size={13} weight="bold" />
              </button>
            </div>

            <div className="mt-1 flex items-center gap-2 pt-1 border-t border-[var(--color-border-subtle)] text-[11px]">
              <Link
                href={`/?q=${encodeURIComponent(hoveredWord.word)}`}
                className="font-bold text-teal-700 dark:text-teal-400 hover:underline"
              >
                Tra từ này →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Footer Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-3 text-xs font-bold">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="tactile inline-flex items-center gap-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-700)] disabled:opacity-50"
        >
          <ArrowsClockwise size={14} className={isLoading ? 'animate-spin' : ''} />
          Đọc bài khác
        </button>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Đọc trên Wikipedia
            <ArrowSquareOut size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
