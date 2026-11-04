// Validate data-src/ and generate web/data/*.json. Exits with a clear error list on any problem.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from '../web/modules/pinyin.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const index = read('data-src/index.json');
const official = read('data-src/sources/hsk-official.json').words;
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

const levels = [];
const allWords = new Map();
const allEx = new Set();
for (const lv of index.levels) {
  const topics = [];
  for (const tid of lv.topics) {
    const file = `data-src/topics/${tid}.json`;
    if (!fs.existsSync(path.join(root, file))) { err(file, 'missing file'); continue; }
    const t = read(file);
    if (t.id !== tid) err(file, `id "${t.id}" differs from file name`);
    if (t.level !== lv.level) err(file, `level ${t.level} differs from index.json (${lv.level})`);
    for (const w of t.words) {
      const at = `${tid}/${w.id || w.hanzi}`;
      if (!w.id || !/^[a-z0-9ü-]+$/.test(w.id)) err(at, 'invalid id');
      if (allWords.has(w.id)) err(at, `duplicate id (also in ${allWords.get(w.id).topicId})`);
      allWords.set(w.id, { ...w, topicId: tid });
      const a = parse(w.pinyin), b = parse(w.pinyinNum);
      if (a.letters !== b.letters || a.tones.join() !== b.tones.join()) err(at, `pinyin "${w.pinyin}" ≠ pinyinNum "${w.pinyinNum}"`);
      const off = official.find((o) => o.hanzi === w.hanzi && o.hsk2 === w.hsk2);
      if (!off) err(at, `hsk2=${w.hsk2} not in hsk-official.json`);
      if (w.hsk2 !== t.level) err(at, `hsk2=${w.hsk2} but topic level ${t.level}`);
      if (!Array.isArray(w.meaning) || !w.meaning.length || w.meaning.length > 3) err(at, 'meaning must have 1–3 items');
      if (w.common != null && ![1, 2, 3].includes(w.common)) err(at, 'common must be 1–3');
      for (const e of w.examples || []) if (!/\*[^*]+\*/.test(e.zh) || !e.py || !e.vi) err(at, `example needs *word*, py, vi: ${e.zh}`);
    }
    for (const e of t.exercises || []) {
      const at = `${tid}/${e.id}`;
      if (allEx.has(e.id)) err(at, 'duplicate exercise id');
      allEx.add(e.id);
      if (e.type === 'fill') {
        if (!e.sentence.includes('{0}')) err(at, 'sentence needs {0}');
        if (!e.options.includes(e.answer)) err(at, 'answer not in options');
        if (new Set(e.options).size !== e.options.length) err(at, 'duplicate options');
      } else if (e.type === 'order') {
        const key = (arr) => [...arr].sort().join('|');
        for (const ans of e.answers) if (key(ans) !== key(e.chunks)) err(at, `answer ${ans.join('')} does not use exactly the chunks`);
      } else err(at, `unknown type ${e.type}`);
    }
    topics.push(t);
  }
  levels.push({ level: lv.level, title: lv.title, topics });
}
// references (checked after all words are known)
for (const lv of levels) for (const t of lv.topics) {
  for (const w of t.words) for (const c of w.confusables || []) if (!allWords.has(c)) err(`${t.id}/${w.id}`, `confusable "${c}" not found`);
  for (const e of t.exercises || []) for (const x of e.targets) if (!allWords.has(x)) err(`${t.id}/${e.id}`, `target "${x}" not found`);
}
if (errors.length) { console.error(`Build failed (${errors.length}):\n- ` + errors.join('\n- ')); process.exit(1); }

const outDir = path.join(root, 'web/data');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));
const meta = { levels: [] };
for (const lv of levels) {
  const body = JSON.stringify({ level: lv.level, topics: lv.topics.sort((a, b) => a.order - b.order) });
  const v = crypto.createHash('sha1').update(body).digest('hex').slice(0, 8);
  if (lv.topics.length) fs.writeFileSync(path.join(outDir, `hsk${lv.level}.json`), body);
  meta.levels.push({ level: lv.level, title: lv.title, v, words: lv.topics.reduce((n, t) => n + t.words.length, 0),
    topics: lv.topics.map((t) => ({ id: t.id, title: t.title, order: t.order, words: t.words.length })) });
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(meta));
console.log('Build OK:', meta.levels.map((l) => `HSK${l.level} ${l.words} từ / ${l.topics.length} chủ đề`).join(', '));
