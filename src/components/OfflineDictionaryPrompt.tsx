'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { downloadOfflineDictionary, initDictionary, useDictionary } from '@/lib/mockDictionary';

export function OfflineDictionaryPrompt() {
  const router = useRouter();
  const { isOfflineReady } = useDictionary();
  const [hasChecked, setHasChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = hasChecked && !isOfflineReady && !dismissed;

  useEffect(() => {
    let cancelled = false;
    void initDictionary().then(() => {
      if (!cancelled) setHasChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const downloadOffline = () => {
    setDismissed(true);
    void downloadOfflineDictionary().catch(() => {});
    router.push('/settings');
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="offline-prompt-title"
      aria-describedby="offline-prompt-description"
      className="offline-choice-dialog m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text-primary)] shadow-[var(--shadow-lg)]"
      onCancel={() => setDismissed(true)}
    >
      <div className="p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="mb-5 flex size-12 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
        >
          <Database size={26} weight="duotone" />
        </div>
        <h2 id="offline-prompt-title" className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Bạn muốn tra cứu thế nào?
        </h2>
        <p id="offline-prompt-description" className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
          Tra cứu online ngay khi có mạng, hoặc tải từ điển về thiết bị để tra nhanh cả khi mạng yếu.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <Button type="button" className="w-full" onClick={() => setDismissed(true)}>
            Tiếp tục tra cứu online
          </Button>
          <button
            type="button"
            onClick={downloadOffline}
            className="flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary-300)] hover:bg-[var(--color-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
          >
            Tải dữ liệu offline
          </button>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
          Dữ liệu offline rất nhẹ, giúp tra cứu nhanh hơn
        </p>
      </div>
    </dialog>
  );
}
