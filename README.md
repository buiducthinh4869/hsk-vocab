# Ôn từ HSK

Web ôn từ vựng tiếng Trung HSK 1–3 (hệ HSK 2.0, bảng từ 2012) theo hộp Leitner. Không cần đăng nhập; tiến độ lưu vào Google Sheet qua Google Apps Script.

- Web: https://buiducthinh4869.github.io/hsk-vocab/
- Giao diện: HTML/CSS/JS thuần trong `web/`; dữ liệu sinh từ `data-src/` bằng `npm run build`.
- API: Apps Script trong `gas/` (URL ghi trong `web/config.js`).

## Nguồn dữ liệu và giấy phép

Xem `data-src/sources/SOURCES.md`. Danh sách từ: Hanban HSK 2012, bản số hóa drkameleon/complete-hsk-vocabulary (MIT). Nghĩa đối chiếu CC-CEDICT (CC BY-SA 4.0); tần suất SUBTLEX-CH (Cai & Brysbaert, 2010); Hán Việt theo Unihan (Unicode License). Nghĩa tiếng Việt, câu mẫu và bài tập do dự án tự soạn.

## Triển khai

- Web: push lên `main`, GitHub Actions chạy build + test rồi đăng `web/` lên Pages.
- API: `npm run deploy:gas` (clasp push + cập nhật deployment cố định trong `.deployment-id`, giữ nguyên URL).
- Lần đầu: chạy `setup()` trong trình soạn thảo Apps Script để cấp quyền và tạo Sheet.
- Kiểm tra: `npm test`.
