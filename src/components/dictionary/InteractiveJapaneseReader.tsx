'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowSquareOut,
  BookOpenText,
  Columns,
  Rows,
  SpeakerHigh,
} from '@phosphor-icons/react';
import { AudioWaveformBars } from '@/components/AudioButton';
import { playJapaneseAudio, stopCurrentAudio } from '@/lib/tts';

interface InteractiveArticleProps {
  title: string;
  extract: string;
  url: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export function InteractiveJapaneseReader({
  title,
  extract,
  url,
  onRefresh,
  isLoading,
}: InteractiveArticleProps) {
  const [isVertical, setIsVertical] = useState(false);
  const [isPlayingFull, setIsPlayingFull] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop audio if article changes or unmounts
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      stopCurrentAudio();
    };
  }, [title]);

  const handleTogglePlayFull = () => {
    if (isPlayingFull) {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      stopCurrentAudio();
      setIsPlayingFull(false);
      return;
    }

    if (!title && !extract) return;

    setIsPlayingFull(true);

    // Step 1: Play title first
    playJapaneseAudio(title, {
      onStart: () => setIsPlayingFull(true),
      onEnd: () => {
        // Step 2: Pause 1.2s then play extract
        if (!extract.trim()) {
          setIsPlayingFull(false);
          return;
        }

        pauseTimerRef.current = setTimeout(() => {
          playJapaneseAudio(extract, {
            onStart: () => setIsPlayingFull(true),
            onEnd: () => setIsPlayingFull(false),
            onError: () => setIsPlayingFull(false),
          });
        }, 1200);
      },
      onError: () => setIsPlayingFull(false),
    });
  };

  return (
    <div className="relative flex h-full flex-col justify-between">
      {/* Top Bar Header */}
      <div>
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-100)] px-3.5 py-1 text-xs font-extrabold text-[var(--color-primary-800)]">
              <BookOpenText size={15} weight="duotone" className="text-[var(--color-primary-700)]" />
              <span>Bài đọc hôm nay</span>
            </div>
          </div>

          {/* Controls: Vertical Mode Toggle */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsVertical(!isVertical)}
              className={`tactile flex min-h-11 items-center gap-1 rounded-[--radius-md] border px-2.5 text-xs font-semibold transition-colors ${
                isVertical
                  ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
              aria-pressed={isVertical}
              title={isVertical ? 'Chuyển sang chế độ đọc ngang' : 'Chuyển sang chế độ đọc dọc kiểu Nhật (縦書き)'}
            >
              {isVertical ? <Rows size={15} /> : <Columns size={15} />}
              <span>{isVertical ? 'Đọc ngang' : 'Đọc dọc'}</span>
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
                <h3 lang="ja" className="jp-text text-2xl font-extrabold text-[var(--color-text-primary)]">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={handleTogglePlayFull}
                  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius-md] border transition-[background-color,border-color,color] duration-[--duration-fast] ${
                    isPlayingFull
                      ? 'border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-primary-700)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)]'
                  }`}
                  title={isPlayingFull ? 'Dừng phát âm' : 'Phát toàn bộ bài đọc'}
                  aria-label={isPlayingFull ? 'Dừng phát âm' : 'Phát toàn bộ bài đọc'}
                  aria-pressed={isPlayingFull}
                >
                  {isPlayingFull ? (
                    <AudioWaveformBars />
                  ) : (
                    <SpeakerHigh size={18} weight="duotone" />
                  )}
                </button>
              </div>

              {/* Japanese Text Rendering with Vertical (Upright Digits) or Horizontal Mode */}
              <div
                lang="ja"
                className={`mt-3 font-ja text-base leading-relaxed text-[var(--color-text-secondary)] transition-all duration-300 ${
                  isVertical
                    ? 'h-52 overflow-x-auto whitespace-pre-wrap py-2 [writing-mode:vertical-rl] [text-orientation:upright] leading-loose text-lg tracking-wider border-l border-[var(--color-border-subtle)] pl-4'
                    : 'line-clamp-6 text-sm sm:text-base leading-7'
                }`}
              >
                {extract}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-3 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
            stopCurrentAudio();
            setIsPlayingFull(false);
            onRefresh();
          }}
          disabled={isLoading}
          className="tactile inline-flex min-h-11 items-center gap-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-700)] disabled:opacity-50"
        >
          <ArrowsClockwise size={14} className={isLoading ? 'animate-spin' : ''} />
          Đọc bài khác
        </button>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-link)] transition-colors hover:text-[var(--color-link-hover)]"
          >
            Đọc trên Wikipedia
            <ArrowSquareOut size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

