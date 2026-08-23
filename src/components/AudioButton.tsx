'use client';

import { useMemo, useState } from 'react';
import { SpeakerHigh } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { playJapaneseAudio } from '@/lib/tts';

interface AudioButtonProps {
  text: string;
  label?: string;
  className?: string;
  voice?: string;
  rate?: string;
  variant?: 'default' | 'compact' | 'icon-only';
}

export function AudioButton({
  text,
  label = 'Nghe phát âm',
  className = '',
  voice = 'ja-JP-NanamiNeural',
  rate = '0%',
  variant = 'default',
}: AudioButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  const cleanText = useMemo(() => text.trim(), [text]);

  const speak = () => {
    if (!cleanText) return;

    playJapaneseAudio(cleanText, {
      voice,
      rate,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  if (variant === 'icon-only') {
    return (
      <button
        type="button"
        onClick={speak}
        className={`relative flex h-11 w-11 items-center justify-center rounded-[--radius-md] border transition-[background-color,border-color,color,box-shadow] duration-[--duration-fast] ${
          speaking
            ? 'border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] shadow-sm'
            : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-primary-700)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)]'
        } ${className}`}
        title="Nghe phát âm"
        aria-label={`${label}: ${cleanText}`}
      >
        {speaking ? (
          <AudioWaveformBars />
        ) : (
          <SpeakerHigh size={18} weight="duotone" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={speak}
      className={`inline-flex h-11 items-center gap-2 rounded-[--radius-md] border px-3.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-[--duration-fast] active:translate-y-px ${
        speaking
          ? 'border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-800)] shadow-sm'
          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)]'
      } ${className}`}
      aria-label={`${label}: ${cleanText}`}
    >
      {speaking ? (
        <AudioWaveformBars />
      ) : (
        <SpeakerHigh size={17} weight="duotone" className="text-[var(--color-primary-700)]" />
      )}
      <span className="font-semibold">{speaking ? 'Đang phát âm...' : label}</span>
    </button>
  );
}

export function AudioWaveformBars({ className = '' }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const animations = [
    ['4px', '14px', '6px', '12px', '4px'],
    ['8px', '4px', '16px', '6px', '8px'],
    ['14px', '6px', '12px', '4px', '14px'],
    ['6px', '12px', '4px', '14px', '6px'],
  ];
  const durations = [0.8, 0.7, 0.9, 0.75];

  return (
    <div className={`flex h-4 w-4 items-end justify-center gap-0.5 ${className}`} aria-hidden="true">
      {animations.map((heights, index) => (
        <motion.span
          key={index}
          className="w-[2.5px] rounded-full bg-[var(--color-primary-600)]"
          animate={{ height: reduceMotion ? heights[0] : heights }}
          transition={reduceMotion ? undefined : {
            duration: durations[index],
            repeat: Infinity,
            ease: 'easeInOut',
            delay: index * 0.05,
          }}
        />
      ))}
    </div>
  );
}
