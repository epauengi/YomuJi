import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Nguồn dữ liệu và giấy phép | YomuJi' };

export default function LegalPage() {
  return <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
    <Link href="/books" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary-700)] hover:underline">Quay lại thư viện</Link>
    <h1 className="mt-6 font-serif text-3xl font-semibold sm:text-4xl">Nguồn dữ liệu và giấy phép</h1>
    <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-text-primary)]">Danh mục tác phẩm</h2>
      <p>Dữ liệu thư mục được cung cấp bởi <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.aozora.gr.jp/">青空文庫 — Aozora Bunko</a>, theo giấy phép <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International (CC BY 4.0)</a>.</p>
      <p>YomuJi lọc tác phẩm văn học Nhật và truyện thiếu nhi có bản XHTML/HTML, gộp thông tin người đóng góp, chuẩn hóa đường dẫn và bổ sung tên tiếng Việt, chủ đề cho một số tác phẩm. Không tự gán trình độ JLPT hoặc tạo bản dịch cho những tác phẩm còn lại.</p>
      <p>Danh mục có bản chụp metadata dự phòng; máy chủ kiểm tra cập nhật theo ngày và giữ bản gần nhất khi nguồn tạm thời gián đoạn. Không lưu toàn văn tác phẩm vào cơ sở dữ liệu của YomuJi.</p>
    </section>
    <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-text-primary)]">Toàn văn và cách hiển thị</h2>
      <p>Thư viện chỉ chọn các mục được nguồn đánh dấu không còn bản quyền đối với tác phẩm và mọi người đóng góp được liệt kê, gồm cả người dịch. Tình trạng bảo hộ có thể khác nhau theo quốc gia; thông tin này không thay thế tư vấn pháp lý.</p>
      <p>Nội dung được tải khi đọc, chuyển từ XHTML thành văn bản và ruby. Định dạng trang, thông tin xuất bản cuối tệp, ảnh minh họa không được tái hiện; ký tự ngoài bộ chữ có thể được biểu diễn bằng mô tả. Bìa chữ do YomuJi tạo, không phải ảnh bìa xuất bản gốc.</p>
      <p>Quy định sử dụng nguồn: <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.aozora.gr.jp/guide/kijyunn.html">青空文庫収録ファイルの取り扱い規準</a>. Việc sử dụng dữ liệu không hàm ý Aozora Bunko bảo trợ hoặc xác nhận YomuJi.</p>
    </section>
  </article>;
}
