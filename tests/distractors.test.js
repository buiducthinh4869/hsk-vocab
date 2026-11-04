import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pickDistractors, toneOptions, similarSound } from '../web/modules/distractors.js';

const W = (id, hanzi, pinyinNum, meaning, pos, hsk2, topicId, confusables = []) => ({ id, hanzi, pinyinNum, meaning: [meaning], pos: [pos], hsk2, topicId, confusables });
const pool = [
  W('mai3', '买', 'mai3', 'mua', 'v', 1, 't-shop', ['mai4']),
  W('mai4', '卖', 'mai4', 'bán', 'v', 2, 't-shop2'),
  W('chi1', '吃', 'chi1', 'ăn', 'v', 1, 't-food'),
  W('he1', '喝', 'he1', 'uống', 'v', 1, 't-food'),
  W('kan4', '看', 'kan4', 'xem, nhìn', 'v', 1, 't-act'),
  W('qu4', '去', 'qu4', 'đi', 'v', 1, 't-act'),
  W('lai2', '来', 'lai2', 'đến', 'v', 1, 't-act'),
  W('da4', '大', 'da4', 'to, lớn', 'adj', 1, 't-adj'),
  W('tai4', '太', 'tai4', 'quá', 'adv', 1, 't-adv'),
  W('xiao3', '小', 'xiao3', 'nhỏ', 'adj', 1, 't-adj'),
  W('dup', '买', 'mai3', 'mua sắm', 'v', 1, 't-x'),
  W('syn', '购', 'gou4', 'mua', 'v', 1, 't-x'),
];

test('买 (mode 2) always offers 卖 and never duplicates', () => {
  const target = pool[0];
  for (let k = 0; k < 200; k++) {
    const d = pickDistractors(target, pool);
    assert.equal(d.length, 3);
    assert.ok(d.some((w) => w.hanzi === '卖'), 'has 卖');
    const opts = [target, ...d];
    assert.equal(new Set(opts.map((w) => w.hanzi)).size, 4, 'unique hanzi');
    assert.equal(new Set(opts.map((w) => w.meaning[0])).size, 4, 'unique meanings');
    assert.ok(!d.some((w) => w.id === 'syn'), 'same meaning excluded');
  }
});

test('similar shape/sound tier is preferred for 大', () => {
  const d = pickDistractors(pool.find((w) => w.id === 'da4'), pool, { rand: () => 0.5 });
  assert.ok(d.some((w) => w.hanzi === '太'));
  assert.ok(similarSound(pool.find((w) => w.id === 'mai3'), pool.find((w) => w.id === 'mai4')));
  assert.ok(!similarSound(pool.find((w) => w.id === 'da4'), pool.find((w) => w.id === 'tai4')));
});

test('tone options are distinct and prefer 2<->3, 1<->4', () => {
  const t = toneOptions({ pinyinNum: 'xi3 huan' });
  assert.equal(t.answer, 'xǐ huan');
  assert.equal(t.options[0], 'xí huan');
  assert.equal(new Set([t.answer, ...t.options]).size, 4);
  const one = toneOptions({ pinyinNum: 'chi1' });
  assert.deepEqual(one.options, ['chì', 'chí', 'chǐ']);
});

test('real data: every word gets 3 unique options', () => {
  const words = [];
  for (const f of fs.readdirSync('data-src/topics')) {
    const t = JSON.parse(fs.readFileSync(`data-src/topics/${f}`, 'utf8'));
    words.push(...t.words.map((w) => ({ ...w, topicId: t.id })));
  }
  for (const w of words) {
    const d = pickDistractors(w, words);
    assert.equal(d.length, 3, w.hanzi);
    assert.equal(new Set([w, ...d].map((x) => x.hanzi)).size, 4, w.hanzi);
  }
});
