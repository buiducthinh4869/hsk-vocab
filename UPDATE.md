# Thêm dữ liệu mới

Khi có yêu cầu "Thêm chủ đề X của HSK n" hoặc "Thêm các từ bài k Giáo trình chuẩn HSK n":

1. Chọn từ trong `data-src/sources/hsk-official.json` (đúng cấp `hsk2`). Tạo `data-src/topics/<id>.json` chỉ với phần tự soạn: `hanzi`, `meaning`, `usage`, `examples`, `confusables` (viết bằng chữ Hán), bài `exercises` (ít nhất 4 `fill`, 3 `order`).
2. `node scripts/fill-topic.js data-src/topics/<id>.json` để điền pinyin, id, Hán Việt, ★, từ loại, lượng từ. Từ có nhiều âm: ghi `"pinyin"` bằng tay.
3. Thêm id chủ đề vào `data-src/index.json`.
4. `npm run build` và `npm test`. Lỗi thì sửa hoặc báo lại.
5. In 10 từ mẫu để duyệt.
6. Commit `Thêm dữ liệu: <cấp> – <chủ đề>`, push. GitHub Actions tự triển khai; link không đổi.

Bài giáo trình: chỉ điền `textbooks.chuan` (dạng `HSK1-B5`) từ ảnh trang 生词.

Không đổi `id` của từ đã có, vì tiến độ gắn với `id`.
