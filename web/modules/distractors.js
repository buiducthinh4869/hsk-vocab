// Pick hard wrong options. Priority: confusables > similar sound/shape > same topic+POS > same level+POS > rest.
import { foldVi, numToMarks } from './pinyin.js';

const SHAPES = ['大太犬天夫', '买卖', '人入八', '己已巳', '日目白百旧', '土士王', '未末', '千干于', '午牛', '问间门们',
  '我找', '今令', '休体', '儿几', '少小', '木本术', '力刀', '做作', '住往', '他她也', '那哪', '这还', '见贝', '认让',
  '生先', '朋明', '听斤', '块快', '喝渴', '菜采', '去云', '左右', '上下', '天夫', '电由田', '火伙', '书事'];
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];

const sylls = (w) => w.pinyinNum.split(' ').map((s) => s.replace(/\d/g, ''));
const splitSyl = (s) => { const i = INITIALS.find((x) => s.startsWith(x)) || ''; return [i, s.slice(i.length)]; };

export function similarShape(a, b) {
  if (a.length !== b.length || a === b) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && !SHAPES.some((g) => g.includes(a[i]) && g.includes(b[i]))) return false;
  }
  return true;
}
export function similarSound(a, b) {
  if (a.hanzi === b.hanzi) return false;
  const A = sylls(a), B = sylls(b);
  if (A.length !== B.length) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) {
    if (A[i] === B[i]) continue;
    const [ia, fa] = splitSyl(A[i]), [ib, fb] = splitSyl(B[i]);
    if (ia === ib || fa === fb) diff++; else return false;
  }
  return diff <= 1; // same letters with other tones (diff 0) or one initial/final changed
}

const meanings = (w) => new Set(w.meaning.map(foldVi));
const overlap = (a, b) => [...meanings(a)].some((m) => meanings(b).has(m));
const shuffle = (arr, rand) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// pool: words with {id, hanzi, pinyinNum, meaning, pos, hsk2, topicId, confusables}
export function pickDistractors(target, pool, { n = 3, rand = Math.random } = {}) {
  const byId = new Map(pool.map((w) => [w.id, w]));
  const posMatch = (w) => w.pos.some((p) => target.pos.includes(p));
  const lower = (w) => w.hsk2 <= target.hsk2;
  const tiers = [
    (target.confusables || []).map((id) => byId.get(id)).filter(Boolean),
    shuffle(pool.filter((w) => lower(w) && (similarSound(target, w) || similarShape(target.hanzi, w.hanzi))), rand),
    shuffle(pool.filter((w) => w.topicId === target.topicId && posMatch(w)), rand),
    shuffle(pool.filter((w) => w.hsk2 === target.hsk2 && posMatch(w)), rand),
    shuffle(pool.filter((w) => w.hsk2 === target.hsk2), rand),
    shuffle(pool, rand),
  ];
  const out = [];
  for (const tier of tiers) {
    for (const w of tier) {
      if (out.length >= n) return out;
      if (w.id === target.id || w.hanzi === target.hanzi || overlap(w, target)) continue;
      if (out.some((o) => o.hanzi === w.hanzi || overlap(o, w))) continue;
      out.push(w);
    }
  }
  return out;
}

// Mode 4: other tone combinations of the same syllables, preferring 2<->3 and 1<->4.
const PREF = { 1: [4, 2, 3], 2: [3, 1, 4], 3: [2, 4, 1], 4: [1, 3, 2] };
export function toneOptions(word, n = 3) {
  const syl = word.pinyinNum.split(' ').map((s) => ({ b: s.replace(/\d/g, ''), t: +(/[1-4]/.exec(s)?.[0] || 5) }));
  const idx = syl.map((s, i) => i).filter((i) => syl[i].t !== 5);
  let combos = [{ tones: syl.map((s) => s.t), cost: 0 }];
  for (const i of idx) {
    const next = [];
    for (const c of combos) {
      next.push(c);
      PREF[syl[i].t].forEach((t, rank) => { const tones = [...c.tones]; tones[i] = t; next.push({ tones, cost: c.cost + 10 + rank }); });
    }
    combos = next;
  }
  const render = (tones) => numToMarks(syl.map((s, i) => s.b + (tones[i] === 5 ? '' : tones[i])).join(' '));
  const answer = render(syl.map((s) => s.t));
  const seen = new Set([answer]);
  const out = [];
  for (const c of combos.sort((a, b) => a.cost - b.cost)) {
    const r = render(c.tones);
    if (!seen.has(r)) { seen.add(r); out.push(r); }
    if (out.length >= n) break;
  }
  return { answer, options: out };
}
