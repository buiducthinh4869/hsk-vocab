// Pages: Hôm nay, Từ vựng, Luyện tập, Từ hay quên, Cài đặt, chi tiết từ, phiên ôn.
import { applyResult, buildSession, isDue, isLeech, isNew, modeFor, streakDays } from './srs.js';
import { renderCard, esc, hl, sayBtn, shuffle, MODE_NAMES, loadHanziWriter } from './exercises.js';
import { foldVi, toneless } from './pinyin.js';
import { autoPinyin, cleanValue, offLevel } from './edits.js';

const POS_VI = { n: 'danh từ', v: 'động từ', adj: 'tính từ', adv: 'phó từ', pron: 'đại từ', num: 'số từ', mw: 'lượng từ', prep: 'giới từ', conj: 'liên từ', part: 'trợ từ', interj: 'thán từ', phrase: 'cụm từ' };
const BOX_NAMES = ['Chưa học', 'Hộp 1', 'Hộp 2', 'Hộp 3', 'Hộp 4', 'Hộp 5'];
const stars = (n) => (n ? `<span class="stars" title="Độ thông dụng">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>` : '');
const lessonLabel = (w) => w.textbooks?.chuan || '';

/* ---------- Hôm nay ---------- */
export function renderToday(el, ctx) {
  const { store } = ctx;
  const today = ctx.today();
  const p = store.progress;
  const s = store.settings;
  const due = ctx.words.filter((w) => isDue(p[w.id], today)).length;
  const leeches = ctx.words.filter((w) => isLeech(p[w.id])).length;
  const newLeft = Math.max(0, s.newPerDay - store.newToday(today).length);
  const freshAvail = ctx.words.filter((w) => isNew(p[w.id])).length;
  const cards = todayCards(ctx);
  const streak = streakDays((s.studyDays || '').split(',').filter(Boolean), today);
  const topics = ctx.levels.flatMap((l) => l.topics);
  el.innerHTML = `<h1>Hôm nay</h1>
    <div class="stats">
      <div class="stat"><b>${due}</b><span>từ đến hạn ôn</span></div>
      <div class="stat"><b>${Math.min(newLeft, freshAvail)}</b><span>từ mới hôm nay</span></div>
      <div class="stat"><b>${leeches}</b><span>từ hay quên</span></div>
      <div class="stat"><b>${streak}</b><span>ngày học liên tiếp</span></div>
    </div>
    <button class="btn primary big" data-start ${cards.length ? '' : 'disabled'}>${cards.length ? `Bắt đầu ôn · ${cards.length} thẻ` : 'Hôm nay đã ôn xong'}</button>
    ${ctx.hasVoice() ? '' : '<div class="note">Máy chưa có giọng đọc tiếng Trung nên tạm ẩn bài Nghe → Chữ. Android: Cài đặt › Chuyển văn bản thành giọng nói › tải tiếng Trung. iPhone: Cài đặt › Trợ năng › Nội dung được đọc › Giọng nói › Tiếng Trung.</div>'}
    <h2>Tiến độ theo chủ đề</h2>
    <div class="legend">${BOX_NAMES.map((n, i) => `<span><i style="background:var(--b${i})"></i>${n}</span>`).join('')}</div>
    ${topics.map((t) => {
      const ws = ctx.words.filter((w) => w.topicId === t.id);
      const cnt = [0, 0, 0, 0, 0, 0];
      ws.forEach((w) => cnt[p[w.id]?.box || 0]++);
      const learned = ws.length - cnt[0];
      return `<div class="topic-prog"><div class="t"><span>${esc(t.title)} <span class="muted small">HSK ${t.level}</span></span><span class="muted small">${learned}/${ws.length}</span></div>
        <div class="bar" role="img" aria-label="${cnt.map((c, i) => `${BOX_NAMES[i]}: ${c}`).join(', ')}">${cnt.map((c, i) => (c && i ? `<i style="width:${(c / ws.length) * 100}%;background:var(--b${i})"></i>` : '')).reverse().join('')}</div></div>`;
    }).join('')}`;
  el.querySelector('[data-start]').onclick = () => runSession(ctx, cards, { title: 'Ôn hôm nay' });
}

