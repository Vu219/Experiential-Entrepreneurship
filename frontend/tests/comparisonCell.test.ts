// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS } from '../src/i18n.ts';
import { autoCellValue, cellDisplay } from '../src/utils/comparisonCell.ts';

const vi = STRINGS.vi as unknown as Record<string, string>;
const en = STRINGS.en as unknown as Record<string, string>;

test('ô tự động: ON = ✓, OFF = —, UNLIMITED theo ngôn ngữ', () => {
  assert.equal(autoCellValue({ kind: 'ON', value: null, platforms: null }, 'SCHEDULING', vi), true);
  assert.equal(autoCellValue({ kind: 'OFF', value: null, platforms: null }, 'GOLDEN_HOURS', vi), false);
  assert.equal(autoCellValue({ kind: 'UNLIMITED', value: null, platforms: null }, 'BRAND_PROFILES', vi), 'Không giới hạn');
  assert.equal(autoCellValue({ kind: 'UNLIMITED', value: null, platforms: null }, 'BRAND_PROFILES', en), 'Unlimited');
});

test('ô tự động NUMBER: số + đơn vị theo khoá (hồ sơ = chỉ con số, ngày có hậu tố)', () => {
  assert.equal(autoCellValue({ kind: 'NUMBER', value: 3, platforms: null }, 'BRAND_PROFILES', vi), '3');
  assert.equal(autoCellValue({ kind: 'NUMBER', value: 90, platforms: null }, 'ANALYTICS_HISTORY_DAYS', vi), '90 ngày');
  assert.equal(autoCellValue({ kind: 'NUMBER', value: 90, platforms: null }, 'ANALYTICS_HISTORY_DAYS', en), '90 days');
});

test('ô nền tảng: nền tảng khoá toàn hệ thống hiện "Sắp ra mắt", không liệt kê như đang dùng được', () => {
  const cell = { kind: 'PLATFORMS' as const, value: null, platforms: [
    { platform: 'FACEBOOK', comingSoon: false }, { platform: 'THREADS', comingSoon: true },
  ] };
  assert.equal(autoCellValue(cell, 'ALLOWED_PLATFORMS', vi), 'Facebook · Threads (Sắp ra mắt)');
  assert.equal(autoCellValue(cell, 'ALLOWED_PLATFORMS', en), 'Facebook · Threads (Coming soon)');
});

test('cellDisplay: một component cho mọi kiểu giá trị — ✓ / — / chữ / ô trống', () => {
  assert.deepEqual(cellDisplay(true), { kind: 'tick' });
  assert.deepEqual(cellDisplay(false), { kind: 'none' });
  assert.deepEqual(cellDisplay('Không giới hạn'), { kind: 'text', text: 'Không giới hạn' });
  assert.deepEqual(cellDisplay(''), { kind: 'empty' });
  assert.deepEqual(cellDisplay(null), { kind: 'empty' });
});
