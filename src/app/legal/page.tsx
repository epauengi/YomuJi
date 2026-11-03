import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Nguồn dữ liệu và giấy phép | YomuJi' };

export default function LegalPage() {
  return <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
    <Link href="/books" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary-700)] hover:underline">Quay lại thư viện</Link>
    <h1 className="mt-6 font-serif text-3xl font-semibold sm:text-4xl">Nguồn dữ liệu và giấy phép</h1>
    <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-text-primary)]">Dữ liệu từ điển</h2>
      <p>Mục từ, cấu trúc nhóm nghĩa và ví dụ Nhật–Việt được lấy từ OmohaDictionary. Omoha dựa trên cấu trúc dữ liệu <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html">JMdict</a> của Electronic Dictionary Research and Development Group (EDRDG); JMdict tuân theo <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.edrdg.org/edrdg/licence.html">giấy phép EDRDG</a> (CC BY-SA 4.0). Bản dịch tiếng Việt do Omoha cung cấp; giấy phép riêng của phần dịch này chưa được xác minh.</p>
      <p>Ví dụ nằm trong mục từ do Omoha cung cấp, có tham chiếu nguồn Tatoeba; thông tin tác giả và giấy phép từng câu trong bản dữ liệu này chưa được xác minh.</p>
      <p>Một số nghĩa Kanji do YomuJi dịch và biên soạn từ <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.edrdg.org/wiki/KANJIDIC_Project.html">KANJIDIC2</a> © James William Breen và Electronic Dictionary Research and Development Group. Dữ liệu gốc và phần phái sinh tuân theo <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.edrdg.org/edrdg/licence.html">giấy phép EDRDG</a> (CC BY-SA 4.0). Phần dịch được chia sẻ theo <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>; dữ liệu có thể được cập nhật từ nguồn gốc.</p>
      <p>Việc biên soạn và đối chiếu nghĩa Kanji còn tham khảo <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.kanjipedia.jp/">漢字ペディア</a>, <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://kanji.jitenon.jp/">漢字辞典オンライン</a>, <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://kanji-db.com/">漢字データベース</a> và <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://ja.wiktionary.org/">Wiktionary tiếng Nhật</a>. Nghĩa của Wiktionary do cộng đồng đóng góp, có thể được chỉnh sửa; xem lịch sử tác giả trên từng trang và <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://ja.wiktionary.org/wiki/Wiktionary:%E8%91%97%E4%BD%9C%E6%A8%A9">giấy phép</a> (CC BY-SA 4.0). Không có sự bảo trợ hay xác nhận của các nguồn này.</p>
    </section>
    <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-text-primary)]">Phân tích và bảng chia tiếng Nhật</h2>
      <p>Dữ liệu nhận diện dạng chia và bảng chia được cung cấp bởi <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://kotoba.lt/api">Kotoba.lt</a>, từ điển Nhật–Litva. Nghĩa Nhật–Việt vẫn lấy từ từ điển hiện có. Tham khảo <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://kotoba.lt/api#attribution">điều kiện sử dụng API</a>.</p>
      </section>
      <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-text-primary)]">Câu ví dụ Nhật–Việt</h2>
      <p>Câu ví dụ cộng đồng được tải từ <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://tatoeba.org/">Tatoeba</a>. Dữ liệu văn bản sử dụng giấy phép CC BY 2.0 FR hoặc CC0 1.0 tùy từng câu. Nội dung có thể có sai sót; ví dụ không được lọc theo nghĩa riêng của mục từ. Giọng đọc do YomuJi tổng hợp, không phải bản thu của Tatoeba.</p>
    </section>
    <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-text-primary)]">Danh mục tác phẩm</h2>
      <p>Dữ liệu thư mục được cung cấp bởi <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.aozora.gr.jp/">青空文庫 — Aozora Bunko</a>, theo giấy phép <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International (CC BY 4.0)</a>.</p>
      <p>YomuJi lọc tác phẩm văn học Nhật và truyện thiếu nhi có bản XHTML/HTML, gộp thông tin người đóng góp, chuẩn hóa đường dẫn và bổ sung tên tiếng Việt, chủ đề cho một số tác phẩm. Không tự gán trình độ JLPT hoặc tạo bản dịch cho những tác phẩm còn lại.</p>
      <p>Danh mục có bản chụp metadata dự phòng; máy chủ kiểm tra cập nhật theo ngày và giữ bản gần nhất khi nguồn tạm thời gián đoạn. Không lưu toàn văn tác phẩm vào cơ sở dữ liệu của YomuJi.</p>
    </section>
    <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-text-primary)]">Ảnh bìa</h2>
      <p>Ảnh bìa tùy chọn được tra cứu từ <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://openlibrary.org/">Open Library</a> theo tên tác phẩm và tác giả; ảnh được tải trực tiếp từ máy chủ Open Library và không lưu trong cơ sở dữ liệu YomuJi. Có thể hiển thị bìa của một ấn bản khác; ảnh không khớp hoặc không tải được sẽ dùng bìa chữ YomuJi.</p>
      <p>API: <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://openlibrary.org/dev/docs/api/search">Open Library Search</a> · <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://openlibrary.org/dev/docs/api/covers">Covers API</a>. Gửi góp ý về cách dùng API: <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://openlibrary.org/developers/api">hướng dẫn sử dụng</a>.</p>
    </section>
    <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-text-primary)]">Toàn văn và cách hiển thị</h2>
      <p>Thư viện chỉ chọn các mục được nguồn đánh dấu không còn bản quyền đối với tác phẩm và mọi người đóng góp được liệt kê, gồm cả người dịch. Tình trạng bảo hộ có thể khác nhau theo quốc gia; thông tin này không thay thế tư vấn pháp lý.</p>
      <p>Nội dung được tải khi đọc, chuyển từ XHTML thành văn bản và ruby. Định dạng trang, thông tin xuất bản cuối tệp, ảnh minh họa không được tái hiện; ký tự ngoài bộ chữ có thể được biểu diễn bằng mô tả. Bìa chữ do YomuJi tạo, không phải ảnh bìa xuất bản gốc.</p>
      <p>Quy định sử dụng nguồn: <a className="text-[var(--color-primary-700)] underline underline-offset-4" href="https://www.aozora.gr.jp/guide/kijyunn.html">青空文庫収録ファイルの取り扱い規準</a>. Việc sử dụng dữ liệu không hàm ý Aozora Bunko bảo trợ hoặc xác nhận YomuJi.</p>
    </section>
  </article>;
}
