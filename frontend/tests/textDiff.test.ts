// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffWords, formatHashtags, hasChanges, parseHashtags, tokenize } from '../src/components/aiAssist/textDiff.ts';

const join = (segs: { text: string }[]) => segs.map((s) => s.text).join('');

test('diff keeps both texts reconstructable', () => {
  const before = 'Cam kết hoàn tiền 100% nếu không hiệu quả!';
  const after = 'Đổi trả trong 7 ngày nếu chưa hài lòng!';
  const segs = diffWords(before, after);
  assert.equal(join(segs.filter((s) => s.kind !== 'added')), before);
  assert.equal(join(segs.filter((s) => s.kind !== 'removed')), after);
});

test('only changed words are marked', () => {
  const segs = diffWords('Kem dưỡng tốt nhất thị trường cho da khô', 'Kem dưỡng dịu nhẹ cho da khô');
  assert.deepEqual(segs.filter((s) => s.kind === 'removed').map((s) => s.text.trim()), ['tốt nhất thị trường']);
  assert.deepEqual(segs.filter((s) => s.kind === 'added').map((s) => s.text.trim()), ['dịu nhẹ']);
  assert.equal(segs[0].kind, 'same');
});

test('identical and empty inputs', () => {
  assert.deepEqual(diffWords('a b', 'a b'), [{ kind: 'same', text: 'a b' }]);
  assert.deepEqual(diffWords('', 'mới'), [{ kind: 'added', text: 'mới' }]);
  assert.deepEqual(diffWords('cũ', ''), [{ kind: 'removed', text: 'cũ' }]);
  assert.equal(hasChanges(' x ', 'x'), false);
  assert.equal(hasChanges('x', 'y'), true);
});

test('very long texts fall back to whole replacement', () => {
  const long = Array.from({ length: 2000 }, (_, i) => `w${i}`).join(' ');
  const segs = diffWords(long, 'ngắn');
  assert.deepEqual(segs.map((s) => s.kind), ['removed', 'added']);
});

test('hashtag parsing and formatting', () => {
  assert.deepEqual(parseHashtags('#Sale, sale #skincare  #'), ['Sale', 'skincare']);
  assert.equal(formatHashtags(['a', 'b']), '#a #b');
  assert.deepEqual(tokenize(' a  b'), [' ', 'a  ', 'b']);
});
