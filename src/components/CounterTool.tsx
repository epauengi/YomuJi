'use client';

import Image from 'next/image';
import { useState } from 'react';
import { COUNTER_OBJECTS, getCounterResult } from '@/lib/japaneseCounters';

const numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export function CounterTool() {
  const [selectedId, setSelectedId] = useState(COUNTER_OBJECTS[0].id);
  const [quantity, setQuantity] = useState(1);
  const item = COUNTER_OBJECTS.find(({ id }) => id === selectedId) ?? COUNTER_OBJECTS[0];
  const result = getCounterResult(item.id, quantity);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">Đếm sao cho đúng?</h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">Chọn một hình và số lượng. YomuJi ghép số đếm tiếng Nhật giúp bạn.</p>
      </header>

      {result && (
        <div className="sticky top-16 z-[9] -mx-4 mb-5 flex items-center justify-between gap-3 border-y border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 sm:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[var(--color-text-secondary)]">
              {quantity} {item.label.toLocaleLowerCase()}
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2" lang="ja">
              <strong className="jp-text text-lg font-bold text-[var(--color-text-primary)]">{result.written}</strong>
              <span className="jp-text text-xs font-medium text-[var(--color-primary-700)]">({result.reading})</span>
            </p>
          </div>
          <a
            href="#quantity-heading"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('quantity-heading')?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                block: 'start',
              });
            }}
            className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 text-xs font-semibold text-[var(--color-primary-700)] transition-colors hover:bg-[var(--color-primary-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)]"
          >
            Đổi số lượng
          </a>
        </div>
      )}

      <section aria-labelledby="object-heading">
        <h2 id="object-heading" className="text-lg font-semibold text-[var(--color-text-primary)]">Bạn muốn đếm gì?</h2>
        <div className="mt-4 grid grid-cols-2 gap-x-3 sm:grid-cols-3 sm:gap-x-5">
          {COUNTER_OBJECTS.map((object) => {
            const selected = object.id === item.id;
            return (
              <button
                key={object.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedId(object.id)}
                className={`flex min-h-28 items-center gap-3 border-b border-[var(--color-border-subtle)] py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)] sm:min-h-32 sm:gap-4 ${selected ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-primary)] hover:text-[var(--color-primary-700)]'}`}
              >
                <Image src={object.image} alt="" width={76} height={76} className="h-[68px] w-[68px] shrink-0 object-contain sm:h-[76px] sm:w-[76px]" />
                <span className="min-w-0">
                  <span className="block font-semibold">{object.label}</span>
                  <span className="jp-text mt-0.5 block text-sm text-[var(--color-text-secondary)]">{object.noun}・{object.nounReading}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="quantity-heading" className="mt-8">
        <h2 id="quantity-heading" className="scroll-mt-32 text-lg font-semibold text-[var(--color-text-primary)]">Số lượng</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Chọn số lượng">
          {numbers.map((number, index) => {
            const value = index + 1;
            const selected = quantity === value;
            return (
              <button key={value} type="button" aria-pressed={selected} onClick={() => setQuantity(value)} className={`min-h-11 min-w-11 rounded-[var(--radius-md)] border px-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)] ${selected ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-white' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]'}`}>
                <span lang="ja" className="jp-text">{number}</span>
                <span className="sr-only">{` ${value}`}</span>
              </button>
            );
          })}
        </div>
      </section>

      {result && (
        <section id="counter-result" aria-live="polite" aria-atomic="true" aria-label="Cách đếm" className="mt-8 scroll-mt-32 border-t border-[var(--color-border)] pt-6 sm:mt-10 sm:pt-8">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{quantity} {item.label.toLocaleLowerCase()} trong tiếng Nhật</p>
          <p className="jp-text mt-2 text-4xl font-semibold tracking-wide text-[var(--color-text-primary)] sm:text-5xl" lang="ja">{result.written}</p>
          <p className="jp-text mt-1 text-lg text-[var(--color-primary-700)]" lang="ja">{result.reading}</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">{result.note}</p>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">Minh họa: いらすとや · <a className="underline underline-offset-4 hover:text-[var(--color-text-primary)]" href="https://www.irasutoya.com/" target="_blank" rel="noreferrer">Irasutoya</a></p>
        </section>
      )}
    </div>
  );
}
