import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Ôn nhanh từ đã lưu' };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
