'use client';

import React, { useEffect, useState } from 'react';
import { BookmarkSimple, Star } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import {
  readBookmarks,
  readBookmarkStorageAvailable,
  setBookmark,
  subscribeToBookmarks,
  type SavedBookmark,
} from '@/lib/browserState';

interface BookmarkButtonProps {
  isSaved?: boolean;
  onToggle?: (nextState: boolean) => void;
  title?: string;
  item?: SavedBookmark;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'bookmark' | 'star';
}

export function BookmarkButton({
  isSaved = false,
  onToggle,
  title = 'Lưu từ vựng',
  item,
  className = '',
  size = 'md',
  variant = 'bookmark',
}: BookmarkButtonProps) {
  const [saved, setSaved] = useState(isSaved);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; scale: number }[]>([]);
  const reduceMotion = useReducedMotion();

  const itemId = item?.id;
  useEffect(() => {
    if (!itemId) {
      setSaved(isSaved);
      return;
    }
    const update = () => setSaved(readBookmarks().some((entry) => entry.id === itemId));
    update();
    return subscribeToBookmarks(update);
  }, [isSaved, itemId]);

  const updateSaved = (nextState: boolean) => {
    try {
      if (item) setBookmark(item, nextState);
      setSaved(nextState);
      onToggle?.(nextState);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chưa thể cập nhật mục đã lưu.');
      return false;
    }
  };

  const handleToggle = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const nextState = !saved;
    if (!updateSaved(nextState)) return;
    if (item && !readBookmarkStorageAvailable()) {
      toast.warning('Bộ nhớ trình duyệt không khả dụng. Thay đổi chỉ giữ trong phiên này.');
      return;
    }

    if (nextState) {
      if (!reduceMotion) {
        const nextSparkles = Array.from({ length: 6 }).map((_, index) => ({
          id: Date.now() + index,
          x: (Math.random() - 0.5) * 36,
          y: (Math.random() - 0.5) * 36,
          scale: Math.random() * 0.6 + 0.4,
        }));
        setSparkles(nextSparkles);
        window.setTimeout(() => setSparkles([]), 600);
      }

      toast.success(
        item ? `Đã lưu "${item.surface}" trên thiết bị này` : 'Đã lưu trên thiết bị này',
        {
          action: {
            label: 'Hoàn tác',
            onClick: () => updateSaved(false),
          },
        },
      );
    } else {
      toast.info(item ? `Đã bỏ lưu "${item.surface}" trên thiết bị này` : 'Đã bỏ lưu');
    }
  };

  const dimensions = {
    sm: 'h-11 w-11',
    md: 'h-11 w-11',
    lg: 'h-12 w-12',
  }[size];
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  return (
    <div className="relative inline-flex items-center justify-center">
      <button
        type="button"
        onClick={handleToggle}
        className={`surface-lift relative flex items-center justify-center rounded-[var(--radius-md)] border transition-colors ${dimensions} ${
          saved
            ? 'border-[var(--color-warning-300)] bg-[var(--color-warning-100)] text-[var(--color-warning-700)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-warning-300)] hover:text-[var(--color-warning-700)]'
        } ${className}`}
        title={saved ? 'Bỏ lưu' : title}
        aria-label={`${saved ? 'Bỏ lưu' : title}${item ? ` ${item.surface}` : ''}`}
        aria-pressed={saved}
      >
        {variant === 'star' ? (
          <Star aria-hidden="true" size={iconSize} weight={saved ? 'fill' : 'duotone'} />
        ) : (
          <BookmarkSimple aria-hidden="true" size={iconSize} weight={saved ? 'fill' : 'duotone'} />
        )}
      </button>

      <AnimatePresence>
        {sparkles.map((sparkle) => (
          <motion.span
            key={sparkle.id}
            initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: sparkle.scale, x: sparkle.x, y: sparkle.y }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-[var(--color-warning-300)]"
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
