'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bell, CaretRight, Database, Gear, Globe, Monitor, Moon, SpeakerHigh, Sun } from '@phosphor-icons/react';
import { motion, type Variants } from 'motion/react';
import { useDictionary, formatBytes } from '@/lib/mockDictionary';

// Custom Toggle Component using Framer Motion
const toggleVariants = {
  on: { x: 20 },
  off: { x: 0 },
};

const Toggle = React.memo(({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`relative flex h-6 w-11 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2 ${
      enabled ? 'bg-[var(--color-primary-600)]' : 'bg-[var(--color-border-strong)]'
    }`}
    role="switch"
    aria-checked={enabled}
  >
    <motion.div
      className="h-4 w-4 rounded-full bg-white shadow-sm"
      layout
      variants={toggleVariants}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      initial={false}
      animate={enabled ? "on" : "off"}
    />
  </button>
));
Toggle.displayName = 'Toggle';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
};

export default function SettingsPage() {
  const { progress, manifest, retry, isReady } = useDictionary();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState('vi');

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
      {/* Header Section */}
      <div className="content-rise relative overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-surface)] py-10">
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center text-center gap-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="inline-flex items-center justify-center rounded-[--radius-lg] border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-4 text-[var(--color-primary-600)]"
          >
            <Gear size={32} weight="duotone" />
          </motion.div>
          <div>
            <motion.h1 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] tracking-tight mb-2"
            >
              Cài đặt hệ thống
            </motion.h1>
            <motion.p 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[var(--color-text-secondary)] text-lg"
            >
              Cá nhân hóa trải nghiệm học tập của bạn
            </motion.p>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <motion.div 
        className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        
        {/* Appearance Section */}
        <motion.section variants={itemVariants} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 ml-1">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary-600)]" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)] tracking-tight">
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
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
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
        </motion.section>

        {/* Preferences Section */}
        <motion.section variants={itemVariants} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 ml-1">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary-600)]" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)] tracking-tight">
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
              <Toggle enabled={soundEnabled} onToggle={toggleSound} />
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
              <Toggle enabled={notificationsEnabled} onToggle={toggleNotifications} />
            </div>
          </Card>
        </motion.section>

        {/* Data & Storage Section */}
        <motion.section variants={itemVariants} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 ml-1">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary-600)]" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)] tracking-tight">
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
                <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]'} animate-pulse`} />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {manifest?.dataVersion || 'Chưa cài'} · {formatBytes(progress.totalBytes || 0)}
                </span>
              </div>
            </div>
          </Card>
        </motion.section>

      </motion.div>
    </div>
  );
}
