// HSK 1–3 lexicon for checking example sentences and generating their pinyin.
// segment(): forward maximum matching over hsk-official.json (+ a few derived forms).
// sentencePinyin(): word-by-word pinyin, tone sandhi of 一 / 不 marked as in HSK 1 data (bú rènshi).
import fs from 'node:fs';
import path from 'node:path';

const TONE_MARKS = /[̄́̌̀]/g;
const isHan = (c) => /[㐀-鿿]/.test(c);
const NUM_CHARS = new Set('零一二三四五六七八九十百千万两第几');

// Default reading of a polyphonic single-character token in running text.
const DEFAULT = {
  了: 'le', 得: 'de', 地: 'de', 着: 'zhe', 还: 'hái', 长: 'cháng', 为: 'wèi', 教: 'jiāo', 要: 'yào',
  差: 'chà', 分: 'fēn', 种: 'zhǒng', 难: 'nán', 好: 'hǎo', 累: 'lèi', 骑: 'qí', 鸟: 'niǎo', 胖: 'pàng',
  远: 'yuǎn', 给: 'gěi', 号: 'hào', 离: 'lí', 比: 'bǐ', 别: 'bié', 吧: 'ba', 啊: 'a', 万: 'wàn', 草: 'cǎo',
  云: 'yún', 更: 'gèng', 把: 'bǎ', 角: 'jiǎo', 脚: 'jiǎo', 刷: 'shuā', 便宜: 'piányi', 告诉: 'gàosu',
  妻子: 'qīzi', 女人: 'nǚrén', 好吃: 'hǎochī', 故事: 'gùshi', 地方: 'dìfang', 过去: 'guòqù', 要求: 'yāoqiú',
  都: 'dōu', 和: 'hé', 的: 'de', 会: 'huì', 大: 'dà', 打: 'dǎ', 说: 'shuō', 少: 'shǎo', 没: 'méi',
  这: 'zhè', 那: 'nà', 哪: 'nǎ', 谁: 'shéi', 中: 'zhōng', 看: 'kàn', 只: 'zhǐ', 白: 'bái', 高: 'gāo',
  黑: 'hēi', 红: 'hóng', 路: 'lù', 门: 'mén', 题: 'tí', 向: 'xiàng', 新: 'xīn', 雪: 'xuě', 也: 'yě',
  阴: 'yīn', 鱼: 'yú', 元: 'yuán', 张: 'zhāng', 错: 'cuò', 百: 'bǎi', 从: 'cóng', 药: 'yào', 笑: 'xiào',
  班: 'bān', 包: 'bāo', 东: 'dōng', 段: 'duàn', 关: 'guān', 花: 'huā', 黄: 'huáng', 蓝: 'lán', 楼: 'lóu',
  马: 'mǎ', 米: 'mǐ', 南: 'nán', 秋: 'qiū', 双: 'shuāng', 西: 'xī', 夏: 'xià', 越: 'yuè', 祝: 'zhù',
  春: 'chūn', 冬: 'dōng', 草地: 'cǎodì', 一会儿: 'yíhuìr', 还是: 'háishi', 明白: 'míngbai', 葡萄: 'pútao',
  休息: 'xiūxi',
};
// Words not listed separately but formed from listed parts at the same level.
const DERIVED = [
  ['你们', 'nǐ men', 1], ['他们', 'tā men', 1], ['她们', 'tā men', 1], ['它们', 'tā men', 2],
  ['这儿', 'zhèr', 1], ['那儿', 'nàr', 1], ['哪儿', 'nǎr', 1],
];

const strip = (s) => s.normalize('NFD').replace(TONE_MARKS, '').normalize('NFC').toLowerCase();
function toneOf(syl) {
  const d = syl.normalize('NFD');
  if (d.includes('̄')) return 1;
  if (d.includes('́')) return 2;
  if (d.includes('̌')) return 3;
  if (d.includes('̀')) return 4;
  return 5;
}
const MARK = { 1: '̄', 2: '́', 3: '̌', 4: '̀' };
function setTone(syl, t) {
  const base = syl.normalize('NFD').replace(TONE_MARKS, '');
  if (t === 5) return base.normalize('NFC');
  const i = /[ae]/.test(base) ? base.search(/[ae]/) : base.includes('ou') ? base.indexOf('o')
    : Math.max(...[...'aeiouü'].map((v) => base.lastIndexOf(v)));
  const j = base.indexOf('̈') === i + 1 ? i + 2 : i + 1; // keep ü's diaeresis before the tone mark
  return (base.slice(0, j) + MARK[t] + base.slice(j)).normalize('NFC');
}
// split a marked reading without spaces into syllables, using a spaced reference reading
function splitBy(marked, spaced) {
  const parts = spaced.split(' ');
  const out = [];
  let k = 0;
  for (const p of parts) { out.push(marked.slice(k, k + p.normalize('NFC').length)); k += p.normalize('NFC').length; }
  return k === marked.length ? out : null;
}

