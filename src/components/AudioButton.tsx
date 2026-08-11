'use client';

import { useEffect, useMemo, useState } from 'react';
import { SpeakerHigh, SpeakerX } from '@phosphor-icons/react';

interface AudioButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function AudioButton({ text, label = 'Nghe phát âm', className = '' }: AudioButtonProps) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  }, []);

  const cleanText = useMemo(() => text.trim(), [text]);

  const speak = () => {
    if (!supported || !cleanText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.88;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const japaneseVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('ja'));
    if (japaneseVoice) utterance.voice = japaneseVoice;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex h-10 items-center gap-2 rounded-[--radius-md] border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-text-disabled)] ${className}`}
        title="Trình duyệt hiện không hỗ trợ phát âm"
      >
        <SpeakerX size={16} />
        Không có âm thanh
      </button>
    );
  }

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
