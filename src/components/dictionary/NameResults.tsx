'use client';

import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Check, Database, DownloadSimple, SpeakerHigh } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { playJapaneseAudio } from '@/lib/tts';
import type { NameEntry } from '@/lib/nameDictionary';

const SEARCH_PREVIEW_LIMIT = 12;
const READER_PREVIEW_LIMIT = 6;
const LOOKUP_TIMEOUT_MS = 12_000;
const LANDING_SAMPLES = ['佐藤', '渋谷', '新宿', '京都'] as const;

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

interface DownloadState {
  status: 'idle' | 'downloading' | 'done' | 'error';
  done: number;
  total: number;
  error: string | null;
}

const INITIAL_DOWNLOAD_STATE: DownloadState = {
  status: 'idle',
  done: 0,
  total: 0,
  error: null,
};

let downloadState: DownloadState = INITIAL_DOWNLOAD_STATE;
const downloadListeners = new Set<() => void>();

function setDownloadState(next: DownloadState) {
  downloadState = next;
  downloadListeners.forEach((listener) => listener());
}

function subscribeDownload(listener: () => void) {
  downloadListeners.add(listener);
  return () => {
    downloadListeners.delete(listener);
  };
}

function getDownloadSnapshot() {
  return downloadState;
}

function getServerDownloadSnapshot() {
  return INITIAL_DOWNLOAD_STATE;
}

let nameDictionaryModule: typeof import('@/lib/nameDictionary') | null = null;

async function loadNameDictionary() {
  if (nameDictionaryModule) return nameDictionaryModule;
  const loaded = await import('@/lib/nameDictionary');
  nameDictionaryModule = loaded;
  return loaded;
}

// ponytail: Shared module state keeps landing/search download progress in sync; upgrade if data layer exposes reactive offline status.
async function startNameDictionaryDownload() {
  if (downloadState.status === 'downloading') return;
  setDownloadState({ status: 'downloading', done: 0, total: 0, error: null });
  try {
    const { downloadNameDictionary } = await loadNameDictionary();
    await downloadNameDictionary((done, total) => {
      setDownloadState({ status: 'downloading', done, total, error: null });
    });
    setDownloadState({
      status: 'done',
      done: downloadState.total || downloadState.done,
      total: downloadState.total,
      error: null,
    });
  } catch {
    setDownloadState({
      status: 'error',
      done: 0,
      total: 0,
      error: 'Chưa thể tải dữ liệu tên riêng offline. Kiểm tra kết nối hoặc bộ nhớ trình duyệt rồi thử lại.',
    });
  }
}

