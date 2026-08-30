'use client';

import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useReducedMotion } from 'motion/react';
import { Database, Gear, Globe, Monitor, Moon, Sun } from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDictionary } from '@/lib/mockDictionary';
import {
  subscribeToTheme,
  writeThemePreference,
  type ThemePreference,
} from '@/lib/browserState';

type ThemeTransition = {
  finished: Promise<unknown>;
};

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeTransition;
};

export default function SettingsPage() {
  const { progress, manifest, retry, isReady } = useDictionary();
  const [theme, setTheme] = useState<ThemePreference>('system');
  const themeRef = useRef<ThemePreference>('system');
  const reduceMotion = useReducedMotion();
  const transitionToken = useRef(0);

  useEffect(() => subscribeToTheme((preference) => {
    themeRef.current = preference;
    setTheme(preference);
  }), []);

  useEffect(() => () => {
    const root = document.documentElement;
    root.removeAttribute('data-theme-transition');
    root.style.removeProperty('--theme-transition-x');
    root.style.removeProperty('--theme-transition-y');
  }, []);

  const handleThemeChange = (preference: ThemePreference, button: HTMLButtonElement) => {
    if (preference === themeRef.current) return;
    themeRef.current = preference;

    const commit = () => {
      flushSync(() => {
        themeRef.current = preference;
        setTheme(preference);
        writeThemePreference(preference);
      });
    };
    const documentWithTransition = document as ThemeTransitionDocument;

    const prefersReducedMotion = reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !documentWithTransition.startViewTransition) {
      commit();
      return;
    }

    const root = document.documentElement;
    const { left, top, width, height } = button.getBoundingClientRect();
    const token = ++transitionToken.current;
    root.dataset.themeTransition = String(token);
    root.style.setProperty('--theme-transition-x', `${left + width / 2}px`);
    root.style.setProperty('--theme-transition-y', `${top + height / 2}px`);

    const clearTransition = () => {
      if (transitionToken.current !== token) return;
      root.removeAttribute('data-theme-transition');
      root.style.removeProperty('--theme-transition-x');
      root.style.removeProperty('--theme-transition-y');
    };

    try {
      const transition = documentWithTransition.startViewTransition!(commit);
      void transition.finished.then(clearTransition, clearTransition);
    } catch {
      clearTransition();
      commit();
    }
  };

  const isChecking = progress.status === 'checking'
    || progress.status === 'downloading'
    || progress.status === 'indexing';
  const hasError = progress.status === 'error';
  const dataSummary = manifest
    ? `${manifest.totals.terms.toLocaleString('vi-VN')} mục từ · ${manifest.totals.kanji.toLocaleString('vi-VN')} Kanji`
    : isReady
      ? 'Tra cứu trực tuyến sẵn sàng; chưa có thông tin dữ liệu dự phòng.'
      : progress.message;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-20">
      <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] py-10">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4">
          <div className="inline-flex items-center justify-center rounded-[--radius-lg] bg-[var(--color-primary-50)] p-3 text-[var(--color-primary-700)]">
            <Gear aria-hidden="true" size={30} weight="duotone" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-4xl">
              Cài đặt hệ thống
            </h1>
            <p className="mt-1 text-base text-[var(--color-text-secondary)]">
              Giao diện và trạng thái dữ liệu từ điển
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
        <section className="flex flex-col gap-4">
          <h2 className="ml-1 text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Giao diện & Hiển thị
          </h2>
          <Card className="overflow-hidden border-[var(--color-border)] p-0 shadow-sm">
            <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)]">
                  {theme === 'dark' ? <Moon aria-hidden="true" size={24} /> : theme === 'light' ? <Sun aria-hidden="true" size={24} /> : <Monitor aria-hidden="true" size={24} />}
                </div>
                <div>
                  <p className="text-base font-semibold text-[var(--color-text-primary)]">Chủ đề</p>
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Lựa chọn được lưu trên thiết bị này</p>
                </div>
              </div>

              <div className="flex self-start rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1 sm:self-auto">
                {(['light', 'system', 'dark'] as const).map((preference) => (
                  <button
                    key={preference}
                    type="button"
                    onClick={(event) => handleThemeChange(preference, event.currentTarget)}
                    aria-pressed={theme === preference}
                    className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-[--duration-fast] ${
                      theme === preference
                        ? 'bg-[var(--color-surface)] text-[var(--color-primary-700)] shadow-sm'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {preference === 'light' ? 'Sáng' : preference === 'dark' ? 'Tối' : 'Hệ thống'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px w-full bg-[var(--color-border)]" />

            <div className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)]">
                <Globe aria-hidden="true" size={24} />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--color-text-primary)]">Ngôn ngữ</p>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Tiếng Việt</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="ml-1 text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Dữ liệu từ điển
          </h2>
          <Card className="overflow-hidden border-[var(--color-border)] p-0 shadow-sm">
            <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-success-bg)] bg-[var(--color-success-bg)] text-[var(--color-success)]">
                  <Database aria-hidden="true" size={24} weight="duotone" />
                </div>
                <div>
                  <p className="text-base font-semibold text-[var(--color-text-primary)]">Trạng thái dữ liệu</p>
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]" role="status" aria-live="polite">
                    {dataSummary}
                  </p>
                  {hasError && progress.error && (
                    <p className="mt-1 text-sm text-[var(--color-error)]">{progress.error}</p>
                  )}
                </div>
              </div>
              {hasError && (
                <Button
                  variant="secondary"
                  className="self-start font-medium sm:self-auto"
                  onClick={retry}
                  disabled={isChecking}
                >
                  Thử lại
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-5 py-3">
              <p className="text-sm text-[var(--color-text-secondary)]">Phiên bản dữ liệu</p>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`${isChecking ? 'status-dot' : ''} h-2 w-2 rounded-full ${hasError ? 'bg-[var(--color-error)]' : isChecking ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'}`}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {manifest?.dataVersion || (isReady ? 'Trực tuyến' : 'Chưa sẵn sàng')}
                </span>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
