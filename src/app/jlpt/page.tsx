import type { Metadata } from 'next';
import { JlptPractice } from '@/components/jlpt/JlptPractice';
import './jlpt.css';

export const metadata: Metadata = {
  title: 'Luyện đề JLPT',
  description: 'Luyện đề JLPT từ N5 đến N1 theo từng phần hoặc thi thử có tính giờ: Từ vựng / Kanji, Ngữ pháp và Đọc hiểu.',
};

export default function JLPTPage() {
  return <JlptPractice />;
}
