// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  earliestAnalyticsDate, latestScheduleDate, optionsWithinCap, quotaExhausted, scopeExhausted,
} from '../src/utils/planGates.ts';
import { isPlanLimitCode, planLimitMessage, TOKEN_QUOTA_EXCEEDED } from '../src/utils/planLimitText.ts';
import { STRINGS } from '../src/i18n.ts';

const item = (over: Record<string, unknown>) => ({ key: 'BRAND_PROFILES', type: 'QUOTA', limit: 1, used: 0, included: true, ...over }) as never;

test('nút Tạo khoá khi hết lượt (biết chắc) — chưa có dữ liệu / không giới hạn thì mở', () => {
  assert.equal(quotaExhausted(item({ used: 1, limit: 1 })), true);
  assert.equal(quotaExhausted(item({ used: 0, limit: 1 })), false);
  assert.equal(quotaExhausted(item({ used: 9, limit: null })), false);
  assert.equal(quotaExhausted(undefined), false);
});

test('chiến lược / thương hiệu: khoá theo đúng thương hiệu đang chọn', () => {
  const strategies = item({ key: 'STRATEGIES_PER_BRAND', limit: 2, used: null, scopes: [
    { scopeId: 'b1', scopeName: 'A', used: 2 }, { scopeId: 'b2', scopeName: 'B', used: 1 },
  ] });
  assert.equal(scopeExhausted(strategies, 'b1'), true);
  assert.equal(scopeExhausted(strategies, 'b2'), false);
  assert.equal(scopeExhausted(strategies, null), false);
});

test('bộ chọn số ý tưởng giới hạn theo trần gói', () => {
  assert.deepEqual(optionsWithinCap([5, 10, 15, 20], 10), [5, 10]);
  assert.deepEqual(optionsWithinCap([5, 10, 15, 20], null), [5, 10, 15, 20]);
  assert.deepEqual(optionsWithinCap([5, 10, 15, 20], 3), [3], 'trần nhỏ hơn mọi lựa chọn → đúng trần');
});

test('ngày sớm nhất phân tích & ngày xa nhất lên lịch — cùng quy tắc backend', () => {
  assert.equal(earliestAnalyticsDate(7, '2026-10-21'), '2026-10-15', 'hôm nay là ngày thứ 1');
  assert.equal(earliestAnalyticsDate(null, '2026-10-21'), null);
  assert.equal(latestScheduleDate(30, '2026-10-21'), '2026-11-20');
  assert.equal(latestScheduleDate(null, '2026-10-21'), null);
});

test('hết token (1990) cũng là lỗi gói — câu dịch theo ngôn ngữ, không rơi vào nhánh 403 phân quyền', () => {
  assert.equal(isPlanLimitCode(TOKEN_QUOTA_EXCEEDED), true);
  assert.equal(isPlanLimitCode(1004), false);
  const en = STRINGS.en as unknown as Record<string, string>;
  assert.match(planLimitMessage(en, TOKEN_QUOTA_EXCEEDED, null), /token quota/);
  assert.match(planLimitMessage(en, 2206, { limitKey: 'ALLOWED_PLATFORMS', limit: 1, used: null, planCode: 'FREE', platform: 'THREADS' }),
    /does not include Threads/);
});
