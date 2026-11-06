// Learner edits of meaning / usage / examples: validation, merging over the original data,
// sentence segmentation (level warning) and example pinyin. Pure functions except loadPinyinPro().
import { syllableToMarks, toneless } from './pinyin.js';

export const EDIT_FIELDS = ['meaning', 'usage', 'examples'];
const MAX = { meaningItem: 200, usage: 500, zh: 200, py: 300, vi: 300, examples: 5 };
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Returns a clean value, or null when the value is not acceptable for the field.
export function cleanValue(field, v) {
  if (field === 'meaning') {
    if (!Array.isArray(v)) return null;
    const out = v.map(str).filter(Boolean);
    return out.length >= 1 && out.length <= 3 && out.every((m) => m.length <= MAX.meaningItem) ? out : null;
  }
  if (field === 'usage') return typeof v === 'string' && v.length <= MAX.usage ? v.trim() : null;
  if (field === 'examples') {
    if (!Array.isArray(v) || v.length > MAX.examples) return null;
    const out = v.map((e) => ({ zh: str(e?.zh), py: str(e?.py), vi: str(e?.vi) }));
    return out.every((e) => e.zh && e.zh.length <= MAX.zh && e.py.length <= MAX.py && e.vi.length <= MAX.vi && /\*[^*]+\*/.test(e.zh)) ? out : null;
  }
  return null;
}

export const editKey = (wordId, field) => `${wordId}|${field}`;

// Server rows + not-yet-sent local operations (in order) -> { key: {wordId, field, value, updatedAt} }.
export function editState(serverRows = [], pending = []) {
  const out = {};
  for (const r of serverRows) {
    if (!EDIT_FIELDS.includes(r.field) || cleanValue(r.field, r.value) === null) continue;
    const k = editKey(r.wordId, r.field);
    if (!out[k] || r.updatedAt > out[k].updatedAt) out[k] = { wordId: r.wordId, field: r.field, value: r.value, updatedAt: r.updatedAt };
  }
  for (const op of pending) {
    const k = editKey(op.wordId, op.field);
    if (out[k] && out[k].updatedAt > op.updatedAt) continue; // a newer edit from another device wins
    if (op.op === 'revert') delete out[k];
    else out[k] = { wordId: op.wordId, field: op.field, value: op.value, updatedAt: op.updatedAt };
  }
  return out;
}

// Original word fields + its edits -> fields to show. `edited` lists the fields that differ from the original.
export function mergeWord(base, edits) {
  const out = { meaning: base.meaning, usage: base.usage || '', examples: base.examples || [], edited: [] };
  for (const f of EDIT_FIELDS) {
    const e = edits[editKey(base.id, f)];
    if (!e) continue;
    const v = cleanValue(f, e.value);
    if (v === null) continue;
    out[f] = v;
    out.edited.push(f);
  }
  return out;
}

// Apply edits in place to word objects; `originals` keeps the untouched fields (filled on first call).
export function applyEdits(words, edits, originals) {
  for (const w of words) {
    if (!originals.has(w.id)) originals.set(w.id, { id: w.id, meaning: w.meaning, usage: w.usage, examples: w.examples });
    Object.assign(w, mergeWord(originals.get(w.id), edits));
  }
}

/* ---------- sentences ---------- */
// Forms not listed separately in the HSK tables (same list as scripts/lib/lexicon.js).
const DERIVED = [
  ['你们', 'ni3 men', 1], ['他们', 'ta1 men', 1], ['她们', 'ta1 men', 1], ['它们', 'ta1 men', 2],
  ['这儿', 'zhe4 r', 1], ['那儿', 'na4 r', 1], ['哪儿', 'na3 r', 1], ['这里', 'zhe4 li3', 1], ['那里', 'na4 li3', 1], ['哪里', 'na3 li3', 1],
  ['春天', 'chun1 tian1', 3], ['夏天', 'xia4 tian1', 3], ['秋天', 'qiu1 tian1', 3], ['冬天', 'dong1 tian1', 3], ['刮风', 'gua1 feng1', 3],
];
const isHan = (c) => /[\u3400-\u9fff]/.test(c);
// single characters whose reading depends on context: here pinyin-pro's reading is used (长 zhǎng, 还 huán)
const CONTEXT = new Set('长还着为种难差分要重行觉干好少便数');

// words: [{hanzi, pinyinNum, level}] -> Map hanzi -> {level, syl: ['wǒ', 'men']}
export function buildDict(words) {
  const dict = new Map();
  const add = (h, num, level, cap = false) => {
    const prev = dict.get(h);
    if (!prev || level < prev.level) dict.set(h, { level, cap, syl: num.toLowerCase().split(' ').map(syllableToMarks) });
  };
  // cap: proper nouns (北京 Běijīng) keep their capital letter
  for (const w of words) add(w.hanzi, w.pinyinNum, w.level ?? w.hsk2, !!w.pinyin && w.pinyin[0] !== w.pinyin[0].toLowerCase());
  for (const [h, num, level] of DERIVED) if (!dict.has(h)) add(h, num, level);
  return dict;
}

