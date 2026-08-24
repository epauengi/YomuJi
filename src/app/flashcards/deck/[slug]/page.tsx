'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, CaretRight, Check, Play, SpeakerHigh, X } from '@phosphor-icons/react';
import { demoDecks, demoWords } from '@/data/mockData';
import { playJapaneseAudio } from '@/lib/tts';

export default function DeckDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [isStudying, setIsStudying] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const frontRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const incorrectRef = useRef<HTMLButtonElement>(null);

  const deck = demoDecks.find((item) => item.id === slug);
  const deckWords = demoWords.filter((word) => word.deck === slug);
  const dueCount = deckWords.filter((word) => word.isDue).length;
  const currentCard = deckWords[currentCardIndex];

  useEffect(() => {
    if (!isStudying || isComplete) return;
    if (isFlipped) incorrectRef.current?.focus();
    else frontRef.current?.focus();
  }, [currentCardIndex, isComplete, isFlipped, isStudying]);

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Không tìm thấy deck</h1>
          <Link href="/flashcards" className="inline-flex min-h-11 items-center text-[var(--color-primary-700)] hover:underline">
            Quay lại danh sách deck
          </Link>
        </div>
      </div>
    );
  }

  const startStudy = () => {
    if (deckWords.length === 0) return;
    setIsStudying(true);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsComplete(false);
  };

  const handleAnswer = () => {
    if (currentCardIndex < deckWords.length - 1) {
      setCurrentCardIndex((index) => index + 1);
      setIsFlipped(false);
    } else {
      setIsComplete(true);
    }
  };

  const exitStudy = () => {
    setIsStudying(false);
    setIsComplete(false);
    setIsFlipped(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/flashcards"
              aria-label="Quay lại Flashcards"
              className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-surface-subtle)]"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{deck.name}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">{deckWords.length} thẻ mẫu · kết quả không được lưu</p>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!isStudying ? (
          <motion.div
            key="deck-info"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-7xl px-4 py-6"
          >
            <div className="relative mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <div aria-hidden="true" className="absolute left-0 top-0 h-2 w-full" style={{ backgroundColor: deck.color }} />
              <h2 className="mb-2 text-2xl font-bold">{deck.name}</h2>
              <p className="mb-6 text-[var(--color-text-secondary)]">{deck.description}</p>
              <div className="grid grid-cols-2 gap-4">
                <Metric value={deckWords.length} label="Tổng thẻ mẫu" />
                <Metric value={dueCount} label="Đánh dấu cần ôn" tone="warning" />
              </div>
            </div>

            <button
              type="button"
              onClick={startStudy}
              disabled={deckWords.length === 0}
              className="mb-3 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[var(--color-action-primary)] px-4 font-semibold text-white transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-subtle)] disabled:text-[var(--color-text-muted)]"
            >
              <Play aria-hidden="true" className="h-5 w-5" />
              Bắt đầu phiên mẫu
            </button>
            {deckWords.length === 0 && (
              <p className="mb-6 text-center text-sm text-[var(--color-text-muted)]">Deck xem trước này chưa có thẻ mẫu.</p>
            )}

            <section>
              <h2 className="mb-4 text-lg font-semibold">Danh sách từ ({deckWords.length})</h2>
              {deckWords.length ? (
                <div className="space-y-3">
                  {deckWords.map((word, index) => (
                    <motion.div key={word.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                      <Link
                        href={`/word/${encodeURIComponent(word.word)}`}
                        className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-primary-300)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span lang="ja" className="jp-text text-lg font-medium">{word.word}</span>
                              <span lang="ja" className="jp-text text-sm text-[var(--color-text-muted)]">{word.reading}</span>
                            </div>
                            <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{word.meaning}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {word.isDue && <span className="rounded-full bg-[var(--color-warning-100)] px-2 py-1 text-xs text-[var(--color-warning-700)]">Cần ôn</span>}
                            <CaretRight aria-hidden="true" className="h-5 w-5 text-[var(--color-text-muted)]" />
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-text-muted)]">
                  Chưa có từ mẫu trong deck này.
                </div>
              )}
            </section>
          </motion.div>
        ) : isComplete ? (
          <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-xl px-4 py-16 text-center">
            <Check aria-hidden="true" className="mx-auto mb-4 h-12 w-12 text-[var(--color-success)]" />
            <h2 className="mb-2 text-2xl font-bold">Hoàn thành phiên mẫu</h2>
            <p className="mb-8 text-[var(--color-text-secondary)]">Kết quả phiên này không được lưu.</p>
            <button type="button" onClick={exitStudy} className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 hover:bg-[var(--color-surface-subtle)]">
              Quay lại deck
            </button>
          </motion.div>
        ) : (
          <motion.div key="study-mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-7xl px-4 py-6">
            <div className="mb-6">
              <div className="mb-2 flex justify-between text-sm text-[var(--color-text-muted)]">
                <span>Thẻ {currentCardIndex + 1} / {deckWords.length}</span>
                <span>Phiên tạm thời</span>
              </div>
              <progress
                aria-label="Tiến độ phiên học mẫu"
                value={currentCardIndex + 1}
                max={Math.max(deckWords.length, 1)}
                className="h-2 w-full accent-[var(--color-primary-600)]"
              />
            </div>

            <div className="mb-6 flex min-h-[400px] flex-col items-center justify-center gap-3">
              <button
                ref={frontRef}
                type="button"
                hidden={isFlipped}
                onClick={() => setIsFlipped(true)}
                className="min-h-[400px] w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center"
              >
                <span className="mb-4 block text-sm text-[var(--color-text-muted)]">Nhấn để xem đáp án</span>
                <span lang="ja" className="jp-text mb-4 block text-4xl font-bold">{currentCard.word}</span>
                <span lang="ja" className="jp-text block text-lg text-[var(--color-text-muted)]">{currentCard.reading}</span>
              </button>

              <button
                ref={backRef}
                type="button"
                hidden={!isFlipped}
                onClick={() => setIsFlipped(false)}
                className="min-h-[400px] w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center"
              >
                <span className="mb-4 block text-sm text-[var(--color-text-muted)]">Đáp án · nhấn để quay lại</span>
                <span lang="ja" className="jp-text mb-4 block text-4xl font-bold">{currentCard.word}</span>
                <span lang="ja" className="jp-text mb-4 block text-lg text-[var(--color-text-muted)]">{currentCard.reading}</span>
                <span className="block text-xl text-[var(--color-text-primary)]">{currentCard.meaning}</span>
                <span className="mt-2 block text-sm text-[var(--color-text-muted)]">{currentCard.type}</span>
              </button>

              <button
                type="button"
                onClick={() => playJapaneseAudio(currentCard.word)}
                aria-label={`Nghe phát âm ${currentCard.word}`}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] transition-colors hover:bg-[var(--color-primary-100)]"
              >
                <SpeakerHigh aria-hidden="true" className="h-6 w-6 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {isFlipped && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
                <button ref={incorrectRef} type="button" onClick={handleAnswer} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-error-100)] px-3 font-semibold text-[var(--color-error-700)] hover:bg-[var(--color-error-200)]">
                  <X aria-hidden="true" className="h-5 w-5" />
                  Chưa đúng
                </button>
                <button type="button" onClick={handleAnswer} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-success-100)] px-3 font-semibold text-[var(--color-success-700)] hover:bg-[var(--color-success-200)]">
                  <Check aria-hidden="true" className="h-5 w-5" />
                  Đúng
                </button>
              </motion.div>
            )}

            <button type="button" onClick={exitStudy} className="mt-4 min-h-11 w-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
              Thoát phiên mẫu
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone?: 'warning' }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-subtle)] p-4 text-center">
      <div className={`text-2xl font-bold ${tone === 'warning' ? 'text-[var(--color-warning-600)]' : ''}`}>{value}</div>
      <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
