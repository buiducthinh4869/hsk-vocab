import { API_URL } from './config.js';
import { createStore } from './modules/sync.js';
import { todayVN } from './modules/srs.js';
import { initTts, hasVoice, speak } from './modules/tts.js';
import { renderToday, renderVocab, renderPractice, renderLeeches, openSettings } from './modules/views.js';

const view = document.getElementById('view');
const syncEl = document.getElementById('sync');
const SYNC_TEXT = { saved: 'Đã lưu', saving: 'Đang lưu', error: 'Chưa lưu được', local: 'Chỉ lưu trên máy' };

let keyHandler = null;
document.addEventListener('keydown', (e) => {
  if (!keyHandler || e.ctrlKey || e.metaKey || e.altKey || document.getElementById('dlg').open) return;
  if (e.target.matches('input, select, textarea') && e.key !== 'Enter') return;
  keyHandler(e);
});

const ctx = {
  view,
  levels: [], allLevels: [], words: [], pool: [], byId: new Map(), exercises: [],
  store: null,
  today: () => todayVN(ctx.store.now()),
  hasVoice,
  speak: (text, rate) => speak(text, rate ?? ctx.store.settings.rate),
  setKeys: (fn) => { keyHandler = fn; },
  go: (route, force) => { if (location.hash !== `#/${route}`) location.hash = `#/${route}`; else if (force) render(); },
  refresh: () => { if (!document.body.classList.contains('in-session')) render(); },
  markStudyDay: () => {
    const t = ctx.today();
    const days = (ctx.store.settings.studyDays || '').split(',').filter(Boolean);
    if (!days.includes(t)) ctx.store.setSettings({ studyDays: [...days, t].slice(-90).join(',') });
  },
};

ctx.store = createStore({
  apiUrl: API_URL,
  onStatus: (s) => { syncEl.dataset.s = s; syncEl.querySelector('span').textContent = SYNC_TEXT[s]; },
  onRemote: () => ctx.refresh(),
});

async function loadData() {
  const index = await (await fetch('data/index.json', { cache: 'no-store' })).json();
  ctx.allLevels = index.levels;
  const lv = index.levels.filter((l) => l.topics.length);
  const files = await Promise.all(lv.map((l) => fetch(`data/hsk${l.level}.json?v=${l.v}`).then((r) => r.json())));
  for (const f of files) {
    ctx.levels.push({ level: f.level, title: `HSK ${f.level}`, topics: f.topics.map((t) => ({ id: t.id, title: t.title, order: t.order, level: f.level })) });
    for (const t of f.topics) {
      t.words.forEach((w) => {
        const lesson = w.textbooks?.chuan ? +(/B(\d+)/.exec(w.textbooks.chuan)?.[1] || 0) || null : null;
        const word = { ...w, topicId: t.id, level: f.level, topicOrder: f.level * 100 + t.order, index: ctx.words.length, lesson };
        ctx.words.push(word);
        ctx.byId.set(w.id, word);
      });
      ctx.exercises.push(...(t.exercises || []));
    }
  }
  ctx.pool = ctx.words;
}

const ROUTES = { today: renderToday, vocab: renderVocab, practice: renderPractice, leeches: renderLeeches };
function render() {
  const r = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'today';
  const fn = ROUTES[r] || renderToday;
  document.body.classList.remove('in-session');
  keyHandler = null;
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.r === r));
  fn(view, ctx);
  window.scrollTo(0, 0);
}

document.getElementById('btn-settings').onclick = () => openSettings(ctx);
window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ctx.store.flush(true); });
window.addEventListener('online', () => ctx.store.flush());

(async () => {
  try {
    await loadData();
  } catch (e) {
    view.innerHTML = '<h1>Không tải được dữ liệu</h1><p>Kiểm tra kết nối mạng rồi tải lại trang.</p>';
    return;
  }
  initTts(() => ctx.refresh());
  render();
  ctx.store.pull();
})();
