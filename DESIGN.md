---
name: YomuJi
description: Calm Utility Editorial — tra cứu Nhật–Việt và luyện JLPT.
colors:
  action-primary: "#0F766E"
  action-hover: "#115E59"
  canvas-light: "#F6F8FA"
  canvas-dark: "#0E141B"
  surface-light: "#FFFFFF"
  surface-dark: "#151E27"
  text-light: "#17202A"
  text-dark: "#F3F7FA"
typography:
  body:
    fontFamily: '"Noto Sans", "Segoe UI", Arial, sans-serif'
    fontWeight: 400
  serif:
    fontFamily: '"Lora", "Yu Mincho", "Noto Serif JP", "Noto Serif CJK JP", Georgia, serif'
    fontWeight: 400
  japanese:
    fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif'
  worksheet-japanese:
    fontFamily: '"Worksheet Japanese"'
    fontWeight: 400
  worksheet-latin:
    fontFamily: '"Worksheet Latin"'
    fontWeight: 400
  worksheet-readings:
    fontFamily: '"Worksheet Readings"'
    fontWeight: 400
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.surface-light}"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
---

# Design System: YomuJi

## Overview

**Calm Utility Editorial.** Giữ bản sắc hiện hữu: nội dung Nhật–Việt dẫn dắt, nền trung tính, teal/jade nhấn hành động và trạng thái. Không thay thế nhận diện khi mở rộng tính năng.

Nguồn chuẩn: `src/app/globals.css`; quy tắc riêng JLPT: `src/app/jlpt/jlpt.css`. CSS đang chạy là nguồn quyết định khi tài liệu khác biệt.

## Colors

Dùng biến semantic `--color-bg`, `--color-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border`; không đóng cứng màu sáng trong component. `data-theme` đổi light/dark.

`--color-action-primary` giữ teal đậm cho nút chữ trắng. `--color-primary-700` đổi thành jade sáng trong dark theme cho chữ nhấn. Đúng, sai, đánh dấu dùng bộ `success`, `error`, `warning` tương ứng; luôn kèm chữ hoặc icon, không chỉ màu.

## Typography

Tiếng Việt (gồm tiêu đề danh mục `/books`) dùng `--font-sans`; tiếng Nhật dùng `lang="ja"` và `.jp-text` / `--font-jp`. `--font-serif` (`Lora`) và `--font-book-heading` chỉ dành cho trang chi tiết sách và nội dung đọc hiện hữu, không tự chuyển tiêu đề danh mục `/books` hay JLPT sang serif.

JLPT: h1 `clamp(1.75rem, 3vw, 2.4rem)`, weight 720, line-height 1.2, tracking -0.03em. Đoạn đọc 16px desktop / 15px mobile, weight 400, line-height 2.15 / 2.1. Câu hỏi 21px / 19px; lựa chọn 17px / 16px. Đồng hồ, điểm, số câu dùng tabular numerals.

## Layout

Shell hiện hữu dùng `max-w-7xl` và padding responsive. Các số sau chỉ áp dụng `/jlpt`, không phải token toàn sản phẩm:

- Container tối đa 1168px. Catalog desktop: cột chọn phần 245px, danh sách 10 đề bên phải; tablet 210px; dưới 768px phần luyện xếp ngang, danh sách một cột.
- Workspace desktop: câu hỏi + phiếu trả lời 280px; phiếu sticky cách đỉnh 88px. Mobile đặt phiếu sau câu hỏi.
- Phiếu tự chia cột theo vùng chạm tối thiểu 44×44px, gap 8px (khoảng 4 cột ở 320px, 5 cột ở 390px). Giữ đủ khoảng cuối trang để điều hướng di động không che nội dung khi cuộn.

## Elevation & Depth

JLPT dùng mặt phẳng và viền 1px, không bóng trang trí. Dropdown/dialog hiện hữu dùng `--shadow-xs` đến `--shadow-lg`; không thêm bóng lên mọi khối. Giữ outline focus rõ trong cả hai theme.

## Shapes

Global: radius 8/12/16/20px và pill 9999px. JLPT: panel 16px desktop / 14px mobile, lựa chọn 10px, chỉ số đáp án tròn 26px. Không biến các kích thước cục bộ thành quy tắc chung.

## Global navigation