// Forward maximum matching. Tokens: {text, han, entry}
export function segment(text, dict) {
  const maxLen = 5;
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (!isHan(text[i])) {
      let j = i + 1;
      if (/[A-Za-z0-9]/.test(text[i])) while (j < text.length && /[A-Za-z0-9.]/.test(text[j])) j++;
      out.push({ text: text.slice(i, j), han: false });
      i = j;
      continue;
    }
    let n = Math.min(maxLen, text.length - i);
    while (n > 1 && !dict.has(text.slice(i, i + n))) n--;
    const t = text.slice(i, i + n);
    out.push({ text: t, han: true, entry: dict.get(t) || null });
    i += n;
  }
  return out;
}

// Words above `level` or outside the HSK 1–3 list: ['说 (ngoài bảng)', '而且 (HSK 3)']
export function offLevel(zh, level, dict) {
  const bad = segment(zh.replace(/\*/g, ''), dict).filter((t) => t.han && (!t.entry || t.entry.level > level))
    .map((t) => (t.entry ? `${t.text} (HSK ${t.entry.level})` : `${t.text} (ngoài bảng)`));
  return [...new Set(bad)];
}

// Pinyin of a marked sentence ("我*姓*张。"). `auto` = one syllable per Han character from pinyin-pro.
// Known words use the app's own reading (neutral tones as in the word list); pinyin-pro supplies
// unknown characters, the tone sandhi of 一 / 不, and context readings of single characters (长 zhǎng, 还 huán).
export function sentencePinyin(zhMarked, auto, dict) {
  const P = { '，': ',', '。': '.', '？': '?', '！': '!', '：': ':', '、': ',', '；': ';' };
  let k = 0;
  const parts = [];
  zhMarked.split('*').forEach((part, idx) => {
    for (const t of segment(part, dict)) {
      if (!t.han) { parts.push({ text: t.text }); continue; }
      const a = auto.slice(k, k + t.text.length);
      k += t.text.length;
      let syl = t.entry ? [...t.entry.syl] : a;
      if (t.entry) {
        [...t.text].forEach((ch, i) => {
          if (!a[i]) return;
          // tone sandhi, except where the word list has a neutral tone (对不起 duìbuqǐ)
          if ((ch === '一' || ch === '不') && /[āáǎàīíǐìūúǔù]/.test(syl[i])) syl[i] = a[i];
          else if (t.text.length === 1 && CONTEXT.has(ch) && a[i] !== syl[i]) syl[i] = a[i];
        });
        if (t.text === '个') syl = ['ge'];
        if (t.text === '只') { // measure word after a number or 这/那/哪/每, otherwise "only"
          const prev = [...parts].reverse().find((x) => x.han);
          syl = [prev && /[一二三四五六七八九十两几这那哪每]/.test(prev.han) ? 'zhī' : 'zhǐ'];
        }
      }
      let py = syl.map((s, i) => (i && /^[aeo]/.test(toneless(s)) ? `'${s}` : s)).join('');
      if (t.entry?.cap) py = py.charAt(0).toUpperCase() + py.slice(1);
      const prev = parts[parts.length - 1];
      const glue = t.text === '个' && prev?.han && /^[这那哪]$/.test(prev.han) && !prev.target && idx % 2 === 0; // zhège
      parts.push({ py, han: t.text, target: idx % 2 === 1, glue });
    }
  });
  let out = '';
  let cap = true;
  for (const p of parts) {
    if (p.text !== undefined) {
      if (P[p.text]) { out += P[p.text]; if ('。？！'.includes(p.text)) cap = true; }
      else if (/^[A-Za-z0-9]/.test(p.text)) { out += (out ? ' ' : '') + p.text; if (/^[AB]$/.test(p.text)) cap = true; }
      continue;
    }
    let s = p.py;
    if (cap) { s = s.charAt(0).toUpperCase() + s.slice(1); cap = false; }
    if (p.target) s = `*${s}*`;
    out += (out && !p.glue ? ' ' : '') + s;
  }
  return out.replace(/\*\s\*/g, ' ').replace(/ ([,.?!:;])/g, '$1');
}

let pinyinPro = null;
export function loadPinyinPro() {
  pinyinPro ||= import('https://cdn.jsdelivr.net/npm/pinyin-pro@3.29.5/+esm').then((m) => m.pinyin);
  return pinyinPro;
}
// Han characters only, so the result has exactly one syllable per character.
export async function autoPinyin(zhMarked, dict) {
  const pinyin = await loadPinyinPro();
  const han = [...zhMarked].filter(isHan).join('');
  const auto = han ? pinyin(han, { type: 'array' }) : [];
  return sentencePinyin(zhMarked, auto, dict);
}
