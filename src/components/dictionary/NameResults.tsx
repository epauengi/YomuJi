'use client';

import { useEffect, useState } from 'react';
import { SpeakerHigh } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { searchNameDictionary, type NameEntry } from '@/lib/dictionaryService';
import { playJapaneseAudio } from '@/lib/tts';

const SEARCH_PREVIEW_LIMIT = 12;
const READER_PREVIEW_LIMIT = 6;
const LOOKUP_TIMEOUT_MS = 12_000;

export const NAME_CATEGORY_LABELS: Record<string, string> = {
  surname: 'Họ',
  given: 'Tên',
  fem: 'Tên nữ',
  masc: 'Tên nam',
  person: 'Họ tên',
  place: 'Địa danh',
  station: 'Nhà ga',
  company: 'Công ty',
  organization: 'Tổ chức',
  org: 'Tổ chức',
  product: 'Sản phẩm',
  work: 'Tác phẩm',
  char: 'Nhân vật',
  fict: 'Hư cấu',
  myth: 'Thần thoại',
  group: 'Nhóm',
  serv: 'Dịch vụ',
  obj: 'Sự vật',
  ev: 'Sự kiện',
  unclass: 'Tên riêng',
  other: 'Khác',
};

export function formatNameCategories(category: unknown): string[] {
  const raw = Array.isArray(category)
    ? category
    : typeof category === 'string'
      ? category.split(/[,;/]+/)
      : [];
  const labels: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const mapped = NAME_CATEGORY_LABELS[trimmed.toLowerCase()] ?? trimmed;
    if (!labels.includes(mapped)) labels.push(mapped);
  }
  return labels.length ? labels : ['Tên riêng'];
}

