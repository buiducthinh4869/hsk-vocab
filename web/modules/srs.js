// Leitner boxes. Dates are 'yyyy-MM-dd' in Vietnam time (UTC+7, no DST).
export const INTERVALS = [0, 1, 3, 7, 14, 30];
export const MAX_CARDS = 40;

export function todayVN(now = Date.now()) {
  return new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
}
export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function newState(wordId) {
  return { wordId, box: 0, dueDate: '', lapses: 0, correctStreak: 0, totalReviews: 0, lastResult: '',
    confusedWith: [], streakStart: '', promotedOn: '', updatedAt: '' };
}
export const isNew = (s) => !s || !s.box;
export const isDue = (s, today) => !!s && s.box > 0 && s.dueDate <= today;

// result: 'again' (Chưa nhớ / sai) | 'hard' (Tạm) | 'good' (Thuộc / đúng)
export function applyResult(prev, result, now, wordId, chosenId) {
  const today = todayVN(now);
  const s = { ...newState(wordId || prev?.wordId), ...prev };
  s.confusedWith = [...(s.confusedWith || [])];
  s.totalReviews++;
  s.lastResult = result;
  s.updatedAt = new Date(now).toISOString();
  if (result === 'again') {
    s.box = 1;
    s.lapses++;
    s.dueDate = today;
    s.correctStreak = 0;
    s.streakStart = '';
    if (chosenId && chosenId !== s.wordId) s.confusedWith = [chosenId, ...s.confusedWith.filter((x) => x !== chosenId)].slice(0, 5);
  } else if (result === 'hard') {
    s.box = Math.max(1, s.box);
    s.dueDate = addDays(today, 1);
  } else {
    if (s.promotedOn !== today) {
      const wasTop = s.box === 5;
      s.box = Math.min(5, s.box + 1);
      s.dueDate = addDays(today, wasTop ? 60 : INTERVALS[s.box]);
      s.promotedOn = today;
    } else if (!s.dueDate || s.dueDate <= today) {
      s.dueDate = addDays(today, 1);
    }
    if (s.correctStreak === 0) s.streakStart = today;
    s.correctStreak++;
  }
  return s;
}

// "Từ hay quên": lapses >= 2, leaves after 3 correct in a row spread over >= 2 different days.
export function isLeech(s) {
  if (!s || s.lapses < 2) return false;
  const graduated = s.correctStreak >= 3 && s.streakStart && s.streakStart < todayVN(Date.parse(s.updatedAt));
  return !graduated;
}

// words: [{id, topicOrder, index, common, lesson}] in display order.
export function buildSession({ words, progress, today, newLimit, lessonMax, max = MAX_CARDS }) {
  const due = words.filter((w) => isDue(progress[w.id], today));
  due.sort((a, b) => {
    const sa = progress[a.id], sb = progress[b.id];
    const la = isLeech(sa), lb = isLeech(sb);
    if (la !== lb) return la ? -1 : 1;
    if (la && sa.lapses !== sb.lapses) return sb.lapses - sa.lapses;
    return sa.box - sb.box || a.index - b.index;
  });
  const fresh = words.filter((w) => isNew(progress[w.id]));
  const inLesson = (w) => (lessonMax && w.lesson != null && w.lesson <= lessonMax ? 0 : 1);
  fresh.sort((a, b) => inLesson(a) - inLesson(b) || a.topicOrder - b.topicOrder || (b.common || 0) - (a.common || 0) || a.index - b.index);
  const cards = [...due.map((w) => ({ wordId: w.id, isNew: false })), ...fresh.slice(0, Math.max(0, newLimit)).map((w) => ({ wordId: w.id, isNew: true }))];
  return cards.slice(0, max);
}

// Exercise type for a word by box. Returns 1..9 | 'fill' | 'order' | {exercise}
export function modeFor(state, { exercises = [], hasVoice = true } = {}) {
  const n = state?.totalReviews || 0;
  const box = state?.box || 0;
  if (box <= 2) {
    const r = hasVoice ? [1, 3, 4] : [1, 4];
    return box === 0 ? 1 : r[n % r.length];
  }
  if (box === 3) return [2, 5, 6][n % 3];
  if (exercises.length) return { exercise: exercises[n % exercises.length] };
  return [5, 9][n % 2];
}

export function streakDays(days, today) {
  const set = new Set(days);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
