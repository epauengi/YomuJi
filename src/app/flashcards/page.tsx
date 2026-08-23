'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  BookBookmark,
  CaretRight,
  Clock,
  Plus,
  Target,
} from '@phosphor-icons/react';
import { mockDecks, mockSavedWords } from '@/data/mockData';

export default function FlashcardsPage() {
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);

  // Calculate stats
  const totalCards = mockDecks.reduce((sum, deck) => sum + deck.cardCount, 0);
  const totalDue = mockDecks.reduce((sum, deck) => sum + deck.dueCount, 0);
  const totalMastered = mockDecks.reduce((sum, deck) => sum + deck.masteredCount, 0);

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      {/* Header */}
      <div className="content-rise bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BookBookmark className="h-6 w-6 text-[var(--color-primary-600)]" />
              <h1 className="text-2xl font-bold">Flashcards</h1>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-600)] text-white rounded-lg hover:bg-[var(--color-primary-700)] transition-colors">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Tạo Deck</span>
            </button>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Học và ôn tập từ vựng với flashcards
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="surface-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-primary-100)]  rounded-lg">
                <BookBookmark className="h-5 w-5 text-[var(--color-primary-600)]" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalCards}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Tổng thẻ</div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="surface-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-warning-100)]  rounded-lg">
                <Clock className="h-5 w-5 text-[var(--color-warning-600)]" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalDue}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Cần ôn</div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="surface-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-success-100)] rounded-lg">
                <Target className="h-5 w-5 text-[var(--color-success-600)]" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalMastered}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Đã thuộc</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Decks List */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Danh sách Deck</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockDecks.map((deck, index) => (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/flashcards/deck/${deck.id}`}>
                  <div className="surface-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-5 hover:border-[var(--color-primary-300)] cursor-pointer h-full">
                    {/* Deck Color Bar */}
                    <div 
                      className="h-2 rounded-full mb-4"
                      style={{ backgroundColor: deck.color }}
                    />
                    
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-lg">{deck.name}</h3>
                      <CaretRight className="h-5 w-5 text-[var(--color-text-muted)]" />
                    </div>
                    
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">
                      {deck.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                        <span>Tiến độ</span>
                        <span>{Math.round((deck.masteredCount / deck.cardCount) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-subtle)] rounded-full overflow-hidden" aria-label={`Progress ${Math.round((deck.masteredCount / deck.cardCount) * 100)} percent`}>
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${(deck.masteredCount / deck.cardCount) * 100}%`,
                            backgroundColor: deck.color
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                        <BookBookmark className="h-4 w-4" />
                        <span>{deck.cardCount} thẻ</span>
                      </div>
                      {deck.dueCount > 0 && (
                        <div className="flex items-center gap-1 text-[var(--color-warning-600)]">
                          <Clock className="h-4 w-4" />
                          <span>{deck.dueCount} cần ôn</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recent Words */}
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Từ đã lưu gần đây</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockSavedWords.slice(0, 4).map((word, index) => (
              <motion.div
                key={word.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/word/${word.id}`}>
                  <div className="surface-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-4 hover:border-[var(--color-primary-300)] cursor-pointer">
                    <div className="font-ja text-xl font-medium mb-1">{word.word}</div>
                    <div className="text-sm text-[var(--color-text-muted)] mb-2">{word.reading}</div>
                    <div className="text-sm text-[var(--color-text-secondary)] line-clamp-1">{word.meaning}</div>
                    {word.dueCount > 0 && (
                      <div className="mt-2 text-xs text-[var(--color-warning-600)]">
                        {word.dueCount} thẻ cần ôn
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