function todayCards(ctx) {
  const { store } = ctx;
  const today = ctx.today();
  const s = store.settings;
  return buildSession({ words: ctx.words, progress: store.progress, today, newLimit: s.newPerDay - store.newToday(today).length, lessonMax: +s.lesson || 0 });
}

/* ---------- Từ vựng ---------- */
const vocabState = { level: 1, topic: '', q: '', lesson: '' };
export function renderVocab(el, ctx) {
  const st = vocabState;
  const lv = ctx.levels.find((l) => l.level === st.level) || ctx.levels[0];
  const lessons = [...new Set(ctx.words.map(lessonLabel).filter(Boolean))].sort();
  el.innerHTML = `<h1>Từ vựng</h1>
    <div class="seg" data-g="level">${ctx.allLevels.map((l) => `<button data-v="${l.level}" class="${l.level === st.level ? 'on' : ''}">${esc(l.title)} <span class="muted small">${l.words}</span></button>`).join('')}</div>
    <div class="filters">
      <input class="field" type="search" placeholder="Tìm chữ Hán, pinyin hoặc nghĩa" value="${esc(st.q)}" aria-label="Tìm">
      <select class="field" data-lesson ${lessons.length ? '' : 'disabled'} aria-label="Lọc theo bài">
        <option value="">${lessons.length ? 'Tất cả bài giáo trình' : 'Lọc theo bài: chưa có dữ liệu bài'}</option>
        ${lessons.map((l) => `<option ${l === st.lesson ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    </div>
    <div class="seg" data-g="topic"><button data-v="" class="${st.topic ? '' : 'on'}">Tất cả chủ đề</button>${(lv?.topics || []).map((t) => `<button data-v="${t.id}" class="${t.id === st.topic ? 'on' : ''}">${esc(t.title)}</button>`).join('')}</div>
    <ul class="wlist"></ul>`;
  const list = el.querySelector('.wlist');
  const draw = () => {
    const q = foldVi(st.q.trim());
    const qp = q.replace(/[\s1-5']/g, '');
    const ws = ctx.words.filter((w) => {
      if (q) return w.hanzi.includes(st.q.trim()) || foldVi(toneless(w.pinyin)).replace(/[\s']/g, '').includes(qp) || w.pinyinNum.replace(/ /g, '').includes(q.replace(/\s/g, '')) || w.meaning.some((m) => foldVi(m).includes(q));
      if (st.lesson) return lessonLabel(w) === st.lesson;
      return w.level === st.level && (!st.topic || w.topicId === st.topic);
    });
    list.innerHTML = ws.length ? ws.map((w) => `<li data-id="${w.id}"><span class="h" lang="zh-CN">${esc(w.hanzi)}</span><span class="p">${esc(w.pinyin)}</span><span class="lv">HSK ${w.hsk2}<br>${stars(w.common)}</span><span class="m">${esc(w.meaning.join('; '))}${w.edited.length ? ' <span class="tag-edit">Đã chỉnh</span>' : ''}</span></li>`).join('')
      : `<li class="muted" style="cursor:default;display:block">${ctx.words.some((w) => w.level === st.level) || q ? 'Không tìm thấy từ nào.' : 'Cấp này chưa có dữ liệu.'}</li>`;
    list.querySelectorAll('li[data-id]').forEach((li) => (li.onclick = () => openWord(ctx, li.dataset.id)));
  };
  el.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => {
    if (b.parentElement.dataset.g === 'level') { st.level = +b.dataset.v; st.topic = ''; } else st.topic = b.dataset.v;
    renderVocab(el, ctx);
  }));
  const inp = el.querySelector('input');
  inp.oninput = () => { st.q = inp.value; draw(); };
  el.querySelector('[data-lesson]').onchange = (e) => { st.lesson = e.target.value; draw(); };
  draw();
}

export function openWord(ctx, id) {
  const w = ctx.byId.get(id);
  const st = ctx.store.progress[id];
  const dlg = document.getElementById('dlg');
  const conf = (w.confusables || []).map((c) => ctx.byId.get(c)).filter(Boolean);
  const status = !st || !st.box ? 'Chưa học' : `${BOX_NAMES[st.box]} · ôn lại ${st.dueDate.split('-').reverse().join('/')} · quên ${st.lapses} lần${isLeech(st) ? ' · đang trong danh sách hay quên' : ''}`;
  dlg.innerHTML = `<div class="dlg-in"><div class="dlg-head"><span class="muted small">HSK ${w.hsk2}${w.hsk3 ? ` · HSK 3.0: cấp ${w.hsk3 === 7 ? '7–9' : w.hsk3}` : ''} ${stars(w.common)}${w.edited.length ? ' <span class="tag-edit">Đã chỉnh</span>' : ''}</span><button class="icon-btn" data-close aria-label="Đóng">✕</button></div>
    <div class="word-hero"><div class="py">${esc(w.pinyin)}</div><div class="hz" lang="zh-CN">${esc(w.hanzi)}</div><div>${sayBtn(w.hanzi)}</div></div>
    <dl class="kv">
      <dt>Nghĩa</dt><dd><b>${esc(w.meaning.join('; '))}</b></dd>
      <dt>Hán Việt</dt><dd>${w.hanViet ? esc(w.hanViet) : '<span class="muted">chưa có</span>'}</dd>
      <dt>Từ loại</dt><dd>${w.pos.map((x) => POS_VI[x] || x).join(', ')}</dd>
      ${w.measureWords?.length ? `<dt>Lượng từ</dt><dd class="zh">${esc(w.measureWords.join('、'))}</dd>` : ''}
      ${w.usage ? `<dt>Cách dùng</dt><dd>${esc(w.usage)}</dd>` : ''}
      <dt>Bài giáo trình</dt><dd>${lessonLabel(w) ? esc(lessonLabel(w)) : '<span class="muted">chưa có</span>'}</dd>
      ${conf.length ? `<dt>Dễ nhầm với</dt><dd>${conf.map((c) => `<a href="#" data-w="${c.id}" class="zh">${esc(c.hanzi)}</a> ${esc(c.pinyin)}`).join(' · ')}</dd>` : ''}
      <dt>Trạng thái ôn</dt><dd>${status}</dd>
    </dl>
    <h2>Câu mẫu</h2>
    ${(w.examples || []).map((x) => `<div class="ex"><div class="z" lang="zh-CN">${hl(x.zh)} ${sayBtn(x.zh)}</div><div class="y">${hl(x.py)}</div><div>${esc(x.vi)}</div></div>`).join('')}
    <div class="row" style="margin-top:8px"><button class="btn" data-edit>Sửa nghĩa, câu mẫu</button>${w.edited.length ? '<button class="btn ghost" data-revert>Khôi phục bản gốc</button>' : ''}</div>
    <h2>Thứ tự nét</h2>
    <div class="writer" id="dw"></div>
    <div class="row" style="margin-top:8px"><button class="btn" data-anim>Xem viết từng nét</button></div>
    ${w.check ? '<p class="small muted">Một số thông tin của từ này chưa được xác minh chắc chắn.</p>' : ''}
  </div>`;
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.querySelectorAll('[data-w]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); openWord(ctx, a.dataset.w); }));
  dlg.querySelector('[data-edit]').onclick = () => openEdit(ctx, id);
  const rv = dlg.querySelector('[data-revert]');
  if (rv) rv.onclick = () => {
    if (!rv.dataset.sure) { rv.dataset.sure = '1'; rv.textContent = 'Bấm lần nữa để khôi phục'; return; }
    for (const f of w.edited) ctx.store.saveEdit(id, f, null);
    ctx.applyEdits();
    ctx.refresh();
    openWord(ctx, id);
  };
  dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
  let writers = [];
  loadHanziWriter().then((HW) => {
    const box = dlg.querySelector('#dw');
    writers = [...w.hanzi].map((ch, i) => { const d = document.createElement('div'); d.id = `dw${i}`; box.append(d); return HW.create(d.id, ch, { width: 150, height: 150, padding: 10, showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 250 }); });
  }).catch(() => { dlg.querySelector('#dw').innerHTML = '<span class="muted small">Cần kết nối mạng để xem thứ tự nét.</span>'; });
  dlg.querySelector('[data-anim]').onclick = async () => { for (const wr of writers) await new Promise((r) => wr.animateCharacter({ onComplete: r })); };
  if (!dlg.open) dlg.showModal();
}

// Edit meaning, usage and examples. Everything typed here is shown through esc() / hl().
function openEdit(ctx, id) {
  const w = ctx.byId.get(id);
  const orig = ctx.originals.get(id);
  const dlg = document.getElementById('dlg');
  const exRow = (x = { zh: '', py: '', vi: '' }) => `<div class="ed-ex">
      <label class="small muted">Câu chữ Hán, đánh dấu từ đang học bằng *...*</label><input class="field" data-k="zh" lang="zh-CN" value="${esc(x.zh)}">
      <label class="small muted">Pinyin (tự sinh, sửa được)</label><input class="field" data-k="py" value="${esc(x.py)}">
      <label class="small muted">Nghĩa tiếng Việt</label><input class="field" data-k="vi" value="${esc(x.vi)}">
      <div class="small ed-warn" data-warn></div>
      <button class="btn ghost" data-del>Xóa câu này</button></div>`;
  dlg.innerHTML = `<div class="dlg-in ed-form"><div class="dlg-head"><b>Sửa <span lang="zh-CN">${esc(w.hanzi)}</span> ${esc(w.pinyin)}</b><button class="icon-btn" data-close aria-label="Đóng">✕</button></div>
    <label for="ed-m"><b>Nghĩa</b> <span class="small muted">mỗi dòng một nghĩa, tối đa 3 dòng</span></label>
    <textarea id="ed-m" class="field" rows="3">${esc(w.meaning.join('\n'))}</textarea>
    <label for="ed-u"><b>Cách dùng</b> <span class="small muted">có thể để trống</span></label>
    <textarea id="ed-u" class="field" rows="2">${esc(w.usage)}</textarea>
    <h2>Câu mẫu</h2>
    <div data-exs>${w.examples.map(exRow).join('')}</div>
    <button class="btn" data-add>Thêm câu</button>
    <p class="small ed-err" data-err role="alert"></p>
    <div class="row"><button class="btn" data-cancel>Hủy</button><button class="btn primary" data-save>Lưu</button></div>
  </div>`;
  const q = (sel) => dlg.querySelector(sel);
  const wire = (box) => {
    const zh = box.querySelector('[data-k=zh]');
    const py = box.querySelector('[data-k=py]');
    const warn = box.querySelector('[data-warn]');
    let timer;
    const check = () => {
      const v = zh.value.trim();
      const msgs = [];
      if (v && !/\*[^*]+\*/.test(v)) msgs.push('Chưa đánh dấu từ đang học bằng *...*.');
      const bad = v ? offLevel(v, w.level, ctx.dict) : [];
      if (bad.length) msgs.push(`Có từ ngoài HSK ${w.level}: ${bad.join(', ')}. Vẫn lưu được.`);
      warn.textContent = msgs.join(' ');
    };
    zh.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        check();
        if (py.dataset.manual || !zh.value.trim()) return;
        try { py.value = await autoPinyin(zh.value.trim(), ctx.dict); } catch { warn.textContent += ' Không tải được bộ tạo pinyin, hãy gõ pinyin.'; }
      }, 400);
    };
    py.oninput = () => { py.dataset.manual = py.value ? '1' : ''; };
    box.querySelector('[data-del]').onclick = () => box.remove();
    check();
  };
  dlg.querySelectorAll('.ed-ex').forEach(wire);
  q('[data-add]').onclick = () => {
    q('[data-exs]').insertAdjacentHTML('beforeend', exRow());
    const box = q('[data-exs]').lastElementChild;
    wire(box);
    box.querySelector('[data-k=zh]').focus();
  };
  const back = () => openWord(ctx, id);
  q('[data-close]').onclick = back;
  q('[data-cancel]').onclick = back;
  q('[data-save]').onclick = async () => {
    const err = q('[data-err]');
    const meaning = q('#ed-m').value.split('\n').map((x) => x.trim()).filter(Boolean);
    const usage = q('#ed-u').value.trim();
    const boxes = [...dlg.querySelectorAll('.ed-ex')];
    const examples = [];
    for (const b of boxes) {
      const e = { zh: b.querySelector('[data-k=zh]').value.trim(), py: b.querySelector('[data-k=py]').value.trim(), vi: b.querySelector('[data-k=vi]').value.trim() };
      if (!e.zh && !e.py && !e.vi) continue;
      if (e.zh && !e.py) { try { e.py = await autoPinyin(e.zh, ctx.dict); } catch { /* leave empty */ } }
      examples.push(e);
    }
    if (cleanValue('meaning', meaning) === null) { err.textContent = 'Nghĩa cần 1 đến 3 dòng, mỗi dòng tối đa 200 ký tự.'; return; }
    if (cleanValue('usage', usage) === null) { err.textContent = 'Cách dùng tối đa 500 ký tự.'; return; }
    if (cleanValue('examples', examples) === null) { err.textContent = 'Mỗi câu mẫu cần chữ Hán có đánh dấu *...*; tối đa 5 câu.'; return; }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const next = { meaning, usage, examples };
    const base = { meaning: orig.meaning, usage: orig.usage || '', examples: orig.examples || [] };
    for (const f of ['meaning', 'usage', 'examples']) {
      if (same(next[f], w[f])) continue;
      ctx.store.saveEdit(id, f, same(next[f], base[f]) ? null : next[f]);
    }
    ctx.applyEdits();
    ctx.refresh();
    back();
  };
  if (!dlg.open) dlg.showModal();
}

/* ---------- Luyện tập ---------- */
const practiceState = { level: 1, topic: '', lesson: '', mode: 'auto' };
export function renderPractice(el, ctx) {
  const st = practiceState;
  const lv = ctx.levels.find((l) => l.level === st.level) || ctx.levels[0];
  const lessons = [...new Set(ctx.words.map(lessonLabel).filter(Boolean))].sort();
  const modes = [['auto', 'Tự động theo hộp'], ...Object.entries(MODE_NAMES).map(([k, v]) => [k, `${k}. ${v}`])];
  el.innerHTML = `<h1>Luyện tập</h1>
    <div class="form-row"><label for="p-lv">Cấp</label><select id="p-lv" class="field">${ctx.levels.map((l) => `<option value="${l.level}" ${l.level === st.level ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select></div>
    <div class="form-row"><label for="p-tp">Chủ đề</label><select id="p-tp" class="field"><option value="">Tất cả chủ đề</option>${(lv?.topics || []).map((t) => `<option value="${t.id}" ${t.id === st.topic ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></div>
    <div class="form-row"><label for="p-ls">Bài giáo trình</label><select id="p-ls" class="field" ${lessons.length ? '' : 'disabled'}><option value="">${lessons.length ? 'Không lọc theo bài' : 'Chưa có dữ liệu bài'}</option>${lessons.map((l) => `<option ${l === st.lesson ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="form-row"><label for="p-md">Dạng bài</label><select id="p-md" class="field">${modes.map(([k, v]) => `<option value="${k}" ${k === st.mode ? 'selected' : ''} ${k === '3' && !ctx.hasVoice() ? 'disabled' : ''}>${esc(v)}${k === '3' && !ctx.hasVoice() ? ' (máy chưa có giọng tiếng Trung)' : ''}</option>`).join('')}</select></div>
    <p class="muted small" data-count></p>
    <button class="btn primary big" data-go>Bắt đầu luyện</button>`;
  const q = (s) => el.querySelector(s);
  const scope = () => ctx.words.filter((w) => (st.lesson ? lessonLabel(w) === st.lesson : w.level === st.level && (!st.topic || w.topicId === st.topic)));
  const exScope = () => { const ids = new Set(scope().map((w) => w.id)); return ctx.exercises.filter((e) => e.targets.some((t) => ids.has(t)) && (st.mode === '7' ? e.type === 'fill' : e.type === 'order')); };
  const count = () => {
    const n = ['7', '8'].includes(st.mode) ? exScope().length : scope().length;
    q('[data-count]').textContent = `${n} ${['7', '8'].includes(st.mode) ? 'bài' : 'từ'} trong phạm vi này, mỗi phiên tối đa 20 câu.`;
    q('[data-go]').disabled = !n;
  };
  q('#p-lv').onchange = (e) => { st.level = +e.target.value; st.topic = ''; renderPractice(el, ctx); };
  q('#p-tp').onchange = (e) => { st.topic = e.target.value; count(); };
  q('#p-ls').onchange = (e) => { st.lesson = e.target.value; count(); };
  q('#p-md').onchange = (e) => { st.mode = e.target.value; count(); };
  q('[data-go]').onclick = () => {
    let cards;
    if (['7', '8'].includes(st.mode)) cards = shuffle(exScope()).slice(0, 20).map((e) => ({ wordId: e.targets[0], exercise: e }));
    else cards = shuffle(scope()).slice(0, 20).map((w) => ({ wordId: w.id, mode: st.mode === 'auto' ? undefined : +st.mode }));
    runSession(ctx, cards, { title: 'Luyện tập' });
  };
  count();
}

/* ---------- Từ hay quên ---------- */
export function renderLeeches(el, ctx) {
  const p = ctx.store.progress;
  const ws = ctx.words.filter((w) => isLeech(p[w.id])).sort((a, b) => p[b.id].lapses - p[a.id].lapses);
  el.innerHTML = `<h1>Từ hay quên</h1>
    <p class="muted small">Từ quên từ 2 lần trở lên. Từ sẽ rời danh sách khi trả lời đúng 3 lần liên tiếp trong ít nhất 2 ngày khác nhau.</p>
    ${ws.length ? `<button class="btn primary big" data-go>Ôn danh sách này · ${ws.length} từ</button>` : '<p>Chưa có từ nào. Tốt lắm!</p>'}
    <ul class="wlist" style="margin-top:14px">${ws.map((w) => `<li data-id="${w.id}"><span class="h" lang="zh-CN">${esc(w.hanzi)}</span><span class="p">${esc(w.pinyin)}</span><span class="lv">quên ${p[w.id].lapses} lần<br>${BOX_NAMES[p[w.id].box]}</span><span class="m">${esc(w.meaning.join('; '))}${w.edited.length ? ' <span class="tag-edit">Đã chỉnh</span>' : ''}</span></li>`).join('')}</ul>`;
  el.querySelectorAll('li[data-id]').forEach((li) => (li.onclick = () => openWord(ctx, li.dataset.id)));
  el.querySelector('[data-go]')?.addEventListener('click', () => runSession(ctx, ws.slice(0, 40).map((w) => ({ wordId: w.id })), { title: 'Từ hay quên' }));
}

/* ---------- Cài đặt ---------- */
export function openSettings(ctx) {
  const s = ctx.store.settings;
  const dlg = document.getElementById('dlg');
  dlg.innerHTML = `<form class="dlg-in" method="dialog"><div class="dlg-head"><h1 style="margin:0">Cài đặt</h1><button class="icon-btn" value="cancel" aria-label="Đóng">✕</button></div>
    <div class="form-row"><label for="s-new">Số từ mới mỗi ngày</label><input id="s-new" class="field" type="number" min="0" max="40" inputmode="numeric" value="${s.newPerDay}"></div>
    <div class="form-row"><label for="s-tb">Giáo trình</label><select id="s-tb" class="field"><option value="chuan">Giáo trình chuẩn HSK (HSK 标准教程)</option></select></div>
    <div class="form-row"><label for="s-ls">Đang học đến bài…</label><input id="s-ls" class="field" type="number" min="0" max="60" inputmode="numeric" placeholder="vd: 5" value="${esc(s.lesson)}"><div class="small muted">Từ thuộc các bài đã học được ưu tiên khi chọn từ mới (khi đã có dữ liệu bài).</div></div>
    <label class="check"><input type="checkbox" id="s-hp" ${s.hidePinyin ? 'checked' : ''}> Ẩn pinyin trên thẻ ôn</label>
    <label class="check"><input type="checkbox" id="s-hv" ${s.showHanViet ? 'checked' : ''}> Hiện âm Hán Việt</label>
    <div class="form-row"><label for="s-rate">Tốc độ đọc: <span data-rv>${s.rate}</span></label><input id="s-rate" type="range" min="0.5" max="1.2" step="0.1" value="${s.rate}" style="width:100%"></div>
    <div class="row"><button class="btn ghost" type="button" data-test>Nghe thử</button><button class="btn primary" value="save">Lưu</button></div></form>`;
  const q = (x) => dlg.querySelector(x);
  q('#s-rate').oninput = (e) => (q('[data-rv]').textContent = e.target.value);
  q('[data-test]').onclick = () => ctx.speak('你好，认识你很高兴。', +q('#s-rate').value);
  dlg.onclose = () => {
    if (dlg.returnValue !== 'save') return;
    ctx.store.setSettings({ newPerDay: Math.max(0, Math.min(40, +q('#s-new').value || 0)), textbook: q('#s-tb').value, lesson: q('#s-ls').value.trim(),
      hidePinyin: q('#s-hp').checked, showHanViet: q('#s-hv').checked, rate: +q('#s-rate').value });
    ctx.refresh();
  };
  dlg.returnValue = '';
  dlg.showModal();
}

/* ---------- Phiên ôn ---------- */
export function runSession(ctx, cards, { title }) {
  const el = ctx.view;
  document.body.classList.add('in-session');
  const queue = cards.map((c) => ({ ...c }));
  const retries = new Map();
  const wrong = new Set();
  let i = 0, good = 0, bad = 0;
  const exByWord = (id) => ctx.exercises.filter((e) => e.targets.includes(id));

  const exit = () => { document.body.classList.remove('in-session'); ctx.setKeys(null); ctx.store.flush(); ctx.go('today', true); };

  const step = () => {
    if (i >= queue.length) return summary();
    const card = queue[i];
    const state = ctx.store.progress[card.wordId];
    if (card.isNew && !card.introduced && isNew(state)) card.mode = 'intro';
    else if (!card.exercise && (card.mode == null || card.mode === 'intro')) {
      const m = modeFor(state, { exercises: exByWord(card.wordId), hasVoice: ctx.hasVoice() });
      if (m.exercise) card.exercise = m.exercise; else card.mode = m;
    }
    if (card.mode === 3 && !ctx.hasVoice()) card.mode = 1;
    el.innerHTML = `<div class="s-top"><button class="icon-btn" data-x aria-label="Thoát">✕</button><div class="s-prog"><i style="width:${(i / queue.length) * 100}%"></i></div><span class="muted small">${i + 1}/${queue.length}</span></div><div class="s-card"></div>`;
    el.querySelector('[data-x]').onclick = exit;
    renderCard(el.querySelector('.s-card'), card, ctx, (res) => {
      if (!res) { card.introduced = true; ctx.store.addNewToday(ctx.today(), card.wordId); card.mode = 1; return step(); }
      const now = ctx.store.now();
      const next = applyResult(ctx.store.progress[card.wordId], res.result, now, card.wordId, ctx.byId.has(res.chosen) ? res.chosen : '');
      ctx.store.record({ timestamp: new Date(now).toISOString(), mode: res.mode, result: res.result, exerciseId: res.exerciseId, chosen: res.chosen }, next);
      ctx.markStudyDay();
      if (res.result === 'again') {
        bad++; wrong.add(card.wordId);
        const n = retries.get(card.wordId) || 0;
        if (n < 2) { retries.set(card.wordId, n + 1); queue.splice(Math.min(queue.length, i + 4 + Math.floor(Math.random() * 3)), 0, { wordId: card.wordId, mode: 1 }); }
      } else good++;
      i++;
      step();
    });
    el.focus({ preventScroll: true });
  };

  const summary = () => {
    ctx.setKeys(null);
    ctx.store.flush();
    const ws = [...wrong].map((id) => ctx.byId.get(id));
    el.innerHTML = `<h1>${esc(title)}: xong!</h1>
      <div class="stats summary"><div class="stat"><b style="color:var(--ok)">✓ ${good}</b><span>câu đúng</span></div><div class="stat"><b style="color:var(--bad)">✗ ${bad}</b><span>câu sai</span></div></div>
      ${ws.length ? `<h2>Từ trả lời sai</h2><ul class="wlist">${ws.map((w) => `<li data-id="${w.id}"><span class="h" lang="zh-CN">${esc(w.hanzi)}</span><span class="p">${esc(w.pinyin)}</span><span class="lv"></span><span class="m">${esc(w.meaning.join('; '))}${w.edited.length ? ' <span class="tag-edit">Đã chỉnh</span>' : ''}</span></li>`).join('')}</ul>` : '<p>Không sai câu nào.</p>'}
      <div class="row" style="margin-top:16px">${ws.length ? '<button class="btn primary" data-again>Ôn lại các từ sai</button>' : ''}<button class="btn" data-done>Về trang Hôm nay</button></div>`;
    el.querySelectorAll('li[data-id]').forEach((li) => (li.onclick = () => openWord(ctx, li.dataset.id)));
    el.querySelector('[data-again]')?.addEventListener('click', () => runSession(ctx, ws.map((w) => ({ wordId: w.id, mode: 1 })), { title: 'Ôn lại từ sai' }));
    el.querySelector('[data-done]').onclick = exit;
  };
  step();
}
