# Tra từ bằng ảnh

Mở **Tra từ bằng ảnh** (`/ocr`) từ menu. Chụp hoặc tải ảnh JPG, PNG hay WebP (tối đa 10 MiB). Kéo để chọn vùng chữ hoặc dùng ô phần trăm. Chỉ vùng được chọn được gửi đến Google Cloud Vision khi bấm **Nhận dạng ảnh**. YomuJi không lưu ảnh hay nội dung nhận dạng trên máy chủ. Sửa lại văn bản rồi bấm **Tách từ để tra nghĩa** (tối đa 500 ký tự mỗi đoạn).

## Bật OCR

1. Bật Cloud Vision API và billing trên Google Cloud. Giới hạn API key cho Cloud Vision API. Đặt `GOOGLE_CLOUD_VISION_API_KEY` trong `.env.local` hoặc secrets của môi trường triển khai; không dùng tiền tố `NEXT_PUBLIC_` cho bất kỳ biến OCR nào.
2. Trên production, đặt `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` cho Redis dùng chung. OCR dừng nếu thiếu cấu hình hoặc Redis lỗi. Tối đa 30 lượt chuyển tới Vision mỗi ngày UTC, dùng chung cho mọi người. Trên máy phát triển có thể bỏ cả hai biến Upstash.
3. Trước khi công khai, đặt quota phía Google và giới hạn lưu lượng `/api/ocr` tại gateway để tránh một người dùng hết quota chung. Kiểm tra reverse proxy ghi đè `X-Forwarded-Host`/`X-Forwarded-Proto`, không chuyển tiếp giá trị từ client. Chọn môi trường chạy hỗ trợ thời gian xử lý 35 giây và giới hạn thời gian tải request. 1.000 đơn vị miễn phí mỗi tháng không phải giới hạn chi tiêu.

`POST /api/ocr` chỉ nhận JPEG hoặc PNG dung lượng tối đa 2 MiB. Giao diện nén lại vùng ảnh, không gửi metadata của ảnh gốc. Khi gọi API trực tiếp, hãy xóa metadata riêng tư trước; API chuyển tiếp dữ liệu ảnh đến Google Cloud Vision.

## Kiểm thử bằng ảnh thật

Dùng ảnh tự chụp hoặc được phép dùng: một câu ngang, một cột dọc, một đoạn có furigana, một ảnh mờ, một ảnh không có chữ. Đối chiếu văn bản gốc, thứ tự đọc và furigana bị chèn vào dòng chính. Ghi thời gian phản hồi và trường hợp phải sửa tay; thử lại sau khi khoanh vùng nhỏ hơn. Kiểm tra luồng từ văn bản đã sửa đến kết quả tra nghĩa, kể cả khi OCR không trả chữ. Không kết luận chất lượng chữ dọc hoặc furigana từ test giả lập.
