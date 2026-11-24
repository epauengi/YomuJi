import type { Metadata } from 'next';
import { KanjiComponentSearch } from '@/components/dictionary/KanjiComponentSearch';

export const metadata: Metadata = {
  title: 'Tra Kanji theo thành phần',
  description: 'Chọn nhiều thành phần Kanji và lọc theo số nét để tìm chữ Hán.',
};

export default function KanjiComponentsPage() {
  return <KanjiComponentSearch />;
}
