// Convert an authored topic (data-src/authored/<id>.txt) into data-src/topics/<id>.json, then fill it.
// Usage: node scripts/author.js data-src/authored/<id>.txt
//
// Format (one item per line; "|" separates fields):
//   # id: hsk2-xxx            # level: 2            # title: ...            # order: 1
//   @哥哥 | anh trai; anh | u: usage note | c: 弟弟 姐姐 | py: gēge | hv: ca ca | pos: n | mw: 个 ("-" = none)
//   - 我*哥哥*是医生。 = Anh trai tôi là bác sĩ.
//     py: hand-written pinyin (only when the automatic one is wrong)
//   F 我{0}去过北京。 | 没* 不 很 都 | t: 没 | e: explanation
//   O 我 明天 去 北京 | vi: Ngày mai tôi đi Bắc Kinh. | t: 明天 | alt: 明天 我 去 北京
//     (chunks in the main correct order; alt: other correct orders separated by " / ")
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2]);
const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const meta = {};
const words = [];
const exercises = [];
const fields = (s) => {
  const [head, ...rest] = s.split(' | ');
  const kv = {};
  for (const r of rest) { const m = r.match(/^(\w+):\s*(.*)$/); if (m) kv[m[1]] = m[2].trim(); else kv._ = (kv._ ? kv._ + ' | ' : '') + r.trim(); }
  return { head: head.trim(), kv };
};
let last = null;
for (const raw of lines) {
  const line = raw.trimEnd();
  if (!line.trim()) continue;
  let m;
  if ((m = line.match(/^#\s*(\w+):\s*(.*)$/))) { meta[m[1]] = m[2].trim(); continue; }
  if (line.startsWith('@')) {
    const { head, kv } = fields(line.slice(1));
    const [hanzi, pinyin] = head.split(/\s+/);
    const w = { hanzi, meaning: kv._.split(';').map((x) => x.trim()).filter(Boolean) };
    if (pinyin || kv.py) w.pinyin = pinyin || kv.py;
    if (kv.u) w.usage = kv.u;
    if (kv.hv) w.hanViet = kv.hv === 'null' ? null : kv.hv;
    if (kv.pos) w.pos = kv.pos.split(/\s+/);
    if (kv.check) w.check = true;
    if (kv.mw) w.measureWords = kv.mw === "-" ? [] : kv.mw.split(/\s+/);
    w.confusables = kv.c ? kv.c.split(/\s+/) : [];
    w.examples = [];
    words.push(w);
    last = w;
    continue;
  }
  if (line.startsWith('- ')) {
    const i = line.indexOf(' = ');
    if (i < 0) throw new Error(`example needs " = ": ${line}`);
    last.examples.push({ zh: line.slice(2, i).trim(), vi: line.slice(i + 3).trim() });
    continue;
  }
  if ((m = line.match(/^\s+py:\s*(.*)$/))) { last.examples[last.examples.length - 1].py = m[1].trim(); continue; }
  if (line.startsWith('F ')) {
    const { head, kv } = fields(line.slice(2));
    const opts = kv._.split(/\s+/);
    const answer = (opts.find((o) => o.endsWith('*')) || '').slice(0, -1);
    if (!answer) throw new Error(`fill needs an answer marked *: ${line}`);
    exercises.push({ type: 'fill', sentence: head, options: opts.map((o) => o.replace(/\*$/, '')), answer,
      targets: (kv.t || answer).split(/\s+/), ...(kv.e ? { explanation: kv.e } : {}) });
    continue;
  }
  if (line.startsWith('O ')) {
    const { head, kv } = fields(line.slice(2));
    const chunks = head.split(/\s+/);
    const answers = [chunks, ...(kv.alt ? kv.alt.split(' / ').map((a) => a.trim().split(/\s+/)) : [])];
    exercises.push({ type: 'order', chunks, answers, targets: (kv.t || '').split(/\s+/).filter(Boolean), vi: kv.vi });
    continue;
  }
  throw new Error(`cannot parse: ${line}`);
}
for (const k of ['id', 'level', 'title', 'order']) if (!meta[k]) throw new Error(`missing "# ${k}:"`);
let nf = 0, no = 0;
for (const e of exercises) e.id = e.type === 'fill' ? `${meta.id}-fill-${String(++nf).padStart(2, '0')}` : `${meta.id}-order-${String(++no).padStart(2, '0')}`;

// keep ids (and reviewed words) already in the generated file
const out = path.join(root, 'data-src/topics', `${meta.id}.json`);
if (fs.existsSync(out)) {
  const prev = JSON.parse(fs.readFileSync(out, 'utf8'));
  for (const w of words) {
    const p = prev.words.find((x) => x.hanzi === w.hanzi);
    if (!p) continue;
    if (p.reviewed) { Object.assign(w, p); continue; }
    w.id = p.id;
  }
}
const topic = { id: meta.id, level: Number(meta.level), title: meta.title, order: Number(meta.order), words, exercises };
fs.writeFileSync(out, JSON.stringify(topic, null, 2) + '\n');
execFileSync(process.execPath, [path.join(root, 'scripts/fill-topic.js'), out], { stdio: 'inherit' });
