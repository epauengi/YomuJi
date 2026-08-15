'use client';

import { useMemo, useState } from 'react';
import { SpeakerHigh } from '@phosphor-icons/react';
import { playJapaneseAudio } from '@/lib/tts';

interface AudioButtonProps {
  text: string;
  label?: string;
  className?: string;
  voice?: string;
  rate?: string;
}

export function AudioButton({
  text,
  label = 'Nghe phát âm',
  className = '',
  voice = 'ja-JP-NanamiNeural',
  rate = '0%',
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

  return (
    <button
      type="button"
      onClick={speak}
      className={`inline-flex h-10 items-center gap-2 rounded-[--radius-md] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-[border-color,color,transform] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)] active:translate-y-px ${className}`}
      aria-label={`${label}: ${cleanText}`}
    >
      <SpeakerHigh size={16} weight={speaking ? 'fill' : 'regular'} className={speaking ? 'text-[var(--color-primary-700)]' : undefined} />
      {speaking ? 'Đang phát' : label}
    </button>
  );
}
