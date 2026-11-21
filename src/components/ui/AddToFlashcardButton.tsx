'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cards, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { saveDictionaryCard } from '@/lib/flashcards';

interface AddToFlashcardButtonProps {
  word: string;
  reading?: string;
  meaning: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function AddToFlashcardButton({
  word,
  reading = '',
  meaning,
  size = 'md',
  className = '',
}: AddToFlashcardButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAdd = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    setPending(true);
    try {
      const result = await saveDictionaryCard({
        word,
        reading,
        meaning: meaning.trim() || 'Chưa có nghĩa tiếng Việt',
      });
      setAdded(true);
      const openDeckAction = {
        label: 'Mở bộ thẻ',
        onClick: () => router.push(`/flashcards/deck/${encodeURIComponent(result.deckId)}`),
      };
      if (result.added) {
        toast.success(`Đã thêm vào Flashcards (${result.deckName})`, { action: openDeckAction });
      } else {
        toast.info('Từ này đã có trong Flashcards', { action: openDeckAction });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chưa thể thêm vào Flashcards.');
    } finally {
      setPending(false);
    }
  };

  const iconSize = size === 'sm' ? 16 : 18;
  const label = added ? `Đã có "${word}" trong Flashcards` : `Thêm "${word}" vào Flashcards`;

  return (
    <button
      type="button"
      onClick={(event) => void handleAdd(event)}
      disabled={pending}
      aria-label={label}
      title={added ? 'Đã có trong Flashcards' : 'Thêm vào Flashcards'}
      className={`surface-lift relative inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)] disabled:cursor-wait disabled:opacity-60 ${
        added
          ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-primary-500)] hover:text-[var(--color-primary-700)]'
      } ${className}`}
    >
      {added ? (
        <Check aria-hidden="true" size={iconSize} weight="bold" />
      ) : (
        <Cards aria-hidden="true" size={iconSize} weight="duotone" />
      )}
    </button>
  );
}
