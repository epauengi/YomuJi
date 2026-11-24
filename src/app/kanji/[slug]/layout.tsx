import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    return { title: `Kanji ${decodeURIComponent(slug)}` };
  } catch {
    return { title: 'Chi tiết Kanji' };
  }
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
