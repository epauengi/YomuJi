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
      <head>
        {/* Keep the storage key and preference rules in sync with browserState.ts. */}
        <script dangerouslySetInnerHTML={{ __html: `(() => {
          let preference;
          try { preference = localStorage.getItem('yomuji_theme'); } catch {}
          document.documentElement.dataset.theme = preference === 'light' || preference === 'dark'
            ? preference
            : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        })();` }} />
      </head>
      <body className="font-sans antialiased">
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}
