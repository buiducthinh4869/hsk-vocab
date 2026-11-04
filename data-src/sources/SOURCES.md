# Nguồn dữ liệu

Ngày truy cập chung: 04/11/2026.

| Bậc | Nguồn | Phiên bản | URL | Dùng cho |
|---|---|---|---|---|
| 1 | Hanban, 新汉语水平考试大纲 HSK 1–6, bảng từ bản 2012 (150 / 150 / 300 từ) | 2012 | (chưa có bản PDF 2012; xem mục Kiểm tra) | Danh sách từ, cấp HSK 2.0 |
| 1 | Hanban, 新汉语水平考试（HSK）一级大纲, 二级大纲 (PDF) | 2009 | http://jyangkul.net/HSK/dagang%20HSK%201.pdf · http://jyangkul.net/HSK/dagang%20HSK%202.pdf | Kiểm tra; pinyin và từ loại chính thức của HSK 1 (144/150 từ) |
| Bản làm việc | drkameleon/complete-hsk-vocabulary (MIT), `complete.json`, thẻ `old-1..3`, `new-*` | commit 7ac65bf1a6 (23/03/2026) | https://github.com/drkameleon/complete-hsk-vocabulary | Danh sách từ, pinyin, từ loại, lượng từ; cấp HSK 3.0 tham khảo (thẻ `new-*`, 7 = cấp 7–9) |
| 2 | HSK 标准教程 1–3 (NXB ĐH Ngôn ngữ Bắc Kinh) | — | — | Số bài: chưa có (chờ ảnh trang 生词) |
| 3 | CC-CEDICT (MDBG) | bản xuất 04/11/2026 | https://www.mdbg.net/chinese/dictionary?page=cc-cedict | Đối chiếu nghĩa |
| 3 | SUBTLEX-CH-WF (Cai & Brysbaert, 2010) | 2010 | https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexch | Độ thông dụng |
| 3 | Unihan `kVietnamese`, `kTraditionalVariant` (Unicode) | 31/07/2026 | https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip | Âm Hán Việt |

## Cách tính các trường

- `hsk2`: thẻ `old-*` thấp nhất. `hsk3`: thẻ `new-*` thấp nhất, chỉ để tham khảo, không đối chiếu với bản HSK 3.0 khác.
- `pinyin`, `pos` (HSK 1): theo PDF 2009 khi từ có trong PDF; còn lại theo bản làm việc và đặt `check: true`.
- `hanViet`: Unihan `kVietnamese` của chữ giản thể, nếu không có thì của chữ phồn thể (`kTraditionalVariant`). Chữ có nhiều âm: chọn âm thông dụng trong từ, `check: true`. Chữ không có âm: `hanViet: null`, `check: true`.
- `common`: số lần xuất hiện (WCount) trong SUBTLEX-CH, chia 3 phần bằng nhau trong phạm vi 595 mục HSK 1–3: ≥ 11029 → 3, ≥ 2385 → 2, còn lại 1 (ngưỡng ghi trong `hsk-official.json` → `meta.derived`). Không có trong SUBTLEX: `null`, `check: true`.
- `textbooks`: `null` cho đến khi có ảnh trang 生词.
- Nghĩa tiếng Việt, cách dùng, câu mẫu, bài tập: tự soạn, đối chiếu nghĩa với CC-CEDICT.

## Kiểm tra bản làm việc với PDF chính thức

Số mục trong bản làm việc: HSK 1 = 150, HSK 2 = 150 thẻ / 147 mục, HSK 3 = 299 thẻ / 298 mục (thiếu 1 so với 300; PDF HSK 3 là bản scan, chưa kiểm tra được).

Kiểm tra ngẫu nhiên 30 từ (15 HSK 1, 15 HSK 2, seed 2012) với PDF 2009: 29/30 khớp. Từ lệch: 饭馆 (PDF 2009 ghi 饭店).

So toàn bộ cấp 1–2 với PDF 2009. Các chỗ lệch là thay đổi của bản 2012 so với 2009, không phải lỗi dữ liệu; giữ theo bản 2012:

- HSK 1, có trong bản 2012 nhưng không có trong PDF 2009: 饭馆 (thay 饭店), 分钟, 漂亮, 喂. 打电话 bị tách thành 打 + 电话 khi trích chữ.
- HSK 2, có trong bản 2012 nhưng không có trong PDF 2009: 报纸, 打篮球, 懂, 卖, 门, 手机. PDF 2009 có 足球, 对, 等, 过 ở cấp 2.
- 得, 还, 长: bản làm việc gắn `old-2` hai lần; PDF 2009 liệt kê mỗi chữ một lần (得 de, 还 hái, 长 cháng). Giữ một mục mỗi chữ, âm còn lại ghi ở `usage`.
- 只 (HSK 3): bản làm việc gắn `old-3` hai lần; chưa kiểm tra được với PDF.

## Nguồn không truy cập được

- chinesetest.cn: chặn bằng captcha; không tìm cách vượt.
- PDF bảng từ bản 2012: chưa tìm được.
