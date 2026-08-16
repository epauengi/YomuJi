'use client';

import React, { useState } from 'react';
import { BookmarkSimple, Star } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
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

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const nextState = !saved;
    setSaved(nextState);
    onToggle?.(nextState);

    if (nextState) {
      // Trigger sparkle particles
      const newSparkles = Array.from({ length: 6 }).map((_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * 36,
        y: (Math.random() - 0.5) * 36,
        scale: Math.random() * 0.6 + 0.4,
      }));
      setSparkles(newSparkles);
      setTimeout(() => setSparkles([]), 600);

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
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10',
  }[size];

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  return (
    <div className="relative inline-flex items-center justify-center">
      <motion.button
        type="button"
        onClick={handleToggle}
        whileTap={{ scale: 0.8 }}
        animate={{ scale: saved ? [1, 1.25, 0.95, 1] : 1 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        className={`surface-lift relative flex items-center justify-center rounded-[--radius-md] border transition-colors ${dimClasses} ${
          saved
            ? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-400'
            : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] hover:border-amber-300/80 hover:text-amber-600'
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
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-amber-400"
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
