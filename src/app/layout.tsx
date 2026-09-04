import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { RootShell } from '@/components/RootShell';
import '@/app/globals.css';

const title = 'YomuJi – Từ điển Nhật Việt hiện đại';
const description = 'Tra nhanh, hiểu sâu tiếng Nhật với từ điển Nhật Việt YomuJi.';

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s | YomuJi`,
  },
  description,
  applicationName: 'YomuJi',
  icons: {
    icon: '/Logo.png',
    apple: '/Logo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'YomuJi',
    title,
    description,
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}