export interface NameResultsProps {
  query: string;
  variant?: 'search' | 'reader';
  attempt?: number;
  headingId?: string;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

type SettledNames = {
  key: string;
  status: 'done' | 'error';
  entries: NameEntry[];
};

export function NameResults({
  query,
  variant = 'search',
  attempt = 0,
  headingId: headingIdProp,
  headingLevel = 'h2',
  className,
}: NameResultsProps) {
  const trimmed = query.trim();
  const [localAttempt, setLocalAttempt] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [settled, setSettled] = useState<SettledNames | null>(null);

  const requestKey = `${trimmed}\0${attempt}\0${localAttempt}`;
  const current = settled?.key === requestKey ? settled : null;
  const loading = Boolean(trimmed) && !current;
  const entries = current?.status === 'done' ? current.entries : [];
  const isReader = variant === 'reader';
  const previewLimit = isReader ? READER_PREVIEW_LIMIT : SEARCH_PREVIEW_LIMIT;
  const expanded = expandedKey === requestKey;
  const visibleEntries = expanded ? entries : entries.slice(0, previewLimit);
  const remaining = Math.max(0, entries.length - visibleEntries.length);

  useEffect(() => {
    if (!trimmed) return;
    let cancelled = false;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (!cancelled) {
        setSettled({ key: requestKey, status: 'error', entries: [] });
      }
    }, LOOKUP_TIMEOUT_MS);

    void searchNameDictionary(trimmed, controller.signal, isReader ? { includePrefix: false } : undefined)
      .then((found) => {
        if (cancelled || controller.signal.aborted) return;
        setSettled({
          key: requestKey,
          status: 'done',
          entries: Array.isArray(found) ? found : [],
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (controller.signal.aborted && !timedOut) return;
        setSettled({ key: requestKey, status: 'error', entries: [] });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmed, requestKey, isReader]);

  if (!trimmed) return null;

  const headingId = headingIdProp ?? (isReader ? 'reader-name-results-heading' : 'name-results-heading');
  const HeadingTag = headingLevel;

  if (isReader) {
    return (
      <section
        aria-labelledby={headingId}
        className="mt-4 border-t border-[var(--color-border-subtle)] pt-4"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3
            id={headingId}
            className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]"
          >
            Tên riêng
          </h3>
          {entries.length > 0 && (
            <span className="rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
              {entries.length}
            </span>
          )}
        </div>
        <div aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--color-text-secondary)]">Đang tra tên riêng…</p>
              <div aria-hidden="true" className="h-4 w-1/2 rounded bg-[var(--color-surface-subtle)]" />
            </div>
          ) : current?.status === 'error' ? (
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Chưa thể tra cứu tên riêng.
              </p>
              <button
                type="button"
                onClick={() => setLocalAttempt((value) => value + 1)}
                className="mt-1 min-h-11 text-xs font-semibold text-[var(--color-primary-700)] hover:underline"
              >
                Thử lại
              </button>
            </div>
          ) : visibleEntries.length > 0 ? (
            <>
              <ul className="space-y-2">
                {visibleEntries.map((entry, idx) => {
                  const categories = entry.categoryLabels?.length
                    ? entry.categoryLabels
                    : formatNameCategories(entry.categories?.length ? entry.categories : entry.category);
                  const reading = entry.reading && entry.reading !== entry.surface ? entry.reading : '';
                  return (
                    <li
                      key={`${entry.surface}-${entry.reading}-${String(entry.category)}-${idx}`}
                      className="flex items-start justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span lang="ja" className="jp-text break-all text-sm font-semibold text-[var(--color-text-primary)]">
                            {entry.surface}
                          </span>
                          {reading && (
                            <span lang="ja" className="jp-text break-all text-xs text-[var(--color-text-secondary)]">
                              {reading}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {categories.map((label) => (
                            <Badge key={label} variant="default" size="sm">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => playJapaneseAudio(entry.reading || entry.surface)}
                        title="Nghe phát âm"
                        aria-label={`Nghe phát âm ${entry.surface}`}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-primary-700)]"
                      >
                        <SpeakerHigh aria-hidden="true" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedKey(requestKey)}
                  className="mt-2 min-h-11 text-xs font-semibold text-[var(--color-primary-700)] hover:underline"
                >
                  Xem thêm {remaining} tên riêng
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Không tìm thấy tên riêng khớp.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={className ?? 'mt-8 border-t border-[var(--color-border)] pt-6'}
    >
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <HeadingTag
              id={headingId}
              tabIndex={-1}
              className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] sm:text-xl"
            >
              Tên riêng
            </HeadingTag>
            {entries.length > 0 && (
              <span className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {entries.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Họ, tên người, địa danh và ga tàu (JMnedict)
          </p>
        </div>
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div>
            <p className="mb-3 text-sm text-[var(--color-text-secondary)]">Đang tra tên riêng…</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="skeleton-quiet h-24 rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)]"
                />
              ))}
            </div>
          </div>
        ) : current?.status === 'error' ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center text-[var(--color-text-secondary)]">
            <p className="text-sm">
              Chưa thể tra cứu tên riêng. Kiểm tra kết nối hoặc tải dữ liệu tên riêng offline trong Cài đặt rồi thử lại.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setLocalAttempt((value) => value + 1)}
            >
              Thử lại
            </Button>
          </div>
        ) : visibleEntries.length > 0 ? (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleEntries.map((entry, idx) => {
                const categories = entry.categoryLabels?.length
                  ? entry.categoryLabels
                  : formatNameCategories(entry.categories?.length ? entry.categories : entry.category);
                const reading = entry.reading && entry.reading !== entry.surface ? entry.reading : '';
                return (
                  <li
                    key={`${entry.surface}-${entry.reading}-${String(entry.category)}-${idx}`}
                    className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <span
                          lang="ja"
                          className="jp-text break-all text-lg font-semibold leading-7 text-[var(--color-text-primary)]"
                        >
                          {entry.surface}
                        </span>
                        {reading && (
                          <span
                            lang="ja"
                            className="jp-text break-all text-sm leading-5 text-[var(--color-text-secondary)]"
                          >
                            {reading}
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {categories.map((label) => (
                          <Badge key={label} variant="default" size="sm">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => playJapaneseAudio(entry.reading || entry.surface)}
                      title="Nghe phát âm"
                      aria-label={`Nghe phát âm ${entry.surface}`}
                      className="tactile inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
                    >
                      <SpeakerHigh aria-hidden="true" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {remaining > 0 && (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setExpandedKey(requestKey)}
                >
                  Xem thêm {remaining} tên riêng
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            Không tìm thấy tên riêng khớp với &ldquo;{trimmed}&rdquo;.
          </p>
        )}
      </div>
    </section>
  );
}