- Desktop từ 1200px: sidebar 224px, thu gọn còn 72px; nhóm “Tra cứu & đọc” (Từ điển `/`, Đếm `/counters`, Thư viện `/books`, cùng `/analyze` và `/kanji-components`), “Luyện tập”, “Cá nhân”; Thiết lập ở cuối. Giữ nhận diện và tokens hiện hữu.
- Tablet 768–1199px: nút menu mở native modal dialog; khóa cuộn nền, Escape đóng, trả focus về nút mở.
- Mobile dưới 768px: bottom bar bốn mục Từ điển, Thư viện, Luyện tập, Đã lưu. `/practice` mở `/analyze`, `/kanji-components`, `/counters`, Flashcards, JLPT hoặc Giấy luyện viết; Thiết lập trên header.
- Header cao 64px, tìm kiếm trên các trang ngoài trang chủ. Không lặp navbar ngang trên desktop.
- Đọc sách, phiên Flashcards và phiên JLPT tự thu gọn sidebar; người dùng vẫn mở rộng thủ công được. Đổi trang khôi phục trạng thái tự động.
- Giữ nguyên `/flashcards`, `/jlpt`, `/saved`, `/review` và URL chi tiết; ôn bookmark vẫn thuộc Đã lưu, không tự chuyển dữ liệu sang Flashcards.

## Components

- **Nút:** hành động chính teal; phụ nền surface + viền; hover/focus/disabled rõ. Nút hành động JLPT tối thiểu 44px; câu trả lời 61px desktop / 56px mobile. Ô phiếu hiện dùng 39px, không thu nhỏ thêm.
- **Chọn đáp án:** radio native, nhãn bao toàn hàng; focus bàn phím hiện trên hàng. Chỉ hiện đúng/sai sau POST nộp bài.
- **JLPT:** dealt-2 chọn phần trước; N2 có 10 đề, các cấp khác “Sắp có”. Luyện từng phần không giới hạn giờ; thi thử ghép cùng số đề, chung 105 phút. Kết quả là số câu đúng, không phải điểm JLPT chính thức.
- **Trạng thái:** lỗi tải có cách thử lại; lỗi nộp giữ câu trả lời. Hết giờ khóa đáp án, tự nộp một lần; lỗi mạng cho nộp lại. Không lưu tiến độ qua lần rời trang; cảnh báo trước khi bỏ bài.

## Giấy luyện viết `/handwriting`

- Operate: giữ Calm Utility Editorial. Desktop thiết lập trái 300–320px, tờ A4 phải; dưới 768px thiết lập trên, bản xem dưới. Màu giấy độc lập theme ứng dụng.
- Tờ giấy 210×297mm; lề 12mm, chữ mẫu lớn trái, hai hàng ô luyện bên phải. Ô 12/15/18mm, năm kiểu lưới; màu giấy/chữ/lưới cập nhật ngay trên bản xem.
- Xuất PDF vector client-side bằng `pdf-lib` + `@pdf-lib/fontkit`, nhúng Klee One đầy đủ và tập con Noto Sans tự lưu trữ; giữ Klee One đầy đủ để tránh mất glyph khi subset. SVG Kanji/Kana giữ đúng hình nét fill/stroke; thiếu SVG báo chuyển font, thiếu glyph font chặn xuất.
- Tối đa 100 chữ khác nhau, NFC; chặn ký tự không hỗ trợ và dữ liệu mẫu chưa khớp nội dung nhập. Lỗi có thử lại; thông báo tương phản thấp không cấm màu tùy chọn.
- Bản xem dùng chung tọa độ với PDF, ghi rõ font/xuống dòng có thể khác. In 100%; giấy trắng tiết kiệm mực. Nguồn/giấy phép ở `/handwriting/licenses` và đính kèm PDF.

## Do's and Don'ts

- Giữ tiếng Việt cho thao tác, nguyên văn tiếng Nhật cho nội dung nguồn; không tự tạo lời giải hay nghe hiểu.
- Dùng semantic HTML, radio, focus sau chuyển câu; hỗ trợ bàn phím và `prefers-reduced-motion`.
- Dùng màu theo ý nghĩa, không thêm gradient/kicker/ảnh trang trí không phục vụ việc học.
- Kiểm tra cả theme sáng/tối, 320px và desktop với nội dung dài thật trước khi bàn giao.
