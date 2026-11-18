import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Nguồn & giấy phép giấy luyện viết' };

export default function HandwritingLicensesPage() {
  return <main className="mx-auto max-w-3xl px-5 py-10 text-[var(--color-text-primary)] sm:px-8">
    <Link href="/handwriting" className="underline underline-offset-4">Trở về tạo giấy luyện viết</Link>
    <h1 className="mt-6 text-3xl font-bold">Nguồn & giấy phép</h1>
    <div className="mt-6 space-y-6 text-sm leading-7 [&_a]:underline [&_a]:underline-offset-4">
      <section><h2 className="text-lg font-semibold">Mẫu nét Kanji và Kana</h2><p><a href="https://kanjivg.tagaini.net/">KanjiVG</a> © Ulrich Apel, <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>. SVG được trích xuất đường nét, thay màu, thay kích thước và lặp lại để tạo bài luyện viết. Các phần phái sinh từ KanjiVG được chia sẻ theo cùng giấy phép.</p><p><a href="https://github.com/parsimonhi/animCJK">AnimCJK</a> © FM-SH. Các SVG Kanji có thể bắt nguồn từ MakeMeAHanzi và font Arphic, theo <a href="/handwriting/licenses/Arphic-Public-License.txt">Arphic Public License</a>; tài nguyên khác có điều khoản riêng trong <a href="https://github.com/parsimonhi/animCJK/blob/master/licenses/COPYING.txt">thông báo giấy phép AnimCJK</a>. Giữ nguyên thông báo giấy phép ở đầu từng <a href="/dict/strokes/04e00.svg">SVG nguồn</a>. Bản PDF chỉ lấy hình nét tĩnh, thay màu, thay kích thước và lặp lại; không kèm animation.</p></section>
      <section><h2 className="text-lg font-semibold">Font nhúng</h2><p><a href="https://github.com/fontworks-fonts/Klee">Klee One</a> của Fontworks dùng cho chữ Nhật; Noto Sans dùng cho tiếng Việt. Font được phân phối theo SIL Open Font License 1.1. PDF nhúng đầy đủ Klee One để giữ đúng hình chữ Nhật; Noto Sans chỉ nhúng tập con ký tự cần dùng. Klee One là font viết tay, không phải dữ liệu thứ tự nét.</p><p>Giấy phép đầy đủ: <a href="/handwriting/licenses/Klee-OFL.txt">Klee One</a>, <a href="/handwriting/licenses/NotoSans-OFL.txt">Noto Sans</a>, <a href="/handwriting/licenses/KanjiVG-COPYING.txt">KanjiVG</a>. Phiên bản nguồn và tài nguyên Kana: <a href="/handwriting/manifest.json">manifest</a>.</p></section>
      <section><h2 className="text-lg font-semibold">Nghĩa và cách đọc</h2><p>Dùng dữ liệu từ điển hiện có của YomuJi. Một số nghĩa và cách đọc bắt nguồn từ KANJIDIC2 © James William Breen và Electronic Dictionary Research and Development Group, CC BY-SA 4.0. Xem <Link href="/legal">nguồn dữ liệu và điều khoản</Link>. Nghĩa Việt giữ nguyên nguồn hiện có; không tạo bằng AI trong tính năng này.</p></section>
      <section><h2 className="text-lg font-semibold">Sử dụng bản PDF</h2><p>Bạn có thể in và chia sẻ theo giấy phép tương ứng của từng phần dữ liệu. Khi chia sẻ hoặc chỉnh sửa, giữ thông báo nguồn, giấy phép và ghi rõ thay đổi. Giấy phép font, hình nét và dữ liệu không đồng nhất với giấy phép mã ứng dụng.</p></section>
    </div>
  </main>;
}
