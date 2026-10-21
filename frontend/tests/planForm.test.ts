// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS } from '../src/i18n.ts';
import { PLAN_LIMIT_FIELDS } from '../src/api/planLimitCatalog.ts';
import type { PlanFeatureLimits } from '../src/api/planLimitCatalog.ts';
import {
  effectiveLimits, featureWarnings, fromLimitDraft, fromLimitDrafts, limitErrors, moveItem, resetKeys,
  suggestFeatureLines, toLimitDraft, toLimitDrafts,
} from '../src/utils/planForm.ts';

const vi = STRINGS.vi as unknown as Record<string, string>;
const field = (key: string) => PLAN_LIMIT_FIELDS.find((f) => f.key === key)!;

const FULL: PlanFeatureLimits = {
  brandProfiles: 3, strategiesPerBrand: 5, connectedChannels: 3, allowedPlatforms: ['FACEBOOK', 'THREADS'],
  trendResearchPerPeriod: 30, autoTrendResearch: true, ideasPerResearch: 10,
  scheduling: true, scheduledPostsPerPeriod: 100, activeSchedules: 50, scheduleHorizonDays: 30,
  goldenHours: true, analyticsHistoryDays: 90, analyticsAdvanced: true, analyticsExport: false,
  strategyOptimizationPerPeriod: -1, policyCheckAiPerPeriod: 30, aiFixPerVersion: 0,
};

test('segmented control số: giá trị thô ↔ chế độ [Giới hạn | Không giới hạn | Tắt | Mặc định]', () => {
  const f = field('BRAND_PROFILES');
  assert.deepEqual(toLimitDraft(f, 3), { kind: 'number', mode: 'limit', n: '3' });
  assert.deepEqual(toLimitDraft(f, -1), { kind: 'number', mode: 'unlimited', n: '' });
  assert.deepEqual(toLimitDraft(f, 0), { kind: 'number', mode: 'off', n: '' });
  assert.deepEqual(toLimitDraft(f, null), { kind: 'number', mode: 'default', n: '' });
  assert.equal(fromLimitDraft({ kind: 'number', mode: 'limit', n: '12' }), 12);
  assert.equal(fromLimitDraft({ kind: 'number', mode: 'unlimited', n: '' }), -1);
  assert.equal(fromLimitDraft({ kind: 'number', mode: 'off', n: '9' }), 0);
  assert.equal(fromLimitDraft({ kind: 'number', mode: 'default', n: '' }), null);
});

test('cờ + tập nền tảng: draft ↔ giá trị thô, khứ hồi đủ mọi khoá', () => {
  assert.deepEqual(toLimitDraft(field('SCHEDULING'), false), { kind: 'flag', mode: 'off' });
  assert.deepEqual(toLimitDraft(field('ALLOWED_PLATFORMS'), ['THREADS']), { kind: 'set', mode: 'list', platforms: ['THREADS'] });
  assert.deepEqual(fromLimitDrafts(toLimitDrafts(FULL)), FULL);
});

test('gói tự tạo: "Mặc định" là lỗi bắt buộc; số ngoài 1..100000 là lỗi; gói lõi được để Mặc định', () => {
  const drafts = toLimitDrafts({ ...FULL, goldenHours: null, brandProfiles: null });
  drafts.STRATEGIES_PER_BRAND = { kind: 'number', mode: 'limit', n: '0' };
  const custom = limitErrors(drafts, false);
  assert.equal(custom.GOLDEN_HOURS, 'required');
  assert.equal(custom.BRAND_PROFILES, 'required');
  assert.equal(custom.STRATEGIES_PER_BRAND, 'invalid');
  const core = limitErrors(drafts, true);
  assert.equal(core.GOLDEN_HOURS, undefined);
  assert.equal(core.STRATEGIES_PER_BRAND, 'invalid');
});

test('resetToDefault chỉ gồm khoá đang có giá trị mà admin chuyển sang Mặc định', () => {
  const drafts = toLimitDrafts(FULL);
  drafts.GOLDEN_HOURS = { kind: 'flag', mode: 'default' };
  assert.deepEqual(resetKeys(drafts, FULL), ['GOLDEN_HOURS']);
  assert.deepEqual(resetKeys(toLimitDrafts({ ...FULL, goldenHours: null }), { ...FULL, goldenHours: null }), []);
});

test('gợi ý từ giới hạn: sinh từ giá trị thật, nền tảng khoá ghi "Sắp ra mắt"', () => {
  const lines = suggestFeatureLines(effectiveLimits(toLimitDrafts(FULL), null), vi, ['THREADS']);
  assert.ok(lines.includes('3 hồ sơ thương hiệu'));
  assert.ok(lines.includes('Kết nối: Facebook · Threads (Sắp ra mắt)'));
  assert.ok(lines.includes('Lên lịch & tự động đăng (trước tối đa 30 ngày)'));
  assert.ok(!lines.some((l) => l.includes('Xuất báo cáo')), 'gói không gồm xuất báo cáo thì không gợi ý');
});

test('cảnh báo lệch: nhắc nền tảng ngoài gói / đang khoá, số hồ sơ & kênh không khớp', () => {
  const e = effectiveLimits(toLimitDrafts(FULL), null);
  const w = featureWarnings([
    'Đủ 3 nền tảng: Facebook · Instagram · Threads',
    '5 hồ sơ thương hiệu',
    'Kết nối 3 kênh',
    'Threads (Sắp ra mắt)',
  ], e, ['THREADS']);
  assert.ok(w.some((x) => x.line === 0 && x.kind === 'platformExcluded' && x.platform === 'INSTAGRAM'));
  assert.ok(w.some((x) => x.line === 0 && x.kind === 'platformLocked' && x.platform === 'THREADS'));
  assert.ok(w.some((x) => x.line === 1 && x.kind === 'brandCount' && x.expected === '3'));
  assert.ok(!w.some((x) => x.line === 2), 'số kênh khớp → không cảnh báo');
  assert.ok(!w.some((x) => x.line === 3), 'đã ghi "Sắp ra mắt" → đúng sự thật');
});

test('moveItem: kéo thả / ↑↓ đổi chỗ, chỉ số sai giữ nguyên', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 1), ['a', 'c', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 0, 5), ['a', 'b']);
});
