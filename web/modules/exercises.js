// Exercise cards. renderCard(root, card, ctx, done) -> calls done({result, chosen, exerciseId, mode}).
import { pickDistractors, toneOptions } from './distractors.js';
import { checkPinyin, toneless, numToMarks } from './pinyin.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const hl = (s) => esc(s).replace(/\*([^*]+)\*/g, '<b>$1</b>');
export const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/></svg>';
export const sayBtn = (text, label = 'Nghe') => `<button class="say" data-say="${esc(text)}" aria-label="${label}">${SPEAKER}</button>`;

export const MODE_NAMES = { 1: 'Chữ → Nghĩa', 2: 'Nghĩa → Chữ', 3: 'Nghe → Chữ', 4: 'Chọn thanh điệu', 5: 'Gõ pinyin', 6: 'Nghĩa → Nói', 7: 'Điền từ', 8: 'Sắp xếp câu', 9: 'Viết chữ' };
const PROMPTS = { 1: 'Chữ này nghĩa là gì?', 2: 'Chọn chữ đúng', 3: 'Nghe và chọn chữ', 4: 'Chọn thanh điệu đúng', 5: 'Gõ pinyin của từ này', 6: 'Nói to từ tiếng Trung, rồi nghe mẫu', 7: 'Chọn từ điền vào chỗ trống', 8: 'Bấm lần lượt để sắp xếp thành câu', 9: 'Viết chữ theo đúng thứ tự nét' };

const RES_TEXT = { good: ['ok', '✓ Đúng'], hard: ['mid', '◐ Tạm'], again: ['bad', '✗ Chưa đúng'] };

function hero(w, s, { pinyin = true, hv = true } = {}) {
  return `<div class="q-hero">
    <div class="py">${pinyin && !s.hidePinyin ? esc(w.pinyin) : '&nbsp;'}</div>
    <div class="hz" lang="zh-CN">${esc(w.hanzi)}</div>
    <div class="hv">${hv && s.showHanViet && w.hanViet ? esc(w.hanViet) : '&nbsp;'}</div></div>`;
}
function wordLine(w) {
  return `<div class="w"><span class="zh" lang="zh-CN">${esc(w.hanzi)}</span> <span>${esc(w.pinyin)}</span> ${sayBtn(w.hanzi)}</div>
    <div>${esc(w.meaning.join('; '))}${w.hanViet ? ` <span class="muted small">· ${esc(w.hanViet)}</span>` : ''}</div>`;
}
function feedback(result, inner, extra = '') {
  const [cls, label] = RES_TEXT[result];
  return `<div class="fb ${cls}"><div class="verdict ${cls}">${extra || label}</div>${inner}</div>`;
}

