'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BookmarkSimple, Star } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
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
  const [iconPulseId, setIconPulseId] = useState(0);
  const undoVersion = useRef(0);
  const observedSaved = useRef(isSaved);
  const reduceMotion = useReducedMotion();

  const itemId = item?.id;
  useEffect(() => {
    undoVersion.current += 1;
    if (!itemId) {
      observedSaved.current = isSaved;
      setSaved(isSaved);
      return;
    }
    const update = () => {
      const next = readBookmarks().some((entry) => entry.id === itemId);
      if (next !== observedSaved.current) undoVersion.current += 1;
      observedSaved.current = next;
      setSaved(next);
    };
    update();
    return subscribeToBookmarks(update);
  }, [isSaved, itemId]);

  const updateSaved = (nextState: boolean) => {
    undoVersion.current += 1;
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

    if (item && !reduceMotion) setIconPulseId((id) => id + 1);

    if (nextState) {
      const undoVersionAtSave = undoVersion.current;
      toast.success(
        item ? `Đã lưu "${item.surface}" trên thiết bị này` : 'Đã lưu trên thiết bị này',
        {
          action: {
            label: 'Hoàn tác',
            onClick: () => {
              if (undoVersion.current !== undoVersionAtSave) return;
              if (updateSaved(false) && item && !readBookmarkStorageAvailable()) {
                toast.warning('Bộ nhớ trình duyệt không khả dụng. Thay đổi chỉ giữ trong phiên này.');
              }
            },
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
  const icon = variant === 'star' ? (
    <Star aria-hidden="true" size={iconSize} weight={saved ? 'fill' : 'duotone'} />
  ) : (
    <BookmarkSimple aria-hidden="true" size={iconSize} weight={saved ? 'fill' : 'duotone'} />
  );

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
        {iconPulseId > 0 ? (
          <motion.span
            key={iconPulseId}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            onAnimationComplete={() => setIconPulseId((current) => current === iconPulseId ? 0 : current)}
          >
            {icon}
          </motion.span>
        ) : icon}
      </button>
    </div>
  );
}
