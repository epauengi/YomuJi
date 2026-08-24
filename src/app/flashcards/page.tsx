'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { BookBookmark, CaretRight, Clock } from '@phosphor-icons/react';
import { demoDecks, demoWords } from '@/data/mockData';

export default function FlashcardsPage() {
  const dueWords = demoWords.filter((word) => word.isDue);

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      <header className="content-rise border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-4 flex items-center gap-3">
            <BookBookmark aria-hidden="true" className="h-6 w-6 text-[var(--color-primary-600)]" />
            <h1 className="text-2xl font-bold">Flashcards</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">Bản xem trước phiên học bằng dữ liệu mẫu.</p>
          <p className="mt-1 text-sm text-[var(--color-warning-700)]">
            Deck và kết quả học không được lưu.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-4">
          <StatCard icon={<BookBookmark aria-hidden="true" className="h-5 w-5 text-[var(--color-primary-600)]" />} value={demoWords.length} label="Thẻ mẫu" tone="primary" />
          <StatCard icon={<Clock aria-hidden="true" className="h-5 w-5 text-[var(--color-warning-600)]" />} value={dueWords.length} label="Đánh dấu cần ôn" tone="warning" />
        </div>

        <section className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">Deck mẫu</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {demoDecks.map((deck, index) => {
              const words = demoWords.filter((word) => word.deck === deck.id);
              const dueCount = words.filter((word) => word.isDue).length;
              return (
                <motion.div
                  key={deck.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    href={`/flashcards/deck/${deck.id}`}
                    className="surface-lift block h-full rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary-300)]"
                  >
                    <div aria-hidden="true" className="mb-4 h-2 rounded-full" style={{ backgroundColor: deck.color }} />
                    <div className="mb-3 flex items-start justify-between">
                      <h3 className="text-lg font-semibold">{deck.name}</h3>
                      <CaretRight aria-hidden="true" className="h-5 w-5 text-[var(--color-text-muted)]" />
                    </div>
                    <p className="mb-4 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{deck.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                        <BookBookmark aria-hidden="true" className="h-4 w-4" />
                        {words.length} thẻ
                      </span>
                      {dueCount > 0 && (
                        <span className="flex items-center gap-1 text-[var(--color-warning-600)]">
                          <Clock aria-hidden="true" className="h-4 w-4" />
                          {dueCount} cần ôn
                        </span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Từ mẫu</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {demoWords.slice(0, 4).map((word, index) => (
              <motion.div
                key={word.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={`/word/${encodeURIComponent(word.word)}`}
                  className="surface-lift block rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary-300)]"
                >
                  <div lang="ja" className="jp-text mb-1 text-xl font-medium">{word.word}</div>
                  <div lang="ja" className="jp-text mb-2 text-sm text-[var(--color-text-muted)]">{word.reading}</div>
                  <div className="line-clamp-1 text-sm text-[var(--color-text-secondary)]">{word.meaning}</div>
                  {word.isDue && <div className="mt-2 text-xs text-[var(--color-warning-600)]">Đánh dấu cần ôn</div>}
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: 'primary' | 'warning' }) {
  return (
    <div className="surface-lift rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${tone === 'primary' ? 'bg-[var(--color-primary-100)]' : 'bg-[var(--color-warning-100)]'}`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
        </div>
      </div>
    </div>
  );
}
