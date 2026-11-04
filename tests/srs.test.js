import test from 'node:test';
import assert from 'node:assert/strict';
import { applyResult, isLeech, todayVN } from '../web/modules/srs.js';

const T = (iso) => Date.parse(iso);

test('VN midnight boundary', () => {
  assert.equal(todayVN(T('2026-11-04T16:59:59Z')), '2026-11-04');
  assert.equal(todayVN(T('2026-11-04T17:00:00Z')), '2026-11-05');
});

test('box transitions and once-per-day promotion', () => {
  let s = applyResult(null, 'good', T('2026-11-04T03:00:00Z'), 'chi1');
  assert.equal(s.box, 1); assert.equal(s.dueDate, '2026-11-05');
  s = applyResult(s, 'good', T('2026-11-04T05:00:00Z'));
  assert.equal(s.box, 1, 'no second promotion the same day');
  s = applyResult(s, 'good', T('2026-11-05T03:00:00Z'));
  assert.equal(s.box, 2); assert.equal(s.dueDate, '2026-11-08');
  s = applyResult(s, 'hard', T('2026-11-08T03:00:00Z'));
  assert.equal(s.box, 2); assert.equal(s.dueDate, '2026-11-09');
  s = applyResult(s, 'again', T('2026-11-09T03:00:00Z'), null, 'he1');
  assert.equal(s.box, 1); assert.equal(s.lapses, 1); assert.equal(s.dueDate, '2026-11-09');
  assert.deepEqual(s.confusedWith, ['he1']);
});

test('leech list in and out', () => {
  let s = applyResult(null, 'again', T('2026-11-04T03:00:00Z'), 'mai3');
  s = applyResult(s, 'again', T('2026-11-04T04:00:00Z'));
  assert.equal(isLeech(s), true);
  s = applyResult(s, 'good', T('2026-11-04T05:00:00Z'));
  s = applyResult(s, 'good', T('2026-11-04T06:00:00Z'));
  s = applyResult(s, 'good', T('2026-11-04T07:00:00Z'));
  assert.equal(isLeech(s), true, '3 correct on one day is not enough');
  s = applyResult(s, 'good', T('2026-11-05T03:00:00Z'));
  assert.equal(isLeech(s), false);
});

