'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookmarkSimple, MagnifyingGlass } from '@phosphor-icons/react';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import {
  readBookmarks,
  readBookmarkStorageAvailable,
  subscribeToBookmarks,
  type SavedBookmark,
} from '@/lib/browserState';

const filters = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Từ vựng', value: 'term' },
  { label: 'Kanji', value: 'kanji' },
  { label: 'Mục cũ', value: 'legacy' },
] as const;

function previewMeaning(value: string) {
  return value.replace(/<[^>]*>|\[\/?(?:b|i|u)\]/gi, '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

export default function SavedPage() {
  const [entries, setEntries] = useState<SavedBookmark[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all');
  const [isHydrated, setIsHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    const update = () => {
      setEntries(readBookmarks());
      setStorageAvailable(readBookmarkStorageAvailable());
      setIsHydrated(true);
    };
    update();
    return subscribeToBookmarks(update);
  }, []);

  const normalizedQuery = normalizeSearchText(query.trim());
  const visibleEntries = entries.filter((entry) => {
    if (filter !== 'all' && entry.kind !== filter) return false;
    if (!normalizedQuery) return true;
    const searchable = normalizeSearchText([entry.surface, entry.reading, ...entry.meanings.map(previewMeaning)].join(' '));
    return searchable.includes(normalizedQuery);
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <BookmarkSimple aria-hidden="true" size={28} weight="duotone" className="text-[var(--color-primary-700)]" />
            <h1 className="text-3xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-4xl">Đã lưu</h1>
          </div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Lưu trên trình duyệt này, chưa đồng bộ giữa thiết bị.</p>
          {!storageAvailable && (
            <p role="status" className="mt-3 text-sm text-[var(--color-warning-700)]">
              Bộ nhớ trình duyệt hiện không khả dụng. Danh sách có thể chưa được lưu bền vững; dữ liệu không bị xóa.
            </p>
          )}
        </header>

        {!isHydrated ? (
          <p role="status" className="py-8 text-sm text-[var(--color-text-secondary)]">Đang tải mục đã lưu…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]" aria-live="polite">
              {entries.length} mục đã lưu
            </p>

            <div className="relative mb-4">
              <MagnifyingGlass aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Tìm trong mục đã lưu"
                placeholder="Tìm từ, cách đọc hoặc nghĩa…"
                className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)]"
              />
            </div>

            <div role="group" aria-label="Lọc theo loại mục" className="mb-5 flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                  className={`min-h-11 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)] ${filter === item.value
                    ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {entries.length === 0 ? (
              <div className="border-t border-[var(--color-border-subtle)] py-10 text-center">
                <p className="text-[var(--color-text-primary)]">Chưa có mục nào được lưu.</p>
                <Link href="/" className="mt-2 inline-block font-medium text-[var(--color-primary-700)] underline underline-offset-4 hover:text-[var(--color-primary-800)]">
                  Tra từ điển
                </Link>
              </div>
            ) : visibleEntries.length === 0 ? (
              <div className="border-t border-[var(--color-border-subtle)] py-10 text-center">
                <p className="text-[var(--color-text-primary)]">Không tìm thấy mục phù hợp.</p>
                <button
                  type="button"
                  onClick={() => { setQuery(''); setFilter('all'); }}
                  className="mt-2 font-medium text-[var(--color-primary-700)] underline underline-offset-4 hover:text-[var(--color-primary-800)]"
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border-subtle)] border-y border-[var(--color-border-subtle)]">
                {visibleEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-4 sm:gap-5">
                    <Link href={entry.href} className="min-w-0 flex-1 rounded-[var(--radius-md)] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)]">
                      <span lang="ja" className="jp-text block break-words text-xl font-semibold text-[var(--color-text-primary)]">{entry.surface}</span>
                      {entry.reading && <span className="mt-0.5 block text-sm text-[var(--color-primary-700)]">{entry.reading}</span>}
                      {entry.meanings.length > 0 && <span className="mt-1 line-clamp-2 break-words text-sm text-[var(--color-text-secondary)]">{entry.meanings.map(previewMeaning).join(' · ')}</span>}
                      {entry.kind === 'legacy' && (
                        <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                          Mục lưu cũ chưa gắn với từ điển. Hãy chọn mục từ kết quả tra cứu để lưu đầy đủ cách đọc và nghĩa; đây chưa phải mục Kanji.
                        </span>
                      )}
                    </Link>
                    <BookmarkButton item={entry} title="Lưu mục này" size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
