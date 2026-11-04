// Pinyin helpers: shared by the web app, build.js and tests.
const MARKED = {
  ā: 'a1', á: 'a2', ǎ: 'a3', à: 'a4', ē: 'e1', é: 'e2', ě: 'e3', è: 'e4',
  ī: 'i1', í: 'i2', ǐ: 'i3', ì: 'i4', ō: 'o1', ó: 'o2', ǒ: 'o3', ò: 'o4',
  ū: 'u1', ú: 'u2', ǔ: 'u3', ù: 'u4', ǖ: 'ü1', ǘ: 'ü2', ǚ: 'ü3', ǜ: 'ü4',
};
const TO_MARK = {};
for (const [m, v] of Object.entries(MARKED)) TO_MARK[v] = m;

// Letters without tones/spaces/apostrophes, plus the sequence of tones 1–4 (neutral tones are not counted).
export function parse(s) {
  s = String(s || '').toLowerCase().normalize('NFC').replace(/u:/g, 'ü').replace(/v/g, 'ü');
  let letters = '';
  const tones = [];
  for (const ch of s) {
    if (MARKED[ch]) { letters += MARKED[ch][0]; tones.push(+MARKED[ch][1]); }
    else if (/[1-4]/.test(ch)) tones.push(+ch);
    else if (/[a-zü]/.test(ch)) letters += ch;
  }
  return { letters, tones };
}

// 'correct' | 'tone' (right sounds, wrong/missing tones) | 'wrong'
export function checkPinyin(input, answer) {
  const a = parse(input), b = parse(answer);
  if (!a.letters || a.letters !== b.letters) return 'wrong';
  return a.tones.join() === b.tones.join() ? 'correct' : 'tone';
}

// Strip tone marks: 'nǐ hǎo' -> 'ni hao'
export function toneless(s) {
  return [...String(s || '').normalize('NFC')].map((c) => (MARKED[c] ? MARKED[c][0] : c)).join('');
}

// One numbered syllable -> marked: 'hao3' -> 'hǎo', 'lv4' -> 'lǜ', 'ma' -> 'ma'
export function syllableToMarks(syl) {
  const m = /^([a-züv:]+?)([1-5]?)$/i.exec(syl);
  if (!m) return syl;
  let base = m[1].replace(/u:|v/gi, 'ü');
  const tone = m[2];
  if (!tone || tone === '5') return base;
  const lower = base.toLowerCase();
  let idx = lower.search(/[ae]/);
  if (idx < 0) idx = lower.indexOf('ou');
  if (idx < 0) { const vs = [...lower.matchAll(/[iouü]/g)]; idx = vs.length ? vs[vs.length - 1].index : -1; }
  if (idx < 0) return base;
  const marked = TO_MARK[lower[idx] + tone] || lower[idx];
  const out = base[idx] === base[idx].toUpperCase() && base[idx] !== lower[idx] ? marked.toUpperCase() : marked;
  return base.slice(0, idx) + out + base.slice(idx + 1);
}

// 'ni3 hao3' -> 'nǐ hǎo'
export function numToMarks(s) {
  return String(s || '').split(/(\s+)/).map((w) => w.replace(/[a-züv:]+[1-5]?/gi, syllableToMarks)).join('');
}

// Split marked pinyin into syllables using known syllable letter lengths.
// ('duōshao', ['duo','shao']) -> 'duo1 shao'
export function marksToNum(marked, syllables) {
  const chars = [...String(marked).normalize('NFC')].filter((c) => /[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(c));
  const out = [];
  let i = 0;
  for (const syl of syllables) {
    let tone = 0, text = '';
    for (let k = 0; k < syl.length; k++, i++) {
      const c = chars[i];
      if (c === undefined) return null;
      const lc = c.toLowerCase();
      if (MARKED[lc]) { text += MARKED[lc][0]; tone = +MARKED[lc][1]; } else text += lc;
    }
    if (text !== syl) return null;
    out.push(tone ? text + tone : text);
  }
  return i === chars.length ? out.join(' ') : null;
}

// Tone pattern of a numbered pinyin: 'xi3 huan' -> [3,5]
export function tonesOf(num) {
  return String(num).trim().split(/\s+/).map((s) => +(/[1-4]$/.exec(s)?.[0] || 5));
}

// Remove Vietnamese diacritics for search
export function foldVi(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
