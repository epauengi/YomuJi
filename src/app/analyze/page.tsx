import type { Metadata } from 'next';
import { PasteLookup } from '@/components/books/PasteLookup';

export const metadata: Metadata = {
  title: 'Dán đoạn để tra | YomuJi',
  description: 'Dán đoạn tiếng Nhật ngắn, chạm vào từ để xem nghĩa và dạng gốc.',
};

export default function AnalyzePage() {
  return <PasteLookup />;
}
