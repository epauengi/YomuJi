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
  japanese:
    fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif'
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

Tiếng Việt dùng `--font-sans`; tiếng Nhật dùng `lang="ja"` và `.jp-text` / `--font-jp`. `--font-serif` và `--font-book-heading` dành cho nội dung đọc hiện hữu, không tự chuyển tiêu đề JLPT sang serif.

JLPT: h1 `clamp(1.75rem, 3vw, 2.4rem)`, weight 720, line-height 1.2, tracking -0.03em. Đoạn đọc 16px desktop / 15px mobile, weight 400, line-height 2.15 / 2.1. Câu hỏi 21px / 19px; lựa chọn 17px / 16px. Đồng hồ, điểm, số câu dùng tabular numerals.

## Layout

Shell hiện hữu dùng `max-w-7xl` và padding responsive. Các số sau chỉ áp dụng `/jlpt`, không phải token toàn sản phẩm:

- Container tối đa 1168px. Catalog desktop: cột chọn phần 245px, danh sách 10 đề bên phải; tablet 210px; dưới 768px phần luyện xếp ngang, danh sách một cột.
- Workspace desktop: câu hỏi + phiếu trả lời 280px; phiếu sticky cách đỉnh 88px. Mobile đặt phiếu sau câu hỏi.
- Phiếu: 5 cột desktop, 7 cột mobile, 6 cột dưới 360px. Giữ đủ khoảng cuối trang để điều hướng di động không che nội dung khi cuộn.

## Elevation & Depth

JLPT dùng mặt phẳng và viền 1px, không bóng trang trí. Dropdown/dialog hiện hữu dùng `--shadow-xs` đến `--shadow-lg`; không thêm bóng lên mọi khối. Giữ outline focus rõ trong cả hai theme.

## Shapes

Global: radius 8/12/16/20px và pill 9999px. JLPT: panel 16px desktop / 14px mobile, lựa chọn 10px, chỉ số đáp án tròn 26px. Không biến các kích thước cục bộ thành quy tắc chung.

## Components

- **Nút:** hành động chính teal; phụ nền surface + viền; hover/focus/disabled rõ. Nút hành động JLPT tối thiểu 44px; câu trả lời 61px desktop / 56px mobile. Ô phiếu hiện dùng 39px, không thu nhỏ thêm.
- **Chọn đáp án:** radio native, nhãn bao toàn hàng; focus bàn phím hiện trên hàng. Chỉ hiện đúng/sai sau POST nộp bài.
- **JLPT:** dealt-2 chọn phần trước; N2 có 10 đề, các cấp khác “Sắp có”. Luyện từng phần không giới hạn giờ; thi thử ghép cùng số đề, chung 105 phút. Kết quả là số câu đúng, không phải điểm JLPT chính thức.
- **Trạng thái:** lỗi tải có cách thử lại; lỗi nộp giữ câu trả lời. Hết giờ khóa đáp án, tự nộp một lần; lỗi mạng cho nộp lại. Không lưu tiến độ qua lần rời trang; cảnh báo trước khi bỏ bài.

## Do's and Don'ts

- Giữ tiếng Việt cho thao tác, nguyên văn tiếng Nhật cho nội dung nguồn; không tự tạo lời giải hay nghe hiểu.
- Dùng semantic HTML, radio, focus sau chuyển câu; hỗ trợ bàn phím và `prefers-reduced-motion`.
- Dùng màu theo ý nghĩa, không thêm gradient/kicker/ảnh trang trí không phục vụ việc học.
- Kiểm tra cả theme sáng/tối, 320px và desktop với nội dung dài thật trước khi bàn giao.
