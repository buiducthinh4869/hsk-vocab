// Fill source-derived fields of a topic file from data-src/sources/hsk-official.json.
// Usage: node scripts/fill-topic.js data-src/topics/hsk1-xxx.json
// Authored fields (meaning, usage, examples, confusables, exercises) are kept.
// Existing ids are never changed. A field set by hand (e.g. "pinyin", "hanViet") is kept.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, marksToNum } from '../web/modules/pinyin.js';
import { loadLexicon } from './lib/lexicon.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.resolve(process.argv[2]);
const topic = JSON.parse(fs.readFileSync(file, 'utf8'));
const official = JSON.parse(fs.readFileSync(path.join(root, 'data-src/sources/hsk-official.json'), 'utf8')).words;
const topicsDir = path.join(root, 'data-src/topics');
const usedIds = new Set();
for (const f of fs.readdirSync(topicsDir)) {
  if (path.join(topicsDir, f) === file) continue;
  for (const w of JSON.parse(fs.readFileSync(path.join(topicsDir, f), 'utf8')).words) usedIds.add(w.id);
}

const errors = [];
const hvNotes = [];
const hvSuggest = JSON.parse(fs.readFileSync(path.join(root, "data-src/plan.json"), "utf8")).hvSuggest || {};
topic.words = topic.words.map((w) => {
  const off = official.find((o) => o.hanzi === w.hanzi && o.hsk2 === topic.level) || official.find((o) => o.hanzi === w.hanzi);
  if (!off) { errors.push(`${w.hanzi}: not in hsk-official.json`); return w; }
  let check = !!w.check;
  let pinyin = w.pinyin || off.offPinyin;
  // surname / place-name forms (capitalised) are dropped when a lower-case reading exists
  const all = off.forms.map((f) => f.pinyin.normalize('NFC'));
  const uniq = [...new Set(all.filter((p) => p === p.toLowerCase() || !all.includes(p.toLowerCase())))];
  if (!pinyin) {
    if (uniq.length > 1) { errors.push(`${w.hanzi}: several readings ${uniq.join(' | ')}; set "pinyin" by hand`); return w; }
    pinyin = uniq[0].replace(/ /g, '');
  }
  if (off.hsk2 === 1 && !off.offPinyin) check = true; // HSK 1: pinyin not confirmed by the official PDF
  if (!off.offPinyin && uniq.length > 1) { check = true; hvNotes.push(`${w.hanzi}: âm chọn ${pinyin} (có ${uniq.join(' | ')})`); }
  const letters = parse(pinyin).letters;
  const form = off.forms.find((f) => parse(f.num).letters === letters);
  const syllables = form ? form.num.toLowerCase().replace(/u:/g, 'ü').split(' ').map((s) => s.replace(/\d/g, '')) : null;
  const pinyinNum = w.pinyinNum || (syllables && marksToNum(pinyin, syllables));
  if (!pinyinNum) { errors.push(`${w.hanzi}: cannot split "${pinyin}"; set "pinyinNum" by hand`); return w; }

  let id = w.id;
  if (!id) {
    const base = pinyinNum.replace(/ /g, '');
    id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  }
  usedIds.add(id);

  let hanViet = w.hanViet;
  if (!('hanViet' in w)) {
    if (off.hv.some((r) => r.length === 0)) { hanViet = null; check = true; }
    else { hanViet = off.hv.map((r) => r[0]).join(' '); if (off.hv.some((r) => r.length > 1)) { check = true; hvNotes.push(`${w.hanzi}: HV ${off.hv.map((r) => r.join('/')).join(' ')} -> ${hanViet}`); } }
  } else if (hanViet === null || off.hv.some((r) => r.length !== 1)) check = true;

  const pos = w.pos || off.offPos || off.posS;
  if (!pos || !pos.length) errors.push(`${w.hanzi}: no part of speech; set "pos" by hand`);
  if (hvSuggest[w.hanzi] || [...w.hanzi].some((c) => hvSuggest[c])) check = true; // Unihan reading differs from the usual Hán Việt reading
  const mw = w.measureWords || [...new Set(off.forms.flatMap((f) => f.cl))];
  if (off.common == null) check = true;
  return {
    id, hanzi: w.hanzi, pinyin, pinyinNum, hanViet, pos,
    hsk2: off.hsk2, hsk3: off.hsk3, common: off.common,
    meaning: w.meaning, usage: w.usage || '', measureWords: pos.includes('n') ? mw : [],
    examples: w.examples || [], textbooks: w.textbooks ?? null, confusables: w.confusables || [], check,
  };
});

// confusables / targets may be written as hanzi; convert to ids
const byHanzi = new Map();
for (const f of fs.readdirSync(topicsDir)) {
  const t = path.join(topicsDir, f) === file ? topic : JSON.parse(fs.readFileSync(path.join(topicsDir, f), 'utf8'));
  for (const w of t.words) if (w.id && !byHanzi.has(w.hanzi)) byHanzi.set(w.hanzi, w.id);
}
// a confusable may point to a topic not written yet: keep the hanzi, build fails until it is resolved
const pending = [];
const toId = (x) => (/[\u4e00-\u9fff]/.test(x) ? byHanzi.get(x) || (pending.push(x), x) : x);
for (const w of topic.words) w.confusables = (w.confusables || []).map(toId);
for (const e of topic.exercises || []) e.targets = e.targets.map(toId);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
fs.writeFileSync(file, JSON.stringify(topic, null, 2) + '\n');
// example pinyin (only where not written by hand)
const lex = loadLexicon(root);
const pyNotes = [];
for (const w of topic.words) for (const e of w.examples) {
  if (e.py) continue;
  const r = lex.sentencePinyin(e.zh);
  e.py = r.py;
  if (r.notes.length) pyNotes.push(`${e.zh} -> ${r.py} [${r.notes.join('; ')}]`);
}
fs.writeFileSync(file, JSON.stringify(topic, null, 2) + '\n');
if (pending.length) console.log(`Chưa có từ: ${[...new Set(pending)].join(' ')} (chạy lại sau khi soạn chủ đề chứa từ đó)`);
if (hvNotes.length) console.log('Cần xem (âm / Hán Việt):\n  ' + hvNotes.join('\n  '));
if (pyNotes.length) console.log('Pinyin câu mẫu cần xem:\n  ' + pyNotes.join('\n  '));
console.log(`filled ${topic.words.length} words in ${path.basename(file)}`);
