'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  CaretRight,
  Check,
  Play,
  SpeakerHigh,
  X,
} from '@phosphor-icons/react';
import { mockDecks, mockSavedWords } from '@/data/mockData';
import { playJapaneseAudio } from '@/lib/tts';

export default function DeckDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [isStudying, setIsStudying] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [studiedCards, setStudiedCards] = useState<number[]>([]);

  const deck = mockDecks.find(d => d.id === slug);
  const deckWords = mockSavedWords.filter(w => w.deck === slug);

  if (!deck) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Deck không tìm thấy</h1>
          <Link href="/flashcards" className="text-[var(--color-primary-600)] hover:underline">
            Quay lại danh sách decks
          </Link>
        </div>
      </div>
    );
  }

  const startStudy = () => {
    setIsStudying(true);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowAnswer(false);
    setStudiedCards([]);
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
    setShowAnswer(true);
  };

  const handleAnswer = (correct: boolean) => {
    if (correct) {
      setStudiedCards(prev => [...prev, currentCardIndex]);
    }
    
    if (currentCardIndex < deckWords.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
      setShowAnswer(false);
    } else {
      setIsStudying(false);
    }
  };

  const currentCard = deckWords[currentCardIndex];

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      {/* Header */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/flashcards"
              className="p-2 rounded-lg hover:bg-[var(--color-surface-subtle)] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{deck.name}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {deckWords.length} thẻ trong deck
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isStudying ? (
          <motion.div
            key="deck-info"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto px-4 py-6"
          >
            {/* Deck Info Card */}
            <div 
              className="rounded-2xl p-6 mb-6 relative overflow-hidden"
              style={{ backgroundColor: deck.color + '20' }}
            >
              <div 
                className="absolute top-0 left-0 w-full h-2"
                style={{ backgroundColor: deck.color }}
              />
              <h2 className="text-2xl font-bold mb-2">{deck.name}</h2>
              <p className="text-[var(--color-text-secondary)] mb-6">{deck.description}</p>
              
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span>Tiến độ học tập</span>
                  <span className="font-medium">{Math.round((deck.masteredCount / deck.cardCount) * 100)}%</span>
                </div>
                <div className="h-3 bg-white/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full"
                    style={{ 
                      width: `${(deck.masteredCount / deck.cardCount) * 100}%`,
                      backgroundColor: deck.color
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{deck.cardCount}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">Tổng thẻ</div>
                </div>
                <div className="bg-white/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[var(--color-warning-600)]">{deck.dueCount}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">Cần ôn</div>
                </div>
                <div className="bg-white/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[var(--color-success-600)]">{deck.masteredCount}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">Đã thuộc</div>
                </div>
              </div>
            </div>

            {/* Start Study Button */}
            <button
              onClick={startStudy}
              className="w-full flex items-center justify-center gap-3 py-4 bg-[var(--color-primary-600)] text-white rounded-xl hover:bg-[var(--color-primary-700)] transition-colors mb-6"
            >
              <Play className="h-5 w-5" />
              <span className="font-semibold">Bắt đầu học</span>
            </button>

            {/* Word List */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Danh sách từ ({deckWords.length})</h3>
              <div className="space-y-3">
                {deckWords.map((word, index) => (
                  <motion.div
                    key={word.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link href={`/word/${word.id}`}>
                      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary-300)] transition-all cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-ja text-lg font-medium">{word.word}</span>
                              <span className="text-sm text-[var(--color-text-muted)]">{word.reading}</span>
                            </div>
                            <div className="text-sm text-[var(--color-text-secondary)] mt-1">{word.meaning}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {word.dueCount > 0 && (
                              <span className="px-2 py-1 bg-[var(--color-warning-100)] text-[var(--color-warning-700)] text-xs rounded-full">
                                {word.dueCount} cần ôn
                              </span>
                            )}
                            <CaretRight className="h-5 w-5 text-[var(--color-text-muted)]" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="study-mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto px-4 py-6"
          >
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-[var(--color-text-muted)] mb-2">
                <span>Thẻ {currentCardIndex + 1} / {deckWords.length}</span>
                <span>{Math.round(((currentCardIndex + 1) / deckWords.length) * 100)}%</span>
              </div>
              <div className="h-2 bg-[var(--color-surface-subtle)] rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-[var(--color-primary-600)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentCardIndex + 1) / deckWords.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Flashcard */}
            <div 
              className="min-h-[400px] flex items-center justify-center mb-6 cursor-pointer"
              onClick={flipCard}
            >
              <motion.div
                className="w-full max-w-lg"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.5 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div 
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 text-center"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="text-sm text-[var(--color-text-muted)] mb-4">Nhấn để xem đáp án</div>
                  <div className="font-ja text-4xl font-bold mb-4">{currentCard?.word}</div>
                  <div className="text-lg text-[var(--color-text-muted)]">{currentCard?.reading}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playJapaneseAudio(currentCard?.word || '');
                    }}
                    title="Nghe phát âm"
                    className="mt-6 p-3 rounded-full bg-[var(--color-surface-subtle)] hover:bg-[var(--color-primary-100)] transition-colors"
                  >
                    <SpeakerHigh className="h-6 w-6 text-[var(--color-text-muted)]" />
                  </button>
                </div>

                <div 
                  className="absolute inset-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 text-center"
                  style={{ 
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <div className="text-sm text-[var(--color-text-muted)] mb-4">Đáp án</div>
                  <div className="font-ja text-4xl font-bold mb-4">{currentCard?.word}</div>
                  <div className="text-lg text-[var(--color-text-muted)] mb-4">{currentCard?.reading}</div>
                  <div className="text-xl text-[var(--color-text-primary)]">{currentCard?.meaning}</div>
                  <div className="text-sm text-[var(--color-text-muted)] mt-2">{currentCard?.type}</div>
                </div>
              </motion.div>
            </div>

            {/* Answer Buttons */}
            {showAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <button
                  onClick={() => handleAnswer(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-[var(--color-error-100)] text-[var(--color-error-700)] rounded-xl hover:bg-[var(--color-error-200)] transition-colors"
                >
                  <X className="h-5 w-5" />
                  <span className="font-semibold">Chưa nhớ</span>
                </button>
                <button
                  onClick={() => handleAnswer(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-[var(--color-success-100)] text-[var(--color-success-700)] rounded-xl hover:bg-[var(--color-success-200)] transition-colors"
                >
                  <Check className="h-5 w-5" />
                  <span className="font-semibold">Nhớ rồi</span>
                </button>
              </motion.div>
            )}

            {/* Exit Button */}
            <button
              onClick={() => setIsStudying(false)}
              className="w-full mt-4 py-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Thoát chế độ học
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
