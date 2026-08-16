'use client';

import { useMemo, useState } from 'react';
import { SpeakerHigh } from '@phosphor-icons/react';
import { motion } from 'motion/react';
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
        className={`relative flex h-9 w-9 items-center justify-center rounded-[--radius-md] border transition-all duration-200 ${
          speaking
            ? 'border-teal-400 bg-teal-50/80 text-teal-700 shadow-sm ring-2 ring-teal-400/30'
            : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-primary-700)] hover:border-teal-400/60 hover:bg-[var(--color-primary-50)]'
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
      className={`inline-flex h-10 items-center gap-2 rounded-[--radius-md] border px-3.5 text-sm font-medium transition-all duration-200 active:translate-y-px ${
        speaking
          ? 'border-teal-400 bg-teal-50/80 text-teal-800 shadow-sm ring-2 ring-teal-400/20'
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
  return (
    <div className={`flex items-end justify-center gap-0.5 h-4 w-4 ${className}`} aria-hidden="true">
      <motion.span
        className="w-[2.5px] rounded-full bg-teal-600 dark:bg-teal-400"
        animate={{ height: ['4px', '14px', '6px', '12px', '4px'] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="w-[2.5px] rounded-full bg-teal-600 dark:bg-teal-400"
        animate={{ height: ['8px', '4px', '16px', '6px', '8px'] }}
        transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
      />
      <motion.span
        className="w-[2.5px] rounded-full bg-teal-600 dark:bg-teal-400"
        animate={{ height: ['14px', '6px', '12px', '4px', '14px'] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      />
      <motion.span
        className="w-[2.5px] rounded-full bg-teal-600 dark:bg-teal-400"
        animate={{ height: ['6px', '12px', '4px', '14px', '6px'] }}
        transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
      />
    </div>
  );
}
