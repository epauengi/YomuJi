'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClockCounterClockwise, MagnifyingGlass, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { searchHref } from '@/lib/navigation';
import { readRecentSearches, removeRecentSearches, restoreRecentSearches } from '@/lib/recentSearches';

export default function HistoryPage() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      setRecentSearches(readRecentSearches());
    } catch (err) {
      console.error('Failed to read search history:', err);
      toast.error('Không thể đọc lịch sử trên thiết bị.');
    }
  }, []);

  const removeSearch = (query: string) => {
    try {
      const { searches, removed } = removeRecentSearches(query);
      setRecentSearches(searches);
      if (!removed.length) return;
      toast.success('Đã xóa tìm kiếm', {
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            try {
              setRecentSearches(restoreRecentSearches(removed));
            } catch (err) {
              console.error('Failed to restore search history:', err);
              toast.error('Không thể khôi phục lịch sử trên thiết bị.');
            }
          },
        },
      });
    } catch (err) {
      console.error('Failed to remove search history:', err);
      toast.error('Không thể xóa lịch sử trên thiết bị.');
    }
  };

  const clearHistory = () => {
    try {
      const { searches, removed } = removeRecentSearches();
      setRecentSearches(searches);
      if (!removed.length) return;
      toast.success('Đã xóa lịch sử tìm kiếm', {
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            try {
              setRecentSearches(restoreRecentSearches(removed));
            } catch (err) {
              console.error('Failed to restore search history:', err);
              toast.error('Không thể khôi phục lịch sử trên thiết bị.');
            }
          },
        },
      });
    } catch (err) {
      console.error('Failed to clear search history:', err);
      toast.error('Không thể xóa lịch sử trên thiết bị.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-4 flex items-center gap-3">
            <ClockCounterClockwise aria-hidden="true" className="h-6 w-6 text-[var(--color-primary-600)]" />
            <h1 className="text-2xl font-bold">Tìm kiếm gần đây</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">Các truy vấn được lưu trên trình duyệt này.</p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {recentSearches.length ? (
          <section aria-labelledby="recent-heading">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="recent-heading" className="font-semibold">{recentSearches.length} truy vấn</h2>
              <button type="button" onClick={clearHistory} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-error)]">
                <Trash aria-hidden="true" className="h-4 w-4" />
                Xóa tất cả
              </button>
            </div>

            <ul className="space-y-3">
              {recentSearches.map((query) => (
                <li key={query} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 transition-colors hover:border-[var(--color-primary-300)]">
                  <Link href={searchHref(query)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2">
                    <MagnifyingGlass aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                    <span className="truncate font-medium">{query}</span>
                  </Link>
                  <button type="button" onClick={() => removeSearch(query)} aria-label={`Xóa ${query} khỏi lịch sử`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--color-surface-subtle)]">
                    <Trash aria-hidden="true" className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="rounded-[--radius-lg] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center">
            <ClockCounterClockwise aria-hidden="true" className="mx-auto mb-4 h-12 w-12 text-[var(--color-text-muted)]" />
            <h2 className="mb-2 text-lg font-semibold">Chưa có tìm kiếm gần đây</h2>
            <p className="mb-6 text-[var(--color-text-secondary)]">Lịch sử học tập và ôn tập hiện không được lưu.</p>
            <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-action-primary)] px-5 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">
              Tra từ ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
