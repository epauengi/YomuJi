import type { Metadata } from 'next';
import { CounterTool } from '@/components/CounterTool';

export const metadata: Metadata = {
  title: 'Đếm sao cho đúng? — Bộ đếm tiếng Nhật',
  description: 'Chọn đồ vật và số lượng để xem cách đếm trong tiếng Nhật.',
};

export default function CountersPage() {
  return <CounterTool />;
}
