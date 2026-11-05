// Check data-src/plan.json against hsk-official.json and write data-src/PROGRESS.md.
// Status: "xong" = topic listed in index.json; "đang làm" = authored file exists; else "chưa làm".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const plan = read('data-src/plan.json');
const official = read('data-src/sources/hsk-official.json').words;
const index = read('data-src/index.json');
const done = new Set(index.levels.flatMap((l) => l.topics));
const problems = [];
const hvOf = (h) => {
  const exact = official.find((w) => w.hanzi === h);
  if (exact) return exact.hv.map((r) => r.join('/') || '—').join(' ');
  const o = official.find((w) => w.hanzi.includes(h));
  return o ? o.hv[[...o.hanzi].indexOf(h)].join('/') || '—' : '—';
};
const rows = [];
const checks = [];
for (const [level, topics] of Object.entries(plan.levels)) {
  const want = new Set(official.filter((w) => w.hsk2 === Number(level)).map((w) => w.hanzi));
  const seen = new Map();
  for (const t of topics) {
    const words = t.words.split(/\s+/);
    for (const h of words) {
      if (!want.has(h)) problems.push(`HSK${level} ${t.id}: ${h} không có ở cấp ${level}`);
      if (seen.has(h)) problems.push(`HSK${level}: ${h} trùng (${seen.get(h)}, ${t.id})`);
      seen.set(h, t.id);
    }
    const file = path.join(root, 'data-src/topics', `${t.id}.json`);
    const status = done.has(t.id) ? 'xong' : fs.existsSync(path.join(root, 'data-src/authored', `${t.id}.txt`)) || fs.existsSync(file) ? 'đang làm' : 'chưa làm';
    let ex = '';
    if (fs.existsSync(file)) {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      const n = (k) => d.exercises.filter((e) => e.type === k).length;
      ex = `${n('fill')} fill, ${n('order')} order`;
      for (const w of d.words) if (w.check) checks.push(`| ${level} | ${t.id} | ${w.hanzi} | ${w.pinyin} | ${w.hanViet ?? '—'} |`);
      if (d.words.length !== words.length) problems.push(`${t.id}: file có ${d.words.length} từ, kế hoạch ${words.length}`);
      const miss = words.filter((h) => !d.words.some((w) => w.hanzi === h));
      if (miss.length) problems.push(`${t.id}: thiếu ${miss.join(' ')}`);
    }
    rows.push(`| ${level} | ${t.id} | ${t.title} | ${words.length} | ${ex} | ${status} | ${t.words} |`);
  }
  for (const h of want) if (!seen.has(h)) problems.push(`HSK${level}: chưa xếp ${h}`);
  rows.push(`| ${level} | **Cộng** | | **${seen.size} / ${want.size}** | | | |`);
}
const md = `# Tiến độ soạn dữ liệu

File này do \`node scripts/progress.js\` sinh ra từ \`data-src/plan.json\`; sửa kế hoạch trong plan.json rồi chạy lại.
Phiên làm việc mới: làm tiếp chủ đề đầu tiên có trạng thái khác "xong", theo các bước trong UPDATE.md.

## Chủ đề

| Cấp | id | Chủ đề | Số từ | Bài tập | Trạng thái | Chữ Hán |
|---|---|---|---|---|---|---|
${rows.join('\n')}

## Quyết định tự đưa ra

${plan.decisions.map((d) => `- ${d}`).join('\n')}

## Từ cần xem lại (\`check: true\`)

Lý do thường gặp: chữ có nhiều âm Hán Việt (đã chọn âm thông dụng), từ có nhiều âm đọc, không có trong SUBTLEX-CH.

| Cấp | Chủ đề | Từ | Pinyin | Hán Việt |
|---|---|---|---|---|
${checks.join('\n')}

## Âm Hán Việt cần xem

Unihan ghi âm khác âm Hán Việt thường gặp. Web đang hiện âm theo Unihan.

| Chữ | Unihan | Âm thường gặp |
|---|---|---|
${Object.entries(plan.hvSuggest || {}).map(([h, v]) => `| ${h} | ${hvOf(h)} | ${v} |`).join('\n')}

## Lỗi giao diện ghi nhận

${(plan.uiIssues || ['(chưa có)']).map((d) => `- ${d}`).join('\n')}
`;
fs.writeFileSync(path.join(root, 'data-src/PROGRESS.md'), md);
if (problems.length) { console.error('Kế hoạch có vấn đề:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('PROGRESS.md OK');
