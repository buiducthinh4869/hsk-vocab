// Local-first store: localStorage now, Google Sheet (Apps Script) in the background.
import { editKey, editState } from './edits.js';

const K = { progress: 'hsk.progress', settings: 'hsk.settings', queue: 'hsk.queue', newToday: 'hsk.newToday', edits: 'hsk.edits', editQueue: 'hsk.editQueue' };
export const DEFAULT_SETTINGS = { newPerDay: 8, textbook: 'chuan', lesson: '', hidePinyin: false, showHanViet: true, rate: 0.9, studyDays: '' };
const RETRY = [5, 15, 60];

const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export function createStore({ apiUrl, onStatus = () => {}, onRemote = () => {} }) {
  const progress = load(K.progress, {});
  let settings = { ...DEFAULT_SETTINGS, ...load(K.settings, {}) };
  let queue = load(K.queue, []);
  let edits = load(K.edits, {});
  let editQueue = load(K.editQueue, []); // [{op: 'save'|'revert', wordId, field, value, updatedAt}]
  let settingsDirty = !!settings._dirty;
  delete settings._dirty;
  let offset = 0, timer = null, sending = false, retryN = 0;

  const status = (s) => onStatus(apiUrl ? s : 'local');
  const now = () => Date.now() + offset;

  async function pull() {
    if (!apiUrl) return status('local');
    try {
      status('saving');
      const t0 = Date.now();
      const res = await fetch(`${apiUrl}?action=state`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      offset = Date.parse(data.now) - (t0 + Date.now()) / 2;
      let changed = false;
      for (const r of data.progress) {
        const l = progress[r.wordId];
        if (!l || (r.updatedAt || '') > (l.updatedAt || '')) { progress[r.wordId] = r; changed = true; }
      }
      const rs = data.settings || {};
      if ((rs._updatedAt || '') > (settings._updatedAt || '')) {
        settings = { ...DEFAULT_SETTINGS, ...parseSettings(rs) };
        settingsDirty = false;
        changed = true;
      }
      const merged = editState(data.edits || [], editQueue);
      if (JSON.stringify(merged) !== JSON.stringify(edits)) { edits = merged; changed = true; }
      save(K.progress, progress); save(K.settings, { ...settings, _dirty: settingsDirty }); save(K.edits, edits);
      if (changed) onRemote();
      if (queue.length || settingsDirty || editQueue.length) flush(); else status('saved');
    } catch (e) {
      status('error');
    }
  }

  function parseSettings(s) {
    const out = { ...s };
    for (const k of ['newPerDay', 'rate']) if (k in out) out[k] = Number(out[k]);
    for (const k of ['hidePinyin', 'showHanViet']) if (k in out) out[k] = out[k] === true || out[k] === 'true';
    return out;
  }

  function schedule() {
    clearTimeout(timer);
    if (queue.length >= 10) flush(); else timer = setTimeout(flush, 2000);
  }

  async function post(body, keepalive) {
    const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), keepalive });
    const data = await res.json();
    if (!data.ok) { const e = new Error(data.error || 'server'); e.server = true; throw e; }
  }

  async function flush(keepalive = false) {
    if (!apiUrl) return status('local');
    if (sending || (!queue.length && !settingsDirty && !editQueue.length)) return;
    sending = true;
    status('saving');
    clearTimeout(timer);
    try {
      if (settingsDirty) {
        const { _dirty, ...s } = settings;
        await post({ action: 'saveSettings', settings: s }, keepalive);
        settingsDirty = false;
        save(K.settings, settings);
      }
      while (queue.length) {
        const batch = queue.slice(0, keepalive ? 40 : 200);
        await post({ action: 'saveEvents', events: batch }, keepalive);
        queue = queue.slice(batch.length);
        save(K.queue, queue);
      }
      while (editQueue.length) {
        const { op, ...edit } = editQueue[0];
        try {
          await post({ action: op === 'revert' ? 'revertEdit' : 'saveEdit', edit }, keepalive);
        } catch (e) {
          if (!e.server || !/^invalid/.test(e.message)) throw e; // retry later unless the server rejected the data
        }
        editQueue = editQueue.slice(1);
        save(K.editQueue, editQueue);
      }
      retryN = 0;
      status('saved');
    } catch (e) {
      status('error');
      if (retryN < RETRY.length) timer = setTimeout(flush, RETRY[retryN++] * 1000);
    } finally {
      sending = false;
    }
  }

  return {
    now,
    get progress() { return progress; },
    get settings() { return settings; },
    get edits() { return edits; },
    // field value of a word as edited by the learner; value === null restores the original
    saveEdit(wordId, field, value) {
      const updatedAt = new Date(now()).toISOString();
      const k = editKey(wordId, field);
      if (value === null) delete edits[k]; else edits[k] = { wordId, field, value, updatedAt };
      editQueue.push(value === null ? { op: 'revert', wordId, field, updatedAt } : { op: 'save', wordId, field, value, updatedAt });
      save(K.edits, edits);
      save(K.editQueue, editQueue);
      schedule();
    },
    pull,
    flush,
    record(event, state) {
      progress[state.wordId] = state;
      save(K.progress, progress);
      queue.push({ ...event, wordId: state.wordId, state });
      save(K.queue, queue);
      schedule();
    },
    setSettings(patch) {
      settings = { ...settings, ...patch, _updatedAt: new Date(now()).toISOString() };
      settingsDirty = true;
      save(K.settings, { ...settings, _dirty: true });
      schedule();
    },
    newToday(today) { const v = load(K.newToday, {}); return v.date === today ? v.ids : []; },
    addNewToday(today, id) {
      const ids = this.newToday(today);
      if (!ids.includes(id)) save(K.newToday, { date: today, ids: [...ids, id] });
    },
  };
}