export function loadLexicon(root) {
  const official = JSON.parse(fs.readFileSync(path.join(root, 'data-src/sources/hsk-official.json'), 'utf8')).words;
  const chosen = new Map(); // hanzi -> pinyin chosen in topic files
  const dir = path.join(root, 'data-src/topics');
  for (const f of fs.readdirSync(dir)) for (const w of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).words) if (!chosen.has(w.hanzi)) chosen.set(w.hanzi, w.pinyin);

  const dict = new Map();
  for (const o of official) {
    const forms = o.forms.map((f) => f.pinyin.normalize('NFC'));
    const lower = forms.filter((p) => p !== p.toLowerCase() ? !forms.includes(p.toLowerCase()) : true);
    const uniq = [...new Set(lower)];
    let want = chosen.get(o.hanzi) || DEFAULT[o.hanzi] || o.offPinyin;
    let syl = null;
    if (want) {
      const ref = uniq.find((p) => strip(p).replace(/ /g, '') === strip(want)) || uniq[0];
      syl = splitBy(want.normalize('NFC'), ref);
    }
    if (!syl) syl = uniq[0].split(' ');
    const prev = dict.get(o.hanzi);
    if (!prev || o.hsk2 < prev.level) dict.set(o.hanzi, { level: o.hsk2, syl, ambiguous: !want && uniq.length > 1, pos: o.posS });
  }
  for (const [h, p, level] of DERIVED) if (!dict.has(h)) dict.set(h, { level, syl: p.split(' '), derived: true });
  const maxLen = Math.max(...[...dict.keys()].map((k) => k.length));

  function segment(text) {
    const out = [];
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (!isHan(c)) {
        let j = i + 1;
        if (/[A-Za-z0-9]/.test(c)) while (j < text.length && /[A-Za-z0-9.]/.test(text[j])) j++;
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

  // words above `level` or outside the list
  function offLevel(text, level) {
    return segment(text.replace(/\*/g, '')).filter((t) => t.han && (!t.entry || t.entry.level > level))
      .map((t) => (t.entry ? `${t.text}(HSK${t.entry.level})` : `${t.text}(ngoài bảng)`));
  }

  function sentencePinyin(zh) {
    const toks = [];
    zh.split('*').forEach((part, k) => { for (const t of segment(part)) toks.push({ ...t, target: k % 2 === 1 }); });
    const notes = [];
    // syllables with underlying tones
    for (const t of toks) if (t.han) {
      if (!t.entry) { notes.push(`không có trong bảng: ${t.text}`); t.syl = ['?']; continue; }
      t.syl = [...t.entry.syl];
      if (t.entry.ambiguous) notes.push(`nhiều âm: ${t.text}`);
    }
    const flat = [];
    toks.forEach((t, ti) => (t.syl || []).forEach((s, si) => flat.push({ ti, si, ch: t.text[si], t })));
    flat.forEach((f, k) => {
      const next = flat[k + 1];
      const adjacent = next && (next.ti === f.ti || next.ti === f.ti + 1);
      const nextTone = adjacent ? (next.ch === '个' ? 4 : toneOf(next.t.syl[next.si])) : 0;
      if (f.t.text === '不' || (f.ch === '不' && f.t.text.length > 1 && f.si === 0 && !['不客气'].includes(f.t.text))) {
        if (adjacent && nextTone === 4) f.t.syl[f.si] = 'bú';
      }
      if (f.ch === '一') {
        const prev = flat[k - 1];
        const lastInWord = f.t.text.length > 1 && f.si === f.t.text.length - 1;
        const afterNum = prev && prev.ti >= f.ti - 1 && (NUM_CHARS.has(prev.ch) || prev.t.text === '星期');
        const beforeDate = next && /[月号日]/.test(next.ch) && next.ti === f.ti + 1;
        if (!lastInWord && !afterNum && !beforeDate && adjacent && nextTone && !(next && NUM_CHARS.has(next.ch) && !/[百千万]/.test(next.ch))) {
          f.t.syl[f.si] = nextTone === 4 ? 'yí' : 'yì';
        }
      }
    });
    for (const t of toks) if (t.han && t.text === '个') t.syl = ['ge'];
    toks.forEach((t, i) => {
      if (t.han && t.text === '只') {
        const p = toks[i - 1];
        if (p && p.han && [...p.text].some((c) => NUM_CHARS.has(c) || '这那哪每'.includes(c))) t.syl = ['zhī'];
      }
    });
    // render
    const P = { '，': ',', '。': '.', '？': '?', '！': '!', '：': ':', '、': ',', '；': ';', '…': '…' };
    let out = '';
    let cap = true;
    let open = false;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      let s;
      if (t.han) s = t.syl.map((x, k) => (k && /^[aeo]/.test(strip(x)) ? "'" : '') + x).join('');
      else if (t.text in P) { out += P[t.text]; if ('。？！'.includes(t.text)) cap = true; continue; }
      else if (t.text === '“' || t.text === '”') { const o = t.text === '“'; out += o ? (out && !out.endsWith(' ') ? ' "' : '"') : '"'; open = o; if (o) { out += '\u0000'; } continue; }
      else if (/^\s+$/.test(t.text)) continue;
      else s = t.text;
      if (cap && /\p{L}/u.test(s)) { s = s[0].toUpperCase() + s.slice(1); cap = false; }
      if (/^[AB]$/.test(t.text) && toks[i + 1] && toks[i + 1].text === '：') cap = true;
      if (t.target) s = `*${s}*`;
      const glue = out === '' || out.endsWith('\u0000') || (t.text === '个' && !t.target && toks[i - 1] && !toks[i - 1].target && /^[这那哪]$/.test(toks[i - 1].text));
      out = out.replace(/\u0000$/, '') + (glue ? '' : ' ') + s;
    }
    out = out.replace(/\u0000/g, '').replace(/\*\s\*/g, ' ').replace(/(\S)\*\*(\S)/g, '$1$2');
    return { py: out, notes };
  }

  return { dict, segment, offLevel, sentencePinyin };
}
