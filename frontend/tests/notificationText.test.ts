// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS } from '../src/i18n.ts';
import { fillTemplate, notificationText } from '../src/notifications/text.ts';
import { notificationTarget } from '../src/notifications/links.ts';
import { createToastGate } from '../src/notifications/toastGate.ts';
import type { AppNotification, NotificationType } from '../src/api/notifications.ts';

const vi = STRINGS.vi as unknown as Record<string, string>;
const en = STRINGS.en as unknown as Record<string, string>;

const TYPES: NotificationType[] = [
  'POST_PUBLISHED', 'POST_FAILED', 'POST_REMOVED_BY_PLATFORM', 'SCHEDULE_OVERDUE', 'SCHEDULE_HELD', 'RECONNECT_NEEDED', 'TOKEN_EXPIRING',
  'REVIEW_NEEDED', 'CONTENT_GENERATION_FAILED', 'TREND_RESEARCH_DONE', 'TREND_RESEARCH_FAILED', 'NEW_INSIGHT',
  'PAYMENT_SUCCEEDED', 'PLAN_EXPIRING', 'PLAN_EXPIRED', 'AI_QUOTA_WARNING', 'AI_QUOTA_EXHAUSTED', 'SCHEDULE_UPCOMING',
  'PAYMENT_WEBHOOK_ALERT', 'ADMIN_USAGE_ALERT', 'ADMIN_AI_DEGRADED', 'ADMIN_API_VERSION',
];

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: 'n1', type: 'POST_PUBLISHED', title: 'VI title', message: 'VI message', refId: null, readAt: null,
  createdAt: '2026-10-14T08:00:00Z', ...over,
});

test('every type has title + body keys in vi AND en (khớp enum backend)', () => {
  for (const type of TYPES) {
    for (const [lang, dict] of [['vi', vi], ['en', en]] as const) {
      assert.ok(dict[`ntf_${type}_title`], `${lang} ntf_${type}_title`);
      assert.ok(dict[`ntf_${type}_body`], `${lang} ntf_${type}_body`);
    }
  }
  for (const v of ['HELD_DISPATCH', 'HELD_DISCONNECTED', 'HELD_DATA_DELETION', 'HELD_DEAUTHORIZED', 'HELD_INVALID', 'EXPIRED']) {
    assert.ok(vi[`ntf_RECONNECT_NEEDED_body_${v}`] && en[`ntf_RECONNECT_NEEDED_body_${v}`], v);
  }
});

test('SCHEDULE_HELD: mỗi lý do giữ có câu riêng (vi/en) + bấm mở đúng lịch', () => {
  for (const v of ['PLATFORM_DISABLED', 'PLAN_PLATFORM_EXCLUDED', 'PLAN_SCHEDULING_DISABLED']) {
    assert.ok(vi[`ntf_SCHEDULE_HELD_body_${v}`] && en[`ntf_SCHEDULE_HELD_body_${v}`], v);
  }
  const item = n({ type: 'SCHEDULE_HELD', refType: 'PLATFORM', params: { variant: 'PLATFORM_DISABLED', platform: 'THREADS', count: 3 } });
  assert.match(notificationText(item, en, 'en').body, /3 .*Threads/);
  assert.deepEqual(notificationTarget(item), { route: 'calendar' });
  assert.deepEqual(notificationTarget(n({ type: 'SCHEDULE_HELD', refType: 'SCHEDULE', refId: 's1' })), { path: '/calendar/s1' });
});

test('legacy notification (no params) shows the stored Vietnamese text', () => {
  assert.deepEqual(notificationText(n({}), en, 'en'), { title: 'VI title', body: 'VI message' });
});

test('params render in the viewer language with platform display name', () => {
  const item = n({ params: { platform: 'FACEBOOK', accountName: 'Trang A' } });
  assert.deepEqual(notificationText(item, en, 'en'), { title: 'Post published', body: 'Your post is live on Facebook (Trang A).' });
  assert.equal(notificationText(item, vi, 'vi').body, 'Bài viết đã được đăng lên Facebook (Trang A).');
});

