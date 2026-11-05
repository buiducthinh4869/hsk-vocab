# Thêm dữ liệu mới

Kế hoạch chủ đề nằm trong `data-src/plan.json`; tiến độ trong `data-src/PROGRESS.md` (sinh bằng `node scripts/progress.js`).

Khi thêm một chủ đề:

1. Soạn `data-src/authored/<id>.txt` theo định dạng ghi ở đầu `scripts/author.js`: mỗi từ một dòng `@chữ | nghĩa; nghĩa | u: cách dùng | c: từ dễ nhầm`, câu mẫu `- 中文 = tiếng Việt` (từ đang học đặt trong `*...*`), bài `F` (điền từ) và `O` (sắp xếp câu).
2. `node scripts/author.js data-src/authored/<id>.txt`: tạo `data-src/topics/<id>.json`, điền pinyin, id, Hán Việt, ★, từ loại, lượng từ từ `hsk-official.json`, và tự sinh pinyin câu mẫu. Đọc các dòng "Cần xem" mà lệnh in ra; từ nhiều âm thì ghi âm sau chữ (`@长 cháng`), câu có chữ nhiều âm theo ngữ cảnh thì thêm dòng `  py: ...` dưới câu.
3. Thêm id chủ đề vào `data-src/index.json`.
4. `npm run build` và `npm test`. Build không được có lỗi hay cảnh báo (câu vượt cấp, câu trùng chủ đề khác).
5. `node scripts/progress.js`, commit `Thêm dữ liệu: HSK <cấp> – <chủ đề>`, push. GitHub Actions tự triển khai; link không đổi.

Bài giáo trình: chỉ điền `textbooks.chuan` (dạng `HSK1-B5`) từ ảnh trang 生词, ghi vào `data-src/sources/textbooks.json`.

Không đổi `id` của từ đã có, vì tiến độ gắn với `id`. `author.js` giữ id cũ khi chạy lại.
