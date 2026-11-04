// HSK Vocab API: progress and settings stored in a Google Sheet.
// GET  ?action=state                       -> { ok, now, progress: [...], settings: {...} }
// POST {action:'saveEvents', events:[...]}  -> append log, upsert progress (newer updatedAt wins)
// POST {action:'saveSettings', settings:{}} -> upsert settings
var SHEET_TITLE = 'HSK Vocab - Tiến độ ôn tập';
var TZ = 'Asia/Ho_Chi_Minh';
var TABS = {
  progress: ['wordId', 'box', 'dueDate', 'lapses', 'correctStreak', 'totalReviews', 'lastResult', 'confusedWith', 'updatedAt', 'streakStart', 'promotedOn'],
  log: ['timestamp', 'wordId', 'mode', 'result', 'exerciseId', 'chosen'],
  settings: ['key', 'value']
};
var NUM_FIELDS = ['box', 'lapses', 'correctStreak', 'totalReviews'];
var SETTING_KEYS = ['newPerDay', 'textbook', 'lesson', 'hidePinyin', 'showHanViet', 'rate', 'studyDays', '_updatedAt'];
var ID_RE = /^[a-z0-9ü-]{1,40}$/;
var MAX_EVENTS = 200;

/** Run once from the editor: creates the Sheet (first time) and the tabs. Safe to re-run. */
function setup() {
  var ss = getSs_(true);
  ensureTabs_(ss);
  Logger.log('Sheet: ' + ss.getUrl());
  return ss.getUrl();
}

function getSs_(create) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  if (!create) throw new Error('Chưa chạy setup()');
  var ss = SpreadsheetApp.create(SHEET_TITLE);
  ss.setSpreadsheetTimeZone(TZ);
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function ensureTabs_(ss) {
  Object.keys(TABS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var head = TABS[name];
    if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@'); // store everything as text
    var cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
    // write missing header cells only; never touch data rows
    for (var i = 0; i < head.length; i++) if (cur[i] !== head[i] && !cur[i]) sh.getRange(1, i + 1).setValue(head[i]);
    sh.setFrozenRows(1);
  });
  ss.getSheets().forEach(function (sh) {
    if (!TABS[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'ping') return json_({ ok: true, now: new Date().toISOString() });
    if (action !== 'state') return json_({ ok: false, error: 'unknown action' });
    var ss = getSs_(false);
    return json_({ ok: true, now: new Date().toISOString(), progress: readProgress_(ss), settings: readSettings_(ss) });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'saveEvents') return json_(saveEvents_(body.events));
    if (body.action === 'saveSettings') return json_(saveSettings_(body.settings));
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function readTable_(sh, width) {
  var n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, width).getValues() : [];
}

function readProgress_(ss) {
  var head = TABS.progress;
  return readTable_(ss.getSheetByName('progress'), head.length).filter(function (r) { return r[0]; }).map(function (r) {
    var o = {};
    head.forEach(function (h, i) { o[h] = String(r[i]); });
    NUM_FIELDS.forEach(function (h) { o[h] = Number(o[h]) || 0; });
    o.confusedWith = o.confusedWith ? o.confusedWith.split(',') : [];
    return o;
  });
}

function readSettings_(ss) {
  var out = {};
  readTable_(ss.getSheetByName('settings'), 2).forEach(function (r) { if (r[0]) out[String(r[0])] = String(r[1]); });
  return out;
}

function str_(v, max) { return String(v == null ? '' : v).slice(0, max || 200); }

function cleanState_(s, wordId) {
  if (!s || typeof s !== 'object') throw new Error('missing state');
  var box = Number(s.box);
  if (!(box >= 0 && box <= 5)) throw new Error('bad box');
  var date = /^\d{4}-\d{2}-\d{2}$/;
  var conf = (Array.isArray(s.confusedWith) ? s.confusedWith : []).filter(function (x) { return ID_RE.test(x); }).slice(0, 5);
  return [wordId, box, date.test(s.dueDate) ? s.dueDate : '', Number(s.lapses) || 0, Number(s.correctStreak) || 0,
    Number(s.totalReviews) || 0, str_(s.lastResult, 10), conf.join(','), str_(s.updatedAt, 30),
    date.test(s.streakStart) ? s.streakStart : '', date.test(s.promotedOn) ? s.promotedOn : ''].map(String);
}

function saveEvents_(events) {
  if (!Array.isArray(events) || !events.length) return { ok: true, saved: 0 };
  if (events.length > MAX_EVENTS) throw new Error('too many events (max ' + MAX_EVENTS + ')');
  var rows = events.map(function (ev) {
    if (!ev || !ID_RE.test(ev.wordId)) throw new Error('invalid wordId');
    if (['again', 'hard', 'good'].indexOf(ev.result) < 0) throw new Error('invalid result');
    return { log: [Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss'), ev.wordId, str_(ev.mode, 10), ev.result, str_(ev.exerciseId, 60), str_(ev.chosen, 40)],
      state: cleanState_(ev.state, ev.wordId) };
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = getSs_(false);
    var log = ss.getSheetByName('log');
    log.getRange(log.getLastRow() + 1, 1, rows.length, TABS.log.length).setNumberFormat('@').setValues(rows.map(function (r) { return r.log; }));

    var sh = ss.getSheetByName('progress');
    var width = TABS.progress.length;
    var data = readTable_(sh, width);
    var index = {};
    data.forEach(function (r, i) { if (r[0]) index[r[0]] = i; });
    var appended = [];
    rows.forEach(function (r) {
      var id = r.state[0];
      if (id in index) {
        var cur = data[index[id]];
        if (String(r.state[8]) >= String(cur[8])) data[index[id]] = r.state;
      } else {
        index[id] = data.length;
        data.push(r.state);
        appended.push(id);
      }
    });
    if (data.length) sh.getRange(2, 1, data.length, width).setNumberFormat('@').setValues(data.map(function (r) { return r.map(String); }));
    return { ok: true, saved: rows.length, now: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function saveSettings_(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('missing settings');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSs_(false).getSheetByName('settings');
    var data = readTable_(sh, 2);
    var cur = {};
    data.forEach(function (r) { if (r[0]) cur[r[0]] = r[1]; });
    if (cur._updatedAt && settings._updatedAt && String(settings._updatedAt) < String(cur._updatedAt)) return { ok: true, skipped: true };
    SETTING_KEYS.forEach(function (k) { if (k in settings) cur[k] = str_(settings[k], 2000); });
    var rows = Object.keys(cur).map(function (k) { return [k, String(cur[k])]; });
    if (data.length) sh.getRange(2, 1, data.length, 2).clearContent();
    sh.getRange(2, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
