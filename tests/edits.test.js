import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits, buildDict, cleanValue, editState, mergeWord, offLevel, sentencePinyin } from '../web/modules/edits.js';

const base = { id: 'ma3', hanzi: '马', meaning: ['ngựa'], usage: '', examples: [{ zh: '你会骑*马*吗？', py: 'Nǐ huì qí *mǎ* ma?', vi: 'Bạn biết cưỡi ngựa không?' }] };
const ed = (field, value, updatedAt = '2026-11-06T01:00:00.000Z', wordId = 'ma3') => ({ wordId, field, value, updatedAt });
const map = (...rows) => editState(rows);

test('no edits: original fields, not marked', () => {
  const m = mergeWord(base, {});
  assert.deepEqual(m.meaning, ['ngựa']);
  assert.equal(m.examples, base.examples);
  assert.deepEqual(m.edited, []);
});

test('edits replace only the edited fields', () => {
  const m = mergeWord(base, map(ed('meaning', ['ngựa', 'con ngựa']), ed('usage', 'Lượng từ: 匹.')));
  assert.deepEqual(m.meaning, ['ngựa', 'con ngựa']);
  assert.equal(m.usage, 'Lượng từ: 匹.');
  assert.equal(m.examples, base.examples);
  assert.deepEqual(m.edited, ['meaning', 'usage']);
});

test('edits of other words or unknown fields are ignored', () => {
  const m = mergeWord(base, map(ed('meaning', ['mẹ'], undefined, 'ma1'), ed('hanzi', '妈')));
  assert.deepEqual(m.meaning, ['ngựa']);
  assert.deepEqual(m.edited, []);
});

test('invalid values are ignored', () => {
  assert.equal(cleanValue('meaning', []), null);
  assert.equal(cleanValue('meaning', ['a', 'b', 'c', 'd']), null);
  assert.equal(cleanValue('examples', [{ zh: '没有标记', py: '', vi: '' }]), null);
  assert.deepEqual(cleanValue('meaning', [' ngựa ', '']), ['ngựa']);
  const m = mergeWord(base, { 'ma3|examples': ed('examples', [{ zh: 'no marker', py: '', vi: '' }]) });
  assert.equal(m.examples, base.examples);
});

test('newer server row wins; pending operations apply on top', () => {
  const rows = [ed('meaning', ['cũ'], '2026-11-01T00:00:00.000Z'), ed('meaning', ['mới'], '2026-11-02T00:00:00.000Z')];
  assert.deepEqual(editState(rows)['ma3|meaning'].value, ['mới']);
  const pendingRevert = [{ op: 'revert', wordId: 'ma3', field: 'meaning', updatedAt: '2026-11-03T00:00:00.000Z' }];
  assert.equal(editState(rows, pendingRevert)['ma3|meaning'], undefined);
  const olderSave = [{ op: 'save', wordId: 'ma3', field: 'meaning', value: ['cũ hơn'], updatedAt: '2026-11-01T12:00:00.000Z' }];
  assert.deepEqual(editState(rows, olderSave)['ma3|meaning'].value, ['mới']);
});

test('applyEdits works in place and can be reverted', () => {
  const words = [{ ...base }];
  const originals = new Map();
  applyEdits(words, map(ed('meaning', ['con ngựa'])), originals);
  assert.deepEqual(words[0].meaning, ['con ngựa']);
  assert.deepEqual(words[0].edited, ['meaning']);
  applyEdits(words, {}, originals);
  assert.deepEqual(words[0].meaning, ['ngựa']);
  assert.deepEqual(words[0].edited, []);
});

const dict = buildDict([
  { hanzi: '我', pinyinNum: 'wo3', level: 1 }, { hanzi: '姓', pinyinNum: 'xing4', level: 2 },
  { hanzi: '张', pinyinNum: 'zhang1', level: 2 }, { hanzi: '朋友', pinyinNum: 'peng2 you', level: 1 },
  { hanzi: '一', pinyinNum: 'yi1', level: 1 }, { hanzi: '个', pinyinNum: 'ge4', level: 1 }, { hanzi: '有', pinyinNum: 'you3', level: 1 },
]);

test('level warning lists words above the level and outside the list', () => {
  assert.deepEqual(offLevel('我*姓*张。', 2, dict), []);
  assert.deepEqual(offLevel('我*姓*张。', 1, dict), ['姓 (HSK 2)', '张 (HSK 2)']);
  assert.deepEqual(offLevel('我说', 3, dict), ['说 (ngoài bảng)']);
});

test('sentence pinyin: word readings, sandhi from the generator, marked target', () => {
  // as pinyin-pro returns them: full tones, sandhi on 一
  const auto = ['wǒ', 'yǒu', 'yí', 'gè', 'péng', 'yǒu'];
  assert.equal(sentencePinyin('我有一个*朋友*。', auto, dict), 'Wǒ yǒu yí ge *péngyou*.');
});
