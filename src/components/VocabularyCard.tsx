'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Furigana } from '@/components/ui/Furigana';
import type { Vocabulary } from '@/types';
import { CaretRight } from '@phosphor-icons/react';
import { motion } from 'motion/react';

interface VocabularyCardProps {
  word: Vocabulary;
  className?: string;
}

export function VocabularyCard({ word, className = '' }: VocabularyCardProps) {
  return (
    <Link href={`/word/${word.slug}`} className={`block group ${className}`}>
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <Card 
          variant="default" 
          className="cursor-pointer transition-colors duration-[--duration-fast] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface-subtle)]"
        >
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold jp-text text-[var(--color-text-primary)] kanji-glow">
                {word.surface}
              </span>
              <Furigana 
                kanji={word.surface} 
                reading={word.reading} 
                className="text-sm text-[var(--color-text-secondary)] font-medium" 
              />
              <Badge variant="jlpt" jlptLevel={word.jlpt}>
                {word.jlpt}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {word.meanings.slice(0, 3).map((meaning, idx) => (
                <span key={idx} className="text-sm text-[var(--color-text-secondary)]">
                  {idx > 0 && <span className="mx-1 opacity-50">•</span>}
                  {meaning}
                </span>
              ))}
              {word.meanings.length > 3 && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  +{word.meanings.length - 3} nghĩa khác
                </span>
              )}
            </div>
          </div>
          
          <div className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-600)] transition-colors">
            <CaretRight size={20} />
          </div>
        </div>
        </Card>
      </motion.div>
    </Link>
  );
}
