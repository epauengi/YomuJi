import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export const metadata: Metadata = process.env.NODE_ENV === 'development'
  ? { title: 'Mẫu giao diện' }
  : { title: { absolute: 'Không tìm thấy trang | YomuJi' } };

export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  return children;
}