test('variant picks the specific body key', () => {
  const item = n({ type: 'RECONNECT_NEEDED', params: { variant: 'HELD_DISCONNECTED', accountName: 'Shop', platform: 'THREADS', held: 3 } });
  assert.match(notificationText(item, en, 'en').body, /You disconnected Shop on Threads\. 3 scheduled posts/);
});

test('publish errors come from the catalog by code, never raw platform text', () => {
  const item = n({ type: 'POST_FAILED', params: { code: 'POLICY_VIOLATION', platform: 'FACEBOOK', accountName: 'Trang A', reference: 'ERR-abc123' } });
  const text = notificationText(item, en, 'en');
  assert.notEqual(text.title, 'VI title');
  assert.match(text.body, /Reference: ERR-abc123\./);
});

test('generation failure explains the AI error code', () => {
  const item = n({ type: 'CONTENT_GENERATION_FAILED', params: { platform: 'FACEBOOK', brandName: 'B', errorCode: 'AI_TIMEOUT' } });
  const body = notificationText(item, vi, 'vi').body;
  assert.match(body, /^AI chưa tạo được nội dung Facebook cho B\. \S/);
});

test('dates are formatted, missing params collapse cleanly', () => {
  assert.equal(fillTemplate('Hết hạn {expiresAt}.', { expiresAt: '2026-10-21' }, 'en'), 'Hết hạn Oct 21, 2026.');
  assert.equal(fillTemplate('A {missing} B', {}, 'vi'), 'A B');
});

test('unknown type with params falls back to stored text', () => {
  const item = n({ type: 'SOMETHING_NEW' as NotificationType, params: { x: 1 } });
  assert.equal(notificationText(item, vi, 'vi').title, 'VI title');
});

test('deep links follow refType, legacy rows fall back to the page', () => {
  assert.deepEqual(notificationTarget(n({ refType: 'SCHEDULE', refId: 's1' })), { path: '/calendar/s1' });
  assert.deepEqual(notificationTarget(n({ refId: 'p1' })), { route: 'calendar' }, 'bản ghi cũ: refId là post, không có refType');
  assert.deepEqual(notificationTarget(n({ type: 'POST_FAILED', refType: 'POST', refId: 'p1' })), { route: 'failedPosts', search: '?post=p1' });
  assert.deepEqual(notificationTarget(n({ type: 'REVIEW_NEEDED', refId: 'i1' })), { route: 'create', search: '?view=i1' });
  assert.deepEqual(notificationTarget(n({ type: 'CONTENT_GENERATION_FAILED', refId: 'i1' })), { path: '/create/i1?step=2' });
  assert.deepEqual(notificationTarget(n({ type: 'NEW_INSIGHT', refId: 'st' })), { route: 'brand', search: '?tab=strategy&strategy=st' });
  assert.deepEqual(notificationTarget(n({ type: 'TOKEN_EXPIRING', refId: 'a' })), { route: 'settings', search: '?tab=connections' });
  assert.deepEqual(notificationTarget(n({ type: 'AI_QUOTA_EXHAUSTED' })), { route: 'usage' });
  assert.deepEqual(notificationTarget(n({ type: 'PAYMENT_WEBHOOK_ALERT' })), { path: '/admin/revenue?tab=orders' });
});

test('toast gate: 3 per 10s, the rest is summarised', () => {
  let clock = 0;
  const gate = createToastGate(3, 10_000, () => clock);
  assert.deepEqual([gate.offer(), gate.offer(), gate.offer(), gate.offer(), gate.offer()], [true, true, true, false, false]);
  assert.equal(gate.takeSuppressed(), 2);
  assert.equal(gate.takeSuppressed(), 0);
  clock = 10_001;
  assert.equal(gate.offer(), true, 'cửa sổ trôi qua → hiện lại');
});
