'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowCounterClockwise, Pause, Play, SkipBack, SkipForward, Star } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { StrokePath } from '@/types/dictionary';

interface StrokeAnimatorProps {
  literal: string;
  strokePaths?: StrokePath[];
  strokeSvgRaw?: string;
  strokeCount?: number;
  className?: string;
  onSaveToggle?: () => void;
  isSaved?: boolean;
}

export function StrokeAnimator({
  literal,
  strokePaths = [],
  strokeSvgRaw,
  strokeCount,
  className = '',
  onSaveToggle,
  isSaved = false,
}: StrokeAnimatorProps) {
  const totalStrokes = strokePaths.length || strokeCount || 0;
  const [currentStroke, setCurrentStroke] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setCurrentStroke(0);
    setIsPlaying(false);
  }, [literal]);

  useEffect(() => {
    if (!isPlaying || !totalStrokes) return;
    const timer = window.setInterval(() => {
      setCurrentStroke((val) => {
        if (val >= totalStrokes) {
          setIsPlaying(false);
          return val;
        }
        return val + 1;
      });
    }, 600);
    return () => window.clearInterval(timer);
  }, [isPlaying, totalStrokes]);

  const handleReset = () => {
    setCurrentStroke(0);
    setIsPlaying(false);
  };

  const handlePrev = () => {
    setCurrentStroke((v) => Math.max(0, v - 1));
  };

  const handleNext = () => {
    setCurrentStroke((v) => Math.min(totalStrokes, v + 1));
  };

  const handlePlayPause = () => {
    if (currentStroke >= totalStrokes) {
      setCurrentStroke(0);
    }
    setIsPlaying((prev) => !prev);
  };

  return (
    <Card padding="sm" className={`study-card bg-[var(--color-surface)] border-[var(--color-border)] ${className}`}>
      {/* Controls Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Lưu Kanji"
          onClick={onSaveToggle}
          className={isSaved ? 'text-amber-500' : 'text-[var(--color-text-muted)]'}
        >
          <Star size={18} weight={isSaved ? 'fill' : 'regular'} />
        </Button>
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {currentStroke} / {totalStrokes} nét
        </span>
        <Button variant="ghost" size="sm" aria-label="Vẽ lại" onClick={handleReset}>
          <ArrowCounterClockwise size={18} />
        </Button>
      </div>

      {/* SVG Canvas Box */}
      <div className="relative aspect-square w-full overflow-hidden rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
        {/* Grid Guidelines (Mễ tự cách 米) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-border)_40%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-border)_40%,transparent)_1px,transparent_1px)] bg-[length:25%_25%]" />
        <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-[var(--color-border-strong)] opacity-50" />
        <div className="absolute left-0 top-1/2 w-full border-t border-dashed border-[var(--color-border-strong)] opacity-50" />

        {strokeSvgRaw ? (
          /* animCJK Raw SVG Animation Injection */
          <div
            className="stroke-svg-container absolute inset-0 flex items-center justify-center p-3"
            dangerouslySetInnerHTML={{ __html: strokeSvgRaw }}
          />
        ) : strokePaths.length > 0 ? (
          /* KanjiVG Framer Motion Path Animation */
          <svg viewBox="0 0 109 109" className="absolute inset-0 h-full w-full p-4" aria-label={`Thứ tự nét chữ ${literal}`}>
            {strokePaths.map((stroke, index) => {
              const isFinished = index < currentStroke;
              const isCurrent = index === currentStroke - 1;
              const strokeColor = isCurrent
                ? 'var(--color-stroke-active)'
                : isFinished
                ? 'var(--color-primary-700)'
                : 'var(--color-stroke-guide)';

              return (
                <motion.path
                  key={stroke.id || index}
                  d={stroke.d}
                  fill="none"
                  stroke={strokeColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3.6"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isFinished || isCurrent ? 1 : 0.15 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                />
              );
            })}
          </svg>
        ) : (
          /* Fallback static kanji display */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <span className="jp-text text-6xl font-bold text-[var(--color-primary-800)] dark:text-[var(--color-primary-300)]">
              {literal}
            </span>
            <span className="mt-2 text-xs text-[var(--color-text-muted)]">
              Chưa có dữ liệu vẽ nét cho ký tự này
            </span>
          </div>
        )}
      </div>

      {/* Animation Playback Bar */}
      {totalStrokes > 0 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" aria-label="Nét trước" onClick={handlePrev} disabled={currentStroke === 0}>
            <SkipBack size={16} />
          </Button>
          <Button variant="primary" size="sm" aria-label={isPlaying ? 'Tạm dừng' : 'Phát nét'} onClick={handlePlayPause}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </Button>
          <Button variant="secondary" size="sm" aria-label="Nét tiếp" onClick={handleNext} disabled={currentStroke >= totalStrokes}>
            <SkipForward size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}
