import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPinyin, numToMarks, marksToNum, foldVi } from '../web/modules/pinyin.js';

test('pinyin input checking', () => {
  assert.equal(checkPinyin('ni3 hao3', 'nǐ hǎo'), 'correct');
  assert.equal(checkPinyin('nǐ hǎo', 'nǐ hǎo'), 'correct');
  assert.equal(checkPinyin('ni hao', 'nǐ hǎo'), 'tone');
  assert.equal(checkPinyin('xi3huan5', 'xǐhuan'), 'correct');
  assert.equal(checkPinyin('nv3er2', "nǚ'ér"), 'correct');
  assert.equal(checkPinyin('ma3', 'nǐ'), 'wrong');
  assert.equal(numToMarks('zen3 me yang4'), 'zěn me yàng');
});

test('marks to numbers and Vietnamese folding', () => {
  assert.equal(marksToNum('duōshao', ['duo', 'shao']), 'duo1 shao');
  assert.equal(marksToNum('búkèqi', ['bu', 'ke', 'qi']), 'bu2 ke4 qi');
  assert.equal(foldVi('Đường đi'), 'duong di');
});
