'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowsClockwise, CheckCircle, Clock, SpeakerHigh, XCircle } from '@phosphor-icons/react';
import { demoDecks, demoWords } from '@/data/mockData';
import { playJapaneseAudio } from '@/lib/tts';

export default function ReviewPage() {
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const revealRef = useRef<HTMLButtonElement>(null);
  const incorrectRef = useRef<HTMLButtonElement>(null);
  const dueWords = demoWords.filter((word) => word.isDue);
  const currentWord = dueWords[currentIndex];
  const answered = sessionStats.correct + sessionStats.incorrect;
  const accuracy = answered ? Math.round((sessionStats.correct / answered) * 100) : 0;

  useEffect(() => {
    if (!isReviewing || isComplete) return;
    if (showAnswer) incorrectRef.current?.focus();
    else revealRef.current?.focus();
  }, [currentIndex, isComplete, isReviewing, showAnswer]);

  const startReview = () => {
    if (dueWords.length === 0) return;
    setIsReviewing(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionStats({ correct: 0, incorrect: 0 });
    setIsComplete(false);
  };

  const handleAnswer = (correct: boolean) => {
    setSessionStats((stats) => ({
      correct: stats.correct + (correct ? 1 : 0),
      incorrect: stats.incorrect + (correct ? 0 : 1),
    }));

    if (currentIndex < dueWords.length - 1) {
      setCurrentIndex((index) => index + 1);
      setShowAnswer(false);
    } else {
      setIsComplete(true);
    }
  };

  const returnToOverview = () => {
    setIsReviewing(false);
    setIsComplete(false);
    setShowAnswer(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      <header className="content-rise border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-4 flex items-center gap-3">
            <ArrowsClockwise aria-hidden="true" className="h-6 w-6 text-[var(--color-primary-600)]" />
            <h1 className="text-2xl font-bold">Ôn tập</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">Bản xem trước quy trình ôn tập ngắt quãng.</p>
          <p className="mt-1 text-sm text-[var(--color-warning-700)]">Dữ liệu và kết quả phiên không được lưu.</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <AnimatePresence mode="wait">
          {!isReviewing && !isComplete ? (
            <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="surface-lift mb-6 rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-[var(--color-warning-100)] p-2">
                    <Clock aria-hidden="true" className="h-5 w-5 text-[var(--color-warning-600)]" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{dueWords.length}</div>
                    <div className="text-sm text-[var(--color-text-muted)]">Từ mẫu cần ôn</div>
                  </div>
                </div>
              </div>

              <section className="surface-lift mb-6 rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h2 className="mb-4 font-semibold">Theo deck mẫu</h2>
                <div className="space-y-3">
                  {demoDecks.map((deck) => {
                    const count = dueWords.filter((word) => word.deck === deck.id).length;
                    if (!count) return null;
                    return (
                      <div key={deck.id} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-subtle)] p-3">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: deck.color }} />
                          <span className="font-medium">{deck.name}</span>
                        </div>
                        <span className="font-semibold text-[var(--color-warning-600)]">{count} từ</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <button
                type="button"
                onClick={startReview}
                disabled={dueWords.length === 0}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[var(--color-action-primary)] px-4 font-semibold text-white transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-subtle)] disabled:text-[var(--color-text-muted)]"
              >
                <ArrowsClockwise aria-hidden="true" className="h-5 w-5" />
                Bắt đầu phiên mẫu ({dueWords.length} từ)
              </button>
            </motion.div>
          ) : isComplete ? (
            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="py-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-success-100)]">
                <CheckCircle aria-hidden="true" className="h-10 w-10 text-[var(--color-success-600)]" weight="duotone" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">Hoàn thành phiên mẫu</h2>
              <p className="mb-6 text-[var(--color-text-secondary)]">Kết quả này chỉ tồn tại trong phiên hiện tại.</p>

              <div className="mx-auto mb-8 grid max-w-xs grid-cols-2 gap-4">
                <ResultMetric value={sessionStats.correct} label="Đúng" tone="success" />
                <ResultMetric value={sessionStats.incorrect} label="Chưa đúng" tone="error" />
              </div>
              <p className="mb-6 text-lg font-medium">Độ chính xác: {accuracy}%</p>
              <button type="button" onClick={returnToOverview} className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 hover:bg-[var(--color-surface-subtle)]">
                Quay lại
              </button>
            </motion.div>
          ) : (
            <motion.div key="reviewing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-6">
                <div className="mb-2 flex justify-between text-sm text-[var(--color-text-muted)]">
                  <span>Câu {currentIndex + 1} / {dueWords.length}</span>
                  <span>✓ {sessionStats.correct} · ✗ {sessionStats.incorrect}</span>
                </div>
                <progress aria-label="Tiến độ ôn tập mẫu" value={currentIndex + 1} max={Math.max(dueWords.length, 1)} className="h-2 w-full accent-[var(--color-primary-600)]" />
              </div>

              <section className="study-card mb-6 rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
                <div lang="ja" className="jp-text mb-4 text-4xl font-bold">{currentWord.word}</div>
                <div lang="ja" className="jp-text mb-6 text-lg text-[var(--color-text-muted)]">{currentWord.reading}</div>

                {!showAnswer ? (
                  <button ref={revealRef} type="button" onClick={() => setShowAnswer(true)} className="min-h-11 rounded-xl bg-[var(--color-action-primary)] px-6 text-white hover:bg-[var(--color-action-primary-hover)]">
                    Hiện đáp án
                  </button>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="text-2xl text-[var(--color-text-primary)]">{currentWord.meaning}</div>
                    <div className="text-sm text-[var(--color-text-muted)]">{currentWord.type}</div>
                    <button type="button" onClick={() => playJapaneseAudio(currentWord.word)} aria-label={`Nghe phát âm ${currentWord.word}`} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] hover:bg-[var(--color-primary-100)]">
                      <SpeakerHigh aria-hidden="true" className="h-6 w-6 text-[var(--color-text-muted)]" />
                    </button>
                  </motion.div>
                )}
              </section>

              {showAnswer && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
                  <button ref={incorrectRef} type="button" onClick={() => handleAnswer(false)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-error-100)] px-3 font-semibold text-[var(--color-error-700)] hover:bg-[var(--color-error-200)]">
                    <XCircle aria-hidden="true" className="h-5 w-5" />
                    Chưa đúng
                  </button>
                  <button type="button" onClick={() => handleAnswer(true)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-success-100)] px-3 font-semibold text-[var(--color-success-700)] hover:bg-[var(--color-success-200)]">
                    <CheckCircle aria-hidden="true" className="h-5 w-5" />
                    Đúng
                  </button>
                </motion.div>
              )}

              <button type="button" onClick={returnToOverview} className="mt-4 min-h-11 w-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">Thoát phiên mẫu</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ResultMetric({ value, label, tone }: { value: number; label: string; tone: 'success' | 'error' }) {
  const success = tone === 'success';
  return (
    <div className={`rounded-xl p-4 ${success ? 'bg-[var(--color-success-100)]' : 'bg-[var(--color-error-100)]'}`}>
      {success
        ? <CheckCircle aria-hidden="true" className="mx-auto mb-2 h-6 w-6 text-[var(--color-success-600)]" weight="duotone" />
        : <XCircle aria-hidden="true" className="mx-auto mb-2 h-6 w-6 text-[var(--color-error-600)]" weight="duotone" />}
      <div className={`text-2xl font-bold ${success ? 'text-[var(--color-success-700)]' : 'text-[var(--color-error-700)]'}`}>{value}</div>
      <div className={`text-sm ${success ? 'text-[var(--color-success-600)]' : 'text-[var(--color-error-600)]'}`}>{label}</div>
    </div>
  );
}
