import type { Metadata } from 'next';
import { JlptPractice } from '@/components/jlpt/JlptPractice';
import './jlpt.css';

export const metadata: Metadata = {
  title: 'Luyện đề JLPT',
  description: 'Luyện 10 đề JLPT N2 theo từng phần hoặc thi thử Từ vựng, Ngữ pháp và Đọc hiểu trong 105 phút.',
};

export default function JLPTPage() {
  return <JlptPractice />;
}
