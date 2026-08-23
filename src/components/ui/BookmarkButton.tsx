'use client';

import React, { useState } from 'react';
import { BookmarkSimple, Star } from '@phosphor-icons/react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';

interface BookmarkButtonProps {
  isSaved?: boolean;
  onToggle?: (nextState: boolean) => void;
  title?: string;
  word?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'bookmark' | 'star';
}

export function BookmarkButton({
  isSaved = false,
  onToggle,
  title = 'Lưu từ vựng',
  word,
  className = '',
  size = 'md',
  variant = 'bookmark',
}: BookmarkButtonProps) {
  const [saved, setSaved] = useState(isSaved);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; scale: number }[]>([]);
  const reduceMotion = useReducedMotion();

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const nextState = !saved;
    setSaved(nextState);
    onToggle?.(nextState);

    if (nextState) {
      if (!reduceMotion) {
        const newSparkles = Array.from({ length: 6 }).map((_, i) => ({
          id: Date.now() + i,
          x: (Math.random() - 0.5) * 36,
          y: (Math.random() - 0.5) * 36,
          scale: Math.random() * 0.6 + 0.4,
        }));
        setSparkles(newSparkles);
        setTimeout(() => setSparkles([]), 600);
      }

      toast.success(word ? `Đã lưu "${word}" vào Sổ tay` : 'Đã lưu vào danh sách học', {
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            setSaved(false);
            onToggle?.(false);
          },
        },
      });
    } else {
      toast.info(word ? `Đã bỏ lưu "${word}"` : 'Đã bỏ lưu');
    }
  };

  const dimClasses = {
    sm: 'h-11 w-11',
    md: 'h-11 w-11',
    lg: 'h-12 w-12',
  }[size];

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  return (
    <div className="relative inline-flex items-center justify-center">
      <motion.button
        type="button"
        onClick={handleToggle}
        whileTap={reduceMotion ? undefined : { scale: 0.9 }}
        animate={{ scale: saved && !reduceMotion ? [1, 1.15, 0.98, 1] : 1 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        className={`surface-lift relative flex items-center justify-center rounded-[--radius-md] border transition-colors ${dimClasses} ${
          saved
            ? 'border-[var(--color-warning-300)] bg-[var(--color-warning-100)] text-[var(--color-warning-700)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-warning-300)] hover:text-[var(--color-warning-700)]'
        } ${className}`}
        title={saved ? 'Đã lưu' : title}
        aria-label={saved ? 'Đã lưu' : title}
      >
        {variant === 'star' ? (
          <Star size={iconSize} weight={saved ? 'fill' : 'duotone'} />
        ) : (
          <BookmarkSimple size={iconSize} weight={saved ? 'fill' : 'duotone'} />
        )}
      </motion.button>

      {/* Sparkle Burst Animation */}
      <AnimatePresence>
        {sparkles.map((s) => (
          <motion.span
            key={s.id}
            initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: s.scale, x: s.x, y: s.y }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-[var(--color-warning-300)]"
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