export function NameDictionaryDownloadControl({ compact = false }: { compact?: boolean }) {
  const state = useSyncExternalStore(subscribeDownload, getDownloadSnapshot, getServerDownloadSnapshot);
  const percent = state.total > 0 ? Math.min(100, Math.round((state.done / state.total) * 100)) : 0;

  return (
    <div className={compact ? 'flex flex-col items-start gap-2 sm:items-end' : 'flex flex-col gap-2'}>
      <div className="flex flex-wrap items-center gap-2">
        {state.status === 'done' && (
          <span
            role="status"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]"
          >
            <Check size={14} weight="bold" aria-hidden="true" />
            Đã tải offline
          </span>
        )}
        <Button
          type="button"
          variant={state.status === 'done' ? 'secondary' : compact ? 'secondary' : 'primary'}
          size="sm"
          loading={state.status === 'downloading'}
          disabled={state.status === 'downloading'}
          onClick={() => void startNameDictionaryDownload()}
        >
          {state.status !== 'downloading' && <DownloadSimple size={16} aria-hidden="true" />}
          {state.status === 'downloading'
            ? state.total > 0
              ? `Đang tải (${percent}%)…`
              : 'Đang tải…'
            : state.status === 'error'
              ? 'Thử tải lại'
              : state.status === 'done'
                ? 'Cập nhật offline'
                : compact
                  ? 'Tải tên riêng offline'
                  : 'Tải dữ liệu tên riêng offline'}
        </Button>
      </div>
      {state.status === 'downloading' && state.total > 0 && (
        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs text-[var(--color-text-secondary)]">
            <span>{state.done}/{state.total} phân đoạn</span>
            <span>{percent}%</span>
          </div>
          <progress
            className="h-1.5 w-full accent-[var(--color-primary-600)]"
            value={state.done}
            max={state.total}
            aria-label="Tiến độ tải dữ liệu tên riêng offline"
          />
        </div>
      )}
      {state.status === 'error' && state.error && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function NameDictionaryBanner({ onSelectQuery: _onSelectQuery }: { onSelectQuery?: (query: string) => void }) {
  const [draft, setDraft] = useState('');
  const [localQuery, setLocalQuery] = useState('');
  const [localAttempt, setLocalAttempt] = useState(0);

  const runLocalLookup = (value: string) => {
    const trimmed = value.trim();
    setDraft(trimmed);
    setLocalQuery(trimmed);
    if (trimmed) setLocalAttempt((count) => count + 1);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runLocalLookup(draft);
  };

  return (
    <section
      aria-labelledby="name-dictionary-banner-heading"
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h2
            id="name-dictionary-banner-heading"
            className="inline-flex items-center gap-2 text-base font-bold text-[var(--color-text-primary)]"
          >
            <Database size={18} weight="duotone" aria-hidden="true" className="text-[var(--color-primary-700)]" />
            Tên riêng offline
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Tra họ, tên người, địa danh và ga tàu Nhật Bản (JMnedict). Tải trước dữ liệu rồi giữ trang đang mở để tra ngoại tuyến không cần tải lại trang.
          </p>
        </div>
        <div className="shrink-0">
          <NameDictionaryDownloadControl />
        </div>
      </div>

      <form
        role="search"
        aria-label="Tra tên riêng ngoại tuyến"
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <label htmlFor="offline-name-lookup" className="sr-only">
          Nhập chính xác họ, địa danh hoặc ga tàu để tra ngoại tuyến
        </label>
        <input
          id="offline-name-lookup"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nhập chính xác họ, địa danh, ga tàu (VD: 佐藤, 渋谷)…"
          autoComplete="off"
          className="jp-text min-h-11 w-full flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary-500)] focus:bg-[var(--color-surface)] focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary" size="sm" disabled={!draft.trim()}>
            Tra tên riêng
          </Button>
          {localQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft('');
                setLocalQuery('');
              }}
            >
              Xóa
            </Button>
          )}
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Thử tra tại chỗ:</span>
        {LANDING_SAMPLES.map((sample) => (
          <button
            key={sample}
            type="button"
            lang="ja"
            onClick={() => runLocalLookup(sample)}
            className="jp-text min-h-11 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface)]"
          >
            {sample}
          </button>
        ))}
      </div>

      {localQuery && (
        <NameResults
          query={localQuery}
          attempt={localAttempt}
          headingId="offline-name-results-heading"
          headingLevel="h3"
          className="mt-5 border-t border-[var(--color-border-subtle)] pt-4"
        />
      )}
    </section>
  );
}

export interface NameResultsProps {
  query: string;
  variant?: 'search' | 'reader';
  attempt?: number;
  showOfflineDownload?: boolean;
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
  showOfflineDownload = false,
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

    void loadNameDictionary()
      .then(({ searchNames }) => {
        if (cancelled || controller.signal.aborted) return null;
        return searchNames(trimmed, controller.signal, isReader ? { includePrefix: false } : undefined);
      })
      .then((found) => {
        if (cancelled || controller.signal.aborted || found === null) return;
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
                Chưa thể tra cứu tên riêng offline.
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
            Họ, tên người, địa danh và ga tàu (JMnedict offline)
          </p>
        </div>
        {showOfflineDownload && <NameDictionaryDownloadControl compact />}
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
              Chưa thể tra cứu tên riêng offline. Kiểm tra kết nối hoặc bộ nhớ trình duyệt rồi thử lại.
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
                const categories = formatNameCategories(entry.category);
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
