import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: { default: 'Thư viện tiếng Nhật', template: '%s | YomuJi' } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
