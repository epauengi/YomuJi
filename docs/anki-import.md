# Nhập Anki vào Thẻ từ

Mở `/flashcards` → **Nhập Anki (.apkg)** → chọn file → chọn loại ghi chú và các trường từ / cách đọc / nghĩa → xem trước → nhập thành bộ thẻ mới.

- File xử lý trên thiết bị trong Web Worker; không tải file lên máy chủ.
- Nhập nội dung chữ từ `.apkg` cũ (`collection.anki2`, `collection.anki21`) và mới (`collection.anki21b`, Zstandard).
- Mỗi ghi chú tạo một thẻ YomuJi. Một lần nhập chọn một loại ghi chú; không sao chép các thẻ đảo chiều do template Anki sinh ra.
- Không nhập template, JavaScript, CSS, ảnh, âm thanh hoặc lịch ôn. HTML chuyển thành chữ thuần; dùng phát âm sẵn có của YomuJi.
- Không hỗ trợ Cloze. Xuất/chuyển sang ghi chú từ–nghĩa thông thường trước khi nhập.
- Không ghi đè bộ thẻ cũ. Nhập cùng file lần nữa tạo thêm bộ thẻ mới.
- Giới hạn: file 50 MiB; collection sau giải nén 32 MiB; dữ liệu chữ trả về tối đa 8 MiB; tối đa 10.000 ghi chú. Thiết bị lưu tối đa 100 bộ / 10.000 thẻ, còn phụ thuộc dung lượng localStorage.
- Từ tối đa 100 ký tự, cách đọc 200, nghĩa 1.000. Ghi chú không hợp lệ bị báo lỗi; không tự bỏ qua hoặc cắt nội dung.
- Dữ liệu chỉ lưu trong trình duyệt. Xóa dữ liệu trình duyệt sẽ xóa bộ thẻ; giữ lại file Anki gốc.

## Nguồn nghiên cứu

- [Anki Manual — Exporting](https://docs.ankiweb.net/exporting.html): gói `.apkg`, media và tương thích phiên bản.
- [Anki package metadata](https://github.com/ankitects/anki/blob/main/rslib/src/import_export/package/meta.rs): tên collection, schema và Zstandard.
- [Anki schema 11](https://github.com/ankitects/anki/blob/main/rslib/src/storage/schema11.sql): bảng notes và trường `flds`.
- [Anki schema 15 migration](https://github.com/ankitects/anki/blob/main/rslib/src/storage/upgrades/schema15_upgrade.sql): bảng `fields`, `notetypes` mới.
- [Anki — Cloze deletion](https://docs.ankiweb.net/editing.html#cloze-deletion): khác biệt giữa ghi chú và thẻ Cloze.
- [fflate](https://github.com/101arrowz/fflate), [sql.js](https://github.com/sql-js/sql.js), [fzstd](https://github.com/101arrowz/fzstd): ZIP, SQLite WebAssembly và Zstandard trong trình duyệt.

## SQLite WebAssembly

`public/anki/sql-wasm.wasm` được sao chép từ bản `sql.js` trong lockfile. Khi nâng `sql.js`, sao chép lại file này và giữ `public/anki/LICENSE-sql.js.txt` cùng bản phát hành. Không dùng CDN khi nhập.

Kiểm tra: `node scripts/check-anki-package.cjs`, `node scripts/check-anki-import.cjs`, `node scripts/check-anki-wasm.cjs`, `node scripts/check-flashcards.cjs`. Kiểm tra mapping bằng Node chỉ dùng văn bản thuần; chuyển HTML và luồng nhập được kiểm tra thêm trên trình duyệt.
