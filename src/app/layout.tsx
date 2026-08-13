'use client';

import React from 'react';
import { Navbar } from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import '@/app/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <div className="scroll-progress no-print" aria-hidden="true" />
        <a href="#main-content" className="skip-link">
          Nhảy đến nội dung chính
        </a>
        <Navbar />
        <main id="main-content" className="min-h-[100dvh] pb-20 md:pb-0">
          {children}
        </main>
        <div className="md:hidden">
          <BottomNav />
        </div>
        <footer className="hidden border-t border-[var(--color-border)] bg-[var(--color-surface)] py-8 md:block">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              © {new Date().getFullYear()} YomuJi - Từ điển Nhật Việt hiện đại.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
