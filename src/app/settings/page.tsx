'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bell, CaretRight, Database, Gear, Globe, Monitor, Moon, SpeakerHigh, Sun } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useDictionary, formatBytes } from '@/lib/mockDictionary';

// Custom Toggle Component using Framer Motion
const toggleVariants = {
  on: { x: 20 },
  off: { x: 0 },
};

const Toggle = React.memo(({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) => (
  <button
    onClick={onToggle}
    className={`relative flex h-7 w-12 cursor-pointer items-center rounded-full p-1 transition-colors duration-[--duration-fast] ${
      enabled ? 'bg-[var(--color-primary-600)]' : 'bg-[var(--color-border-strong)]'
    }`}
    role="switch"
    aria-checked={enabled}
    aria-label={label}
  >
    <motion.div
      className="h-5 w-5 rounded-full bg-white shadow-sm"
      layout
      variants={toggleVariants}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      initial={false}
      animate={enabled ? "on" : "off"}
    />
  </button>
));
Toggle.displayName = 'Toggle';

export default function SettingsPage() {
  const { progress, manifest, retry, isReady } = useDictionary();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleThemeChange = React.useCallback((t: 'light' | 'dark' | 'system') => {
    setTheme(t);
  }, []);

  const toggleSound = React.useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  const toggleNotifications = React.useCallback(() => {
    setNotificationsEnabled(prev => !prev);
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.dataset.theme = theme;
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-20">
      <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] py-10">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4">
          <div className="inline-flex items-center justify-center rounded-[--radius-lg] bg-[var(--color-primary-50)] p-3 text-[var(--color-primary-700)]">
            <Gear size={30} weight="duotone" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-4xl">
              Cài đặt hệ thống
            </h1>
            <p className="mt-1 text-base text-[var(--color-text-secondary)]">
              Cá nhân hóa trải nghiệm học tập của bạn
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
        
        {/* Appearance Section */}
        <section className="flex flex-col gap-4">
          <div className="ml-1">
            <h2 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
              Giao diện & Hiển thị
            </h2>
          </div>
          <Card className="overflow-hidden p-0 border-[var(--color-border)] shadow-sm">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--color-surface-subtle)] rounded-xl flex items-center justify-center text-[var(--color-text-primary)] border border-[var(--color-border)]">
                  {theme === 'dark' ? <Moon size={24} /> : theme === 'light' ? <Sun size={24} /> : <Monitor size={24} />}
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-base">Chủ đề</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Chọn giao diện sáng, tối hoặc theo hệ thống</p>
                </div>
              </div>
              
              <div className="flex bg-[var(--color-surface-subtle)] p-1 rounded-lg border border-[var(--color-border)] self-start sm:self-auto">
                {(['light', 'system', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    aria-pressed={theme === t}
                    className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-[--duration-fast] ${
                      theme === t 
                        ? 'bg-[var(--color-surface)] text-[var(--color-primary-600)] shadow-sm' 
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {t === 'light' ? 'Sáng' : t === 'dark' ? 'Tối' : 'Hệ thống'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-px bg-[var(--color-border)] w-full" />
            
            <div className="p-5 flex items-center justify-between hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--color-surface-subtle)] rounded-xl flex items-center justify-center text-[var(--color-text-primary)] border border-[var(--color-border)] group-hover:bg-[var(--color-surface)] transition-colors">
                  <Globe size={24} />
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-base">Ngôn ngữ</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Tiếng Việt</p>
                </div>
              </div>
              <CaretRight className="text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-primary-500)]" />
            </div>
          </Card>
        </section>

        {/* Preferences Section */}
        <section className="flex flex-col gap-4">
          <div className="ml-1">
            <h2 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
              Tùy chọn học tập
            </h2>
          </div>
          <Card className="overflow-hidden p-0 border-[var(--color-border)] shadow-sm">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--color-info-bg)] rounded-xl flex items-center justify-center text-[var(--color-info)] border border-[var(--color-info-bg)]">
                  <SpeakerHigh size={24} />
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-base">Tự động phát âm</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Phát âm thanh khi mở chi tiết từ vựng</p>
                </div>
              </div>
              <Toggle enabled={soundEnabled} onToggle={toggleSound} label="Tự động phát âm" />
            </div>
            
            <div className="h-px bg-[var(--color-border)] w-full ml-20" />
            
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--color-warning-bg)] rounded-xl flex items-center justify-center text-[var(--color-warning)] border border-[var(--color-warning-bg)]">
                  <Bell size={24} />
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-base">Thông báo nhắc nhở</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Nhận thông báo ôn tập hàng ngày</p>
                </div>
              </div>
              <Toggle enabled={notificationsEnabled} onToggle={toggleNotifications} label="Thông báo nhắc nhở" />
            </div>
          </Card>
        </section>

        {/* Data & Storage Section */}
        <section className="flex flex-col gap-4">
          <div className="ml-1">
            <h2 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
              Dữ liệu & Lưu trữ
            </h2>
          </div>
          <Card className="overflow-hidden p-0 border-[var(--color-border)] shadow-sm">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--color-success-bg)] rounded-xl flex items-center justify-center text-[var(--color-success)] border border-[var(--color-success-bg)]">
                  <Database size={24} weight="duotone" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-base">Dữ liệu Offline</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                    {isReady
                      ? `${manifest?.totals.terms.toLocaleString('vi-VN')} mục từ, ${manifest?.totals.kanji.toLocaleString('vi-VN')} kanji, dùng được khi tắt mạng`
                      : progress.message}
                  </p>
                </div>
              </div>
              <Button variant="secondary" className="self-start sm:self-auto font-medium" onClick={retry}>
                {isReady ? 'Kiểm tra lại' : 'Thử tải lại'}
              </Button>
            </div>
            
            <div className="bg-[var(--color-surface-subtle)] px-5 py-3 flex items-center justify-between border-t border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-secondary)]">Phiên bản cơ sở dữ liệu</p>
              <div className="flex items-center gap-2">
                <span className={`status-dot h-2 w-2 rounded-full ${isReady ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]'}`} />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {manifest?.dataVersion || 'Chưa cài'} · {formatBytes(progress.totalBytes || 0)}
                </span>
              </div>
            </div>
          </Card>
        </section>

      </div>
    </div>
  );
}
