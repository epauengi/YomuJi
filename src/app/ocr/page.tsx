import type { Metadata } from 'next';
import { OcrLookup } from './OcrLookup';

export const metadata: Metadata = {
  title: 'Tra từ bằng ảnh',
  description: 'Nhận dạng chữ Nhật từ ảnh, chỉnh văn bản rồi tra nghĩa từng từ.',
};

export default function OcrPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-8 sm:py-12">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tra từ bằng ảnh</h1>
        <p className="text-[var(--color-text-secondary)]">Chụp hoặc tải ảnh có chữ Nhật. Chọn vùng cần đọc, sửa văn bản nhận dạng rồi tra từng từ.</p>
      </header>
      <OcrLookup />
    </div>
  );
}