export function renderCard(root, card, ctx, done) {
  const w = ctx.byId.get(card.wordId);
  const s = ctx.store.settings;
  const mode = card.mode;
  let finished = false;
  const finish = (result, chosen = '', exerciseId = '') => {
    if (finished) return;
    finished = true;
    const btn = root.querySelector('.next');
    const go = () => done({ result, chosen, exerciseId, mode: String(card.exercise ? card.exercise.type : mode) });
    if (btn) { btn.hidden = false; btn.onclick = go; btn.focus({ preventScroll: true }); }
    ctx.setKeys((e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key.toLowerCase() === 'r') ctx.speak(w.hanzi); });
  };
  const nextBtn = '<button class="btn primary big next" hidden>Tiếp</button>';
  const kbd = '<div class="kbd">Phím: 1–4 chọn · Space hiện đáp án · Enter câu tiếp · R nghe lại</div>';

  // Multiple choice helper
  function choice({ head, options, zhOpts = false, after = '' }) {
    const opts = shuffle(options);
    root.innerHTML = `<div class="card"><div class="q-label">${PROMPTS[mode] || PROMPTS[7]}</div>${head}
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span><span class="v ${zhOpts ? 'zh' : ''}" ${zhOpts ? 'lang="zh-CN"' : ''}>${o.html}</span><span class="mark"></span></button>`).join('')}</div>
      <div class="fb-slot"></div>${nextBtn}</div>${kbd}`;
    const answer = (i) => {
      if (finished) return;
      const picked = i == null ? null : opts[i];
      root.querySelectorAll('.opt').forEach((b, k) => {
        b.disabled = true;
        if (opts[k].correct) { b.classList.add('right'); b.querySelector('.mark').textContent = '✓'; }
        else if (k === i) { b.classList.add('wrong'); b.querySelector('.mark').textContent = '✗'; }
      });
      const result = picked?.correct ? 'good' : 'again';
      root.querySelector('.fb-slot').innerHTML = feedback(result, wordLine(w) + after, picked ? '' : '◌ Đáp án');
      ctx.speak(card.exercise ? (card.exercise.full || w.hanzi) : w.hanzi);
      finish(result, picked && !picked.correct ? picked.wordId || picked.text || '' : '', card.exercise?.id || '');
    };
    root.querySelectorAll('.opt').forEach((b) => (b.onclick = () => answer(+b.dataset.i)));
    ctx.setKeys((e) => {
      if (/^[1-4]$/.test(e.key) && +e.key <= opts.length) answer(+e.key - 1);
      else if (e.key === ' ') { e.preventDefault(); answer(null); }
      else if (e.key.toLowerCase() === 'r') ctx.speak(w.hanzi);
    });
  }

  const pool = ctx.pool;
  const others = () => pickDistractors(w, pool, { n: 3 });

  if (mode === 'intro') {
    root.innerHTML = `<div class="card"><div class="q-label">Từ mới</div>${hero(w, { ...s, hidePinyin: false, showHanViet: true })}
      <div class="fb"><div class="w"><b>${esc(w.meaning.join('; '))}</b> ${sayBtn(w.hanzi)}</div>
      ${w.usage ? `<div class="small muted">${esc(w.usage)}</div>` : ''}
      ${(w.examples || []).map((x) => `<div class="ex"><div class="z" lang="zh-CN">${hl(x.zh)} ${sayBtn(x.zh)}</div><div class="y">${hl(x.py)}</div><div>${esc(x.vi)}</div></div>`).join('')}</div>
      <button class="btn primary big next">Đã xem, kiểm tra ngay</button></div>`;
    ctx.speak(w.hanzi);
    const go = () => done(null);
    root.querySelector('.next').onclick = go;
    ctx.setKeys((e) => { if (e.key === 'Enter') go(); else if (e.key.toLowerCase() === 'r') ctx.speak(w.hanzi); });
    return;
  }

  if (mode === 1) {
    choice({ head: hero(w, s), options: [w, ...others()].map((x) => ({ html: esc(x.meaning.join('; ')), correct: x === w, wordId: x.id })) });
  } else if (mode === 2 || mode === 3) {
    const ex = (w.examples || [])[0];
    const head = mode === 2
      ? `<div class="q-hero"><div class="mean">${esc(w.meaning.join('; '))}</div></div>${ex ? `<div class="q-sent" lang="zh-CN">${esc(ex.zh).replace(/\*[^*]+\*/, '<span class="blank">&nbsp;</span>')}</div>` : ''}`
      : `<button class="listen" aria-label="Nghe lại">${SPEAKER}</button>`;
    choice({ head, zhOpts: true, options: [w, ...others()].map((x) => ({ html: esc(x.hanzi), correct: x === w, wordId: x.id })) });
    if (mode === 3) { root.querySelector('.listen').onclick = () => ctx.speak(w.hanzi); ctx.speak(w.hanzi); }
  } else if (mode === 4) {
    const t = toneOptions(w);
    const head = hero({ ...w, pinyin: toneless(numToMarks(w.pinyinNum)) }, { ...s, hidePinyin: false });
    choice({ head, options: [{ html: esc(t.answer), correct: true }, ...t.options.map((o) => ({ html: esc(o), text: o }))] });
  } else if (mode === 5) {
    root.innerHTML = `<div class="card"><div class="q-label">${PROMPTS[5]}</div>${hero(w, s, { pinyin: false })}
      <div class="muted" style="text-align:center;margin:-8px 0 12px">${esc(w.meaning.join('; '))}</div>
      <form class="pin-form"><input class="field pin-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="vd: ni3 hao3 hoặc nǐ hǎo" aria-label="Pinyin">
      <div class="row" style="margin-top:8px"><button class="btn ghost" type="button" data-skip>Không nhớ</button><button class="btn primary">Kiểm tra</button></div></form>
      <div class="fb-slot"></div>${nextBtn}</div>`;
    const inp = root.querySelector('input');
    setTimeout(() => inp.focus(), 50);
    const grade = (val) => {
      if (finished) return;
      const r = val == null ? 'wrong' : checkPinyin(val, w.pinyin);
      const result = r === 'correct' ? 'good' : r === 'tone' ? 'hard' : 'again';
      inp.disabled = true;
      root.querySelectorAll('.pin-form button').forEach((b) => (b.disabled = true));
      root.querySelector('.fb-slot').innerHTML = feedback(result, wordLine(w), r === 'tone' ? '◐ Đúng âm, sai thanh' : '');
      ctx.speak(w.hanzi);
      finish(result);
    };
    root.querySelector('form').onsubmit = (e) => { e.preventDefault(); if (inp.value.trim()) grade(inp.value); };
    root.querySelector('[data-skip]').onclick = () => grade(null);
    ctx.setKeys(() => {});
  } else if (mode === 6) {
    root.innerHTML = `<div class="card"><div class="q-label">${PROMPTS[6]}</div>
      <div class="q-hero"><div class="mean">${esc(w.meaning.join('; '))}</div></div>
      <div class="reveal-slot"></div>
      <button class="btn primary big" data-reveal>Nghe mẫu</button>
      <div class="row grade" hidden style="margin-top:10px"><button class="btn" data-g="again">1 · Chưa nhớ</button><button class="btn" data-g="hard">2 · Tạm</button><button class="btn" data-g="good">3 · Thuộc</button></div></div>${kbd}`;
    const reveal = () => {
      root.querySelector('.reveal-slot').innerHTML = hero(w, { ...s, hidePinyin: false });
      root.querySelector('[data-reveal]').hidden = true;
      root.querySelector('.grade').hidden = false;
      ctx.speak(w.hanzi);
    };
    const grade = (g) => { if (!root.querySelector('.grade').hidden) done({ result: g, chosen: '', exerciseId: '', mode: '6' }); };
    root.querySelector('[data-reveal]').onclick = reveal;
    root.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => grade(b.dataset.g)));
    ctx.setKeys((e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
      else if (/^[1-3]$/.test(e.key)) grade(['again', 'hard', 'good'][+e.key - 1]);
      else if (e.key.toLowerCase() === 'r') ctx.speak(w.hanzi);
    });
  } else if (mode === 9) {
    renderWrite(root, w, s, ctx, nextBtn, (result) => {
      root.querySelector('.fb-slot').innerHTML = feedback(result, wordLine(w));
      finish(result);
    });
  } else if (card.exercise?.type === 'fill') {
    const e = card.exercise;
    const full = e.sentence.replace('{0}', e.answer);
    card.exercise.full = full;
    const head = `<div class="q-sent" lang="zh-CN">${esc(e.sentence).replace('{0}', '<span class="blank">&nbsp;</span>')}</div>`;
    const after = `<div class="ex"><div class="z" lang="zh-CN">${esc(full)} ${sayBtn(full)}</div>${e.explanation ? `<div class="small">${esc(e.explanation)}</div>` : ''}</div>`;
    const idOf = (h) => [...ctx.byId.values()].find((x) => x.hanzi === h)?.id || h;
    choice({ head, zhOpts: true, after, options: e.options.map((o) => ({ html: esc(o), correct: o === e.answer, wordId: idOf(o) })) });
  } else if (card.exercise?.type === 'order') {
    renderOrder(root, card.exercise, ctx, nextBtn, (result) => {
      const full = card.exercise.answers[0].join('');
      root.querySelector('.fb-slot').innerHTML = feedback(result, `<div class="z zh" lang="zh-CN" style="font-size:1.3rem">${esc(full)} ${sayBtn(full)}</div><div>${esc(card.exercise.vi)}</div>`);
      ctx.speak(full);
      finish(result, '', card.exercise.id);
    });
  }
}

function renderOrder(root, ex, ctx, nextBtn, onResult) {
  const items = shuffle(ex.chunks.map((t, i) => ({ t, i })));
  const picked = [];
  root.innerHTML = `<div class="card"><div class="q-label">${PROMPTS[8]}</div><div class="q-hero"><div class="mean">${esc(ex.vi)}</div></div>
    <div class="chunks ans" aria-label="Câu của bạn"></div><div class="chunks src"></div>
    <div class="row"><button class="btn ghost" data-clear>Làm lại</button><button class="btn ghost" data-skip>Xem đáp án</button></div>
    <div class="fb-slot"></div>${nextBtn}</div>`;
  const ans = root.querySelector('.ans'), src = root.querySelector('.src');
  let over = false;
  const draw = () => {
    ans.innerHTML = picked.map((it, k) => `<button class="chunk" data-k="${k}" lang="zh-CN">${esc(it.t)}</button>`).join('');
    src.innerHTML = items.filter((it) => !picked.includes(it)).map((it) => `<button class="chunk" data-i="${it.i}" lang="zh-CN">${esc(it.t)}</button>`).join('');
    if (over) return root.querySelectorAll('.chunk').forEach((b) => (b.disabled = true));
    ans.querySelectorAll('.chunk').forEach((b) => (b.onclick = () => { picked.splice(+b.dataset.k, 1); draw(); }));
    src.querySelectorAll('.chunk').forEach((b) => (b.onclick = () => { picked.push(items.find((it) => it.i === +b.dataset.i)); draw(); check(); }));
  };
  const end = (result) => { over = true; draw(); root.querySelectorAll('[data-clear],[data-skip]').forEach((b) => (b.disabled = true)); onResult(result); };
  const check = () => {
    if (picked.length !== items.length) return;
    const got = picked.map((it) => it.t).join('|');
    end(ex.answers.some((a) => a.join('|') === got) ? 'good' : 'again');
  };
  root.querySelector('[data-clear]').onclick = () => { picked.length = 0; draw(); };
  root.querySelector('[data-skip]').onclick = () => end('again');
  ctx.setKeys((e) => { if (e.key === ' ') { e.preventDefault(); end('again'); } });
  draw();
}

const HW_URL = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5.0/dist/hanzi-writer.min.js';
let hwPromise = null;
export function loadHanziWriter() {
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
  hwPromise ||= new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = HW_URL; sc.onload = () => res(window.HanziWriter); sc.onerror = rej; document.head.append(sc); });
  return hwPromise;
}

function renderWrite(root, w, s, ctx, nextBtn, onResult) {
  const chars = [...w.hanzi];
  root.innerHTML = `<div class="card"><div class="q-label">${PROMPTS[9]} <span class="prog-c"></span></div>
    <div class="q-hero" style="padding-bottom:4px"><div class="mean">${esc(w.meaning.join('; '))}</div><div class="py">${esc(w.pinyin)}</div></div>
    <div class="qwriter" id="qw"></div>
    <div class="row"><button class="btn ghost" data-hint>Gợi ý nét</button><button class="btn ghost" data-skip>Không nhớ</button></div>
    <div class="fb-slot"></div>${nextBtn}</div>`;
  let mistakes = 0, k = 0, writer = null, over = false;
  const size = root.querySelector('#qw').clientWidth || 260;
  const end = (result) => { if (over) return; over = true; root.querySelectorAll('[data-hint],[data-skip]').forEach((b) => (b.disabled = true)); onResult(result); };
  const start = (HW) => {
    root.querySelector('#qw').innerHTML = '';
    root.querySelector('.prog-c').textContent = chars.length > 1 ? `(${k + 1}/${chars.length})` : '';
    writer = HW.create('qw', chars[k], { width: size, height: size, padding: 12, showCharacter: false, showOutline: true, showHintAfterMisses: 3, highlightOnComplete: true });
    writer.quiz({
      onMistake: () => { mistakes++; },
      onComplete: () => {
        k++;
        if (k < chars.length) setTimeout(() => start(HW), 600);
        else end(mistakes === 0 ? 'good' : mistakes <= 2 * chars.length ? 'hard' : 'again');
      },
    });
  };
  root.querySelector('[data-hint]').onclick = () => {
    if (!writer || over) return;
    mistakes += 2;
    writer.cancelQuiz();
    writer.animateCharacter({ onComplete: () => setTimeout(() => start(window.HanziWriter), 400) });
  };
  root.querySelector('[data-skip]').onclick = () => { writer?.cancelQuiz?.(); end('again'); };
  ctx.setKeys((e) => { if (e.key === ' ') { e.preventDefault(); writer?.cancelQuiz?.(); end('again'); } });
  loadHanziWriter().then(start).catch(() => { root.querySelector('#qw').textContent = 'Không tải được Hanzi Writer (cần mạng).'; });
}
