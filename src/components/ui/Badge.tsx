'use client';

import type { JLPTLevel } from '@/types';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'jlpt' | 'success' | 'warning' | 'error';
  jlptLevel?: JLPTLevel;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'default', 
  jlptLevel,
  size = 'md',
  className = '' 
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-[--radius-sm]';
  
  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs'
  };

  const getVariantStyles = () => {
    if (variant === 'jlpt' && jlptLevel) {
      const jlptStyles: Record<JLPTLevel, string> = {
        'N5': 'bg-[var(--color-jlpt-n5-bg)] text-[var(--color-jlpt-n5-text)]',
        'N4': 'bg-[var(--color-jlpt-n4-bg)] text-[var(--color-jlpt-n4-text)]',
        'N3': 'bg-[var(--color-jlpt-n3-bg)] text-[var(--color-jlpt-n3-text)]',
        'N2': 'bg-[var(--color-jlpt-n2-bg)] text-[var(--color-jlpt-n2-text)]',
        'N1': 'bg-[var(--color-jlpt-n1-bg)] text-[var(--color-jlpt-n1-text)]'
      };
      return jlptStyles[jlptLevel];
    }
    
    const variants: Record<string, string> = {
      default: 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]',
      success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
      warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
      error: 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
    };
    return variants[variant] || variants.default;
  };

  return (
    <span className={`${baseStyles} ${sizes[size]} ${getVariantStyles()} ${className}`}>
      {children}
    </span>
  );
}