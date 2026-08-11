'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  Flame,
  SpeakerHigh,
  Target,
  XCircle,
} from '@phosphor-icons/react';
import { mockSavedWords, mockDecks } from '@/data/mockData';

export default function ReviewPage() {
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
  const [isComplete, setIsComplete] = useState(false);

  // Get words due for review
  const dueWords = mockSavedWords.filter(w => w.dueCount > 0);
  const currentWord = dueWords[currentIndex];

  const startReview = () => {
    setIsReviewing(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionStats({ correct: 0, incorrect: 0 });
    setIsComplete(false);
  };

  const handleAnswer = (correct: boolean) => {
    if (correct) {
      setSessionStats(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setSessionStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }

    if (currentIndex < dueWords.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setIsComplete(true);
    }
  };

  const totalDue = mockDecks.reduce((sum, deck) => sum + deck.dueCount, 0);
  const streakDays = 7; // Mock streak

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      {/* Header */}
      <div className="content-rise bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <ArrowsClockwise className="h-6 w-6 text-[var(--color-primary-600)]" />
            <h1 className="text-2xl font-bold">Ôn tập</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Ôn tập từ vựng đã học với spaced repetition
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {!isReviewing && !isComplete ? (
            <motion.div
              key="start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Stats Overview */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="surface-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-[var(--color-warning-100)] dark:bg-[var(--color-warning-900)] rounded-lg">
                      <Clock className="h-5 w-5 text-[var(--color-warning-600)]" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold">{totalDue}</div>
                      <div className="text-sm text-[var(--color-text-muted)]">Từ cần ôn</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="surface-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-[var(--color-error-100)] dark:bg-[var(--color-error-900)] rounded-lg">
                      <Flame className="h-5 w-5 text-[var(--color-error-600)]" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold">{streakDays}</div>
                      <div className="text-sm text-[var(--color-text-muted)]">Ngày liên tiếp</div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Due by Deck */}
              <div className="surface-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-5 mb-6">
                <h3 className="font-semibold mb-4">Từ cần ôn theo deck</h3>
                <div className="space-y-3">
                  {mockDecks.filter(deck => deck.dueCount > 0).map((deck) => (
                    <div 
                      key={deck.id}
                      className="flex items-center justify-between p-3 bg-[var(--color-surface-subtle)] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: deck.color }}
                        />
                        <span className="font-medium">{deck.name}</span>
                      </div>
                      <span className="text-[var(--color-warning-600)] font-semibold">
                        {deck.dueCount} từ
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={startReview}
                disabled={dueWords.length === 0}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold transition-colors ${
                  dueWords.length > 0
                    ? 'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]'
                    : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] cursor-not-allowed'
                }`}
              >
                <ArrowsClockwise className="h-5 w-5" />
                <span>Bắt đầu ôn tập ({dueWords.length} từ)</span>
              </button>

              {dueWords.length === 0 && (
                <p className="text-center text-[var(--color-text-muted)] mt-4">
                  Không có từ nào cần ôn tập. Hãy học thêm từ mới!
                </p>
              )}
            </motion.div>
          ) : isComplete ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 mx-auto mb-6 bg-[var(--color-success-100)] dark:bg-[var(--color-success-900)] rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-[var(--color-success-600)]" weight="duotone" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Hoàn thành!</h2>
              <p className="text-[var(--color-text-secondary)] mb-6">
                Bạn đã ôn tập {dueWords.length} từ
              </p>

              {/* Session Stats */}
              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8">
                <div className="bg-[var(--color-success-100)] dark:bg-[var(--color-success-900)] rounded-xl p-4">
                  <CheckCircle className="mx-auto mb-2 h-6 w-6 text-[var(--color-success-600)]" weight="duotone" />
                  <div className="text-2xl font-bold text-[var(--color-success-700)]">
                    {sessionStats.correct}
                  </div>
                  <div className="text-sm text-[var(--color-success-600)]">Đúng</div>
                </div>
                <div className="bg-[var(--color-error-100)] dark:bg-[var(--color-error-900)] rounded-xl p-4">
                  <XCircle className="mx-auto mb-2 h-6 w-6 text-[var(--color-error-600)]" weight="duotone" />
                  <div className="text-2xl font-bold text-[var(--color-error-700)]">
                    {sessionStats.incorrect}
                  </div>
                  <div className="text-sm text-[var(--color-error-600)]">Sai</div>
                </div>
              </div>

              <div className="text-lg font-medium mb-6">
                Độ chính xác: {Math.round((sessionStats.correct / dueWords.length) * 100)}%
              </div>

              <button
                onClick={() => setIsReviewing(false)}
                className="px-6 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-surface-subtle)] transition-colors"
              >
                Quay lại
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="reviewing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-[var(--color-text-muted)] mb-2">
                  <span>Câu {currentIndex + 1} / {dueWords.length}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[var(--color-success-600)]">
                      ✓ {sessionStats.correct}
                    </span>
                    <span className="text-[var(--color-error-600)]">
                      ✗ {sessionStats.incorrect}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-[var(--color-surface-subtle)] rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-[var(--color-primary-600)] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex + 1) / dueWords.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div className="study-card bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[--radius-lg] p-8 mb-6">
                <div className="text-center">
                  <div className="font-ja text-4xl font-bold mb-4">{currentWord?.word}</div>
                  <div className="text-lg text-[var(--color-text-muted)] mb-6">{currentWord?.reading}</div>
                  
                  {!showAnswer ? (
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="px-6 py-3 bg-[var(--color-primary-600)] text-white rounded-xl hover:bg-[var(--color-primary-700)] transition-colors"
                    >
                      Hiện đáp án
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="text-2xl text-[var(--color-text-primary)]">
                        {currentWord?.meaning}
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        {currentWord?.type}
                      </div>
                      <button className="p-3 rounded-full bg-[var(--color-surface-subtle)] hover:bg-[var(--color-primary-100)] transition-colors">
                        <SpeakerHigh className="h-6 w-6 text-[var(--color-text-muted)]" />
                      </button>
                    </motion.div>
                  )}
                </div>
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
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-[var(--color-error-100)] dark:bg-[var(--color-error-900)] text-[var(--color-error-700)] dark:text-[var(--color-error-300)] rounded-xl hover:bg-[var(--color-error-200)] dark:hover:bg-[var(--color-error-800)] transition-colors"
                  >
                    <XCircle className="h-5 w-5" />
                    <span className="font-semibold">Chưa nhớ</span>
                  </button>
                  <button
                    onClick={() => handleAnswer(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-[var(--color-success-100)] dark:bg-[var(--color-success-900)] text-[var(--color-success-700)] dark:text-[var(--color-success-300)] rounded-xl hover:bg-[var(--color-success-200)] dark:hover:bg-[var(--color-success-800)] transition-colors"
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Nhớ rồi</span>
                  </button>
                </motion.div>
              )}

              {/* Exit Button */}
              <button
                onClick={() => setIsReviewing(false)}
                className="w-full mt-4 py-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Thoát ôn tập
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
