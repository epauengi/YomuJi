import type { Metadata } from 'next';
import HandwritingStudio from '@/components/handwriting/HandwritingStudio';
import './handwriting.css';

export const metadata: Metadata = {
  title: 'Giấy luyện viết Kanji & Kana',
  description: 'Tạo giấy luyện viết tiếng Nhật theo ý bạn. Chọn chữ, màu giấy, kiểu lưới rồi tải PDF A4 để in.',
};

export default function HandwritingPage() {
  return <HandwritingStudio />;
}
