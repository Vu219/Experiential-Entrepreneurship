import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBatchResult, blockOf, initialRows, localConflicts, submitSummary, toBatchRows, addWallMinutes, earliestTimeOn, isSlotPast, validateRow, wallDateTime, wallDiffMinutes,
  applySharedToggle, bookedDays, calendarStateFor, convertGoldenHours, nearestSlotsFrom, nowWallIn, pickCalendarDay, rezoneSchedules, rowBadge, slotsOnDay,
  type PlannerAccount, type PlannerRow, type SharedTime,
} from '../src/components/schedule/plannerLogic.ts';
import { monthGrid, monthOfDay, shiftDay, shiftDayByMonth, shiftMonth, weekdayIndex } from '../src/components/schedule/scheduleCalendarLogic.ts';
import type { ContentVersionResponse } from '../src/api/contentGeneration.ts';
import type { PostSchedule } from '../src/api/schedules.ts';

const version = (id: string, platformName: 'FACEBOOK' | 'INSTAGRAM' | 'THREADS', patch: Partial<ContentVersionResponse> = {}) =>
  ({ id, platformName, status: 'FORMATTED', scheduleStatus: null, formattedHashtags: [], ...patch }) as ContentVersionResponse;
const accounts: PlannerAccount[] = [
  { id: 'fb-page', platform: 'FACEBOOK', accountName: 'Page' },
  { id: 'th-1', platform: 'THREADS', accountName: 'Threads' },
];
let seq = 0;
const newKey = () => `k${++seq}`;
const off: SharedTime = { enabled: false, date: '', time: '' };

test('one row per platform; Instagram, unformatted, scheduled and unconnected rows are locked with a reason', () => {
  const rows = initialRows([
    version('v-fb', 'FACEBOOK'),
    version('v-ig', 'INSTAGRAM'),
    version('v-th', 'THREADS', { status: 'GENERATED' }),
  ], accounts, newKey);
  assert.deepEqual(rows.map((r) => [r.platform, r.block, r.mode, r.accountId]), [
    ['FACEBOOK', null, 'SCHEDULE', 'fb-page'],
    ['INSTAGRAM', 'UNSUPPORTED_MEDIA', 'NONE', ''],
    ['THREADS', 'NOT_FORMATTED', 'NONE', 'th-1'],
  ]);
  assert.equal(blockOf(version('v', 'FACEBOOK', { scheduleStatus: 'SCHEDULED' }), accounts), 'ALREADY_SCHEDULED');
  assert.equal(blockOf(version('v', 'THREADS'), [accounts[0]]), 'NO_ACCOUNT');
});

test('shared time applies to SCHEDULE rows only; suggested slots and NOW keep their own time', () => {
  const [row] = initialRows([version('v-fb', 'FACEBOOK')], accounts, newKey);
  const shared: SharedTime = { enabled: true, date: '2030-10-01', time: '20:00' };
  assert.equal(wallDateTime({ ...row, date: '2030-10-02', time: '08:00' }, shared), '2030-10-01T20:00');
  assert.equal(wallDateTime({ ...row, mode: 'SUGGEST', date: '2030-10-02', time: '11:00' }, shared), '2030-10-02T11:00');
  assert.equal(wallDateTime({ ...row, mode: 'NOW' }, shared), null);
  assert.equal(validateRow({ ...row, date: '2030-10-02', time: '08:00' }, off, '2030-10-02T09:00'), 'PAST');
  assert.equal(validateRow(row, off, '2030-10-02T09:00'), 'MISSING_TIME');
  assert.equal(validateRow({ ...row, accountId: '' }, off, '2030-10-02T09:00'), 'MISSING_ACCOUNT');
  assert.equal(validateRow({ ...row, mode: 'NOW' }, off, '2030-10-02T09:00'), null);
});

test('retry keeps the idempotency key for the same payload and rotates it when the payload changes', () => {
  let rows: PlannerRow[] = initialRows([version('v-fb', 'FACEBOOK'), version('v-th', 'THREADS')], accounts, newKey);
  rows = rows.map((r) => ({ ...r, date: '2030-10-01', time: '20:00' }));
  const first = toBatchRows(rows, off, newKey);
  assert.equal(first.payload.length, 2);
  assert.equal(first.payload[0].scheduledTime, '2030-10-01T20:00:00');
  assert.equal(first.payload[0].mode, 'SCHEDULE');

  // FB thành công, Threads lỗi → lần sau chỉ gửi Threads, cùng key.
  const merged = applyBatchResult(first.rows, {
    succeeded: 1, failed: 1, rows: [
      { clientRowId: 'v-fb', code: 200, message: 'Success', schedule: null },
      { clientRowId: 'v-th', code: 1936, message: 'Kết nối không hoạt động', schedule: null },
    ],
  });
  const retry = toBatchRows(merged, off, newKey);
  assert.deepEqual(retry.payload.map((p) => p.clientRowId), ['v-th']);
  assert.equal(retry.payload[0].idempotencyKey, first.payload[1].idempotencyKey);

  const changed = toBatchRows(retry.rows.map((r) => (r.versionId === 'v-th' ? { ...r, time: '21:00' } : r)), off, newKey);
  assert.notEqual(changed.payload[0].idempotencyKey, first.payload[1].idempotencyKey);
});

test('NOW rows are sent without a time and partial results mark rows individually', () => {
  const rows = initialRows([version('v-fb', 'FACEBOOK')], accounts, newKey).map((r) => ({ ...r, mode: 'NOW' as const }));
  const { payload } = toBatchRows(rows, off, newKey);
  assert.equal(payload[0].mode, 'NOW');
  assert.equal(payload[0].scheduledTime, undefined);
  const after = applyBatchResult(rows, { succeeded: 0, failed: 1, rows: [{ clientRowId: 'v-fb', code: 2138, message: 'Cần duyệt', schedule: null }] });
  assert.equal(after[0].result?.ok, false);
  assert.equal(after[0].result?.code, 2138);
});

test('local conflict check uses the publishing timezone and the configured window', () => {
  const at = (iso: string) => ({ id: iso, platformAccountId: 'fb-page', status: 'SCHEDULED', scheduledTime: iso }) as PostSchedule;
  const schedules = [at('2030-10-01T19:30:00+07:00'), at('2030-10-01T21:00:00+07:00')];
  assert.deepEqual(localConflicts('fb-page', '2030-10-01T20:00', schedules, 60).map((s) => s.id), ['2030-10-01T19:30:00+07:00']);
  assert.deepEqual(localConflicts('fb-page', '2030-10-01T20:00', schedules, 0), []);
  assert.deepEqual(localConflicts('other', '2030-10-01T20:00', schedules, 60), []);
});

test('publish time must be at least MIN_LEAD_MINUTES ahead; wall diff crosses days', () => {
  const [row] = initialRows([version('v-fb', 'FACEBOOK')], accounts, newKey);
  const at = (time: string) => ({ ...row, date: '2030-10-02', time });
  assert.equal(validateRow(at('09:00'), off, '2030-10-02T09:00'), 'PAST');
  assert.equal(validateRow(at('09:04'), off, '2030-10-02T09:00'), 'TOO_SOON');
  assert.equal(validateRow(at('09:05'), off, '2030-10-02T09:00'), null);
  assert.equal(wallDiffMinutes('2030-10-03T00:10', '2030-10-02T23:50'), 20);
});

test('submit summary drives the primary button label', () => {
  const rows = initialRows([version('v-fb', 'FACEBOOK'), version('v-th', 'THREADS')], accounts, newKey)
    .map((r) => ({ ...r, date: '2030-10-01', time: '18:34' }));
  assert.deepEqual(submitSummary(rows, off), { kind: 'schedule', count: 2, at: '2030-10-01T18:34' });
  assert.deepEqual(submitSummary([rows[0], { ...rows[1], time: '19:00' }], off), { kind: 'schedule', count: 2, at: null });
  assert.deepEqual(submitSummary(rows.map((r) => ({ ...r, mode: 'NOW' as const })), off), { kind: 'now', count: 2, at: null });
  assert.deepEqual(submitSummary(rows.map((r) => ({ ...r, mode: 'NONE' as const })), off), { kind: 'none', count: 0, at: null });
});

test('earliest publish time today, slots already passed, and the end-of-day edge', () => {
  assert.equal(addWallMinutes('2030-10-31T23:58', 5), '2030-11-01T00:03');
  assert.equal(earliestTimeOn('2030-10-02', '2030-10-02T18:31'), '18:36');
  assert.equal(earliestTimeOn('2030-10-03', '2030-10-02T18:31'), null);
  assert.equal(earliestTimeOn('2030-10-02', '2030-10-02T23:57'), 'OVER');
  assert.equal(isSlotPast('2030-10-02', '11:00', '2030-10-02T18:31'), true);
  assert.equal(isSlotPast('2030-10-02', '18:36', '2030-10-02T18:31'), false);
  assert.equal(isSlotPast('2030-10-03', '11:00', '2030-10-02T18:31'), false);
});

// ---- Bước 4 nâng cấp: lịch tháng inline, chế độ đăng, giờ chung, múi giờ riêng của planner ----

test('month calendar grid starts on Monday, spans 6 weeks and moves across month/year edges', () => {
  const grid = monthGrid('2026-09');
  assert.equal(grid.length, 42);
  assert.equal(grid[0], '2026-08-31'); // 01/09/2026 là Thứ Ba → ô đầu là Thứ Hai 31/08
  assert.equal(grid[41], '2026-10-11');
  assert.equal(weekdayIndex('2026-09-30'), 2); // Thứ Tư
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftDayByMonth('2026-01-31', 1), '2026-02-28');
});

test('calendar and date input share one state: input value drives the month, clicking a day fills the input', () => {
  const [row] = initialRows([version('v-fb', 'FACEBOOK')], accounts, newKey);
  const today = '2030-09-30';
  // Ô ngày đổi → lịch hiện đúng ngày + nhảy tới tháng của ngày đó.
  const typed = { ...row, date: '2030-11-03' };
  assert.deepEqual(calendarStateFor(typed, false, today), { mode: 'interactive', value: '2030-11-03' });
  assert.equal(monthOfDay(calendarStateFor(typed, false, today).value), '2030-11');
  // Bấm ngày trên lịch → patch row.date (= ô ngày); ngày đã qua không đổi gì.
  const clicked = { ...typed, ...pickCalendarDay('2030-10-05', today) };
  assert.equal(clicked.date, '2030-10-05');
  assert.equal(pickCalendarDay('2030-09-29', today), null);
  assert.equal(wallDateTime({ ...clicked, time: '20:00' }, off), '2030-10-05T20:00');
});

test('opening the planner from a calendar day preselects that day on eligible rows only', () => {
  const rows = initialRows([version('v-fb', 'FACEBOOK'), version('v-ig', 'INSTAGRAM')], accounts, newKey, '2030-10-12');
  assert.deepEqual(rows.map((r) => r.date), ['2030-10-12', '']);
  assert.deepEqual(calendarStateFor(rows[0], false, '2030-10-01'), { mode: 'interactive', value: '2030-10-12' });
  assert.deepEqual(calendarStateFor(rows[1], false, '2030-10-01'), { mode: 'hidden', value: '' });
});

test('switching publish mode updates calendar state, badge and validation together', () => {
  const [base] = initialRows([version('v-fb', 'FACEBOOK')], accounts, newKey);
  const today = '2030-09-30';
  const now = '2030-09-30T10:00';
  const row = { ...base, date: '2030-10-01', time: '20:00' };

  assert.deepEqual(calendarStateFor({ ...row, mode: 'NOW' }, false, today), { mode: 'readonly', value: today });
  assert.deepEqual(rowBadge({ ...row, mode: 'NOW' }, off, null), { kind: 'now' });
  assert.equal(validateRow({ ...row, mode: 'NOW' }, off, now), null);

  assert.deepEqual(calendarStateFor({ ...row, mode: 'NONE' }, false, today), { mode: 'disabled', value: '' });
  assert.deepEqual(rowBadge({ ...row, mode: 'NONE' }, off, null), { kind: 'none' });
  assert.deepEqual(toBatchRows([{ ...row, mode: 'NONE' }], off, newKey).payload, []);

  assert.deepEqual(calendarStateFor({ ...row, mode: 'SUGGEST' }, false, today), { mode: 'interactive', value: '2030-10-01' });
  assert.deepEqual(rowBadge({ ...row, mode: 'SUGGEST', date: '', time: '' }, off, 'MISSING_TIME'), { kind: 'unset' });

  assert.deepEqual(rowBadge(row, off, validateRow(row, off, now)), { kind: 'at', wall: '2030-10-01T20:00', error: false });
  const past = { ...row, date: today, time: '09:00' };
  assert.deepEqual(rowBadge(past, off, validateRow(past, off, now)), { kind: 'at', wall: '2030-09-30T09:00', error: true });
  assert.deepEqual(rowBadge({ ...row, block: 'NO_ACCOUNT' }, off, null), { kind: 'blocked' });
});

test('shared-time toggle: one calendar drives every Pick-a-time row, and toggling never loses picked times', () => {
  const rows = initialRows([version('v-fb', 'FACEBOOK'), version('v-th', 'THREADS')], accounts, newKey)
    .map((r, i) => (i === 0 ? { ...r, date: '2030-10-01', time: '20:00' } : { ...r, mode: 'NOW' as const }));

  // Bật khi giờ chung trống → lấy giờ của dòng Chọn giờ đầu tiên; card Chọn giờ ẩn lịch riêng, dùng giờ chung.
  const on = applySharedToggle(true, off, rows);
  assert.deepEqual(on.shared, { enabled: true, date: '2030-10-01', time: '20:00' });
  assert.deepEqual(calendarStateFor(on.rows[0], true, '2030-09-30'), { mode: 'hidden', value: '' });
  assert.deepEqual(calendarStateFor(on.rows[1], true, '2030-09-30'), { mode: 'readonly', value: '2030-09-30' }); // NOW giữ lịch riêng
  const moved = { ...on.shared, ...pickCalendarDay('2030-10-04', '2030-09-30') };
  assert.equal(wallDateTime(on.rows[0], moved), '2030-10-04T20:00');

  // Bật khi giờ chung đã có → giữ nguyên giờ chung.
  const keep = applySharedToggle(true, { enabled: false, date: '2030-10-09', time: '08:00' }, rows);
  assert.deepEqual(keep.shared, { enabled: true, date: '2030-10-09', time: '08:00' });

  // Tắt → dòng Chọn giờ chưa có giờ riêng nhận giờ chung; dòng đã có giờ riêng giữ nguyên.
  const blank = rows.map((r) => ({ ...r, mode: 'SCHEDULE' as const, date: r.versionId === 'v-th' ? '' : r.date, time: r.versionId === 'v-th' ? '' : r.time }));
  const offAgain = applySharedToggle(false, { enabled: true, date: '2030-10-04', time: '09:30' }, blank);
  assert.equal(offAgain.shared.enabled, false);
  assert.deepEqual(offAgain.rows.map((r) => `${r.date}T${r.time}`), ['2030-10-01T20:00', '2030-10-04T09:30']);
});

test('planner timezone: wall time converts to UTC before submit, including date shifts', () => {
  const rows = initialRows([version('v-fb', 'FACEBOOK')], accounts, newKey);
  // 05:00 sáng 01/10 ở Việt Nam = 22:00 ngày 30/09 UTC (lùi một ngày).
  const vn = toBatchRows(rows.map((r) => ({ ...r, date: '2030-10-01', time: '05:00' })), off, newKey, 'Asia/Ho_Chi_Minh');
  assert.equal(vn.payload[0].scheduledTime, '2030-09-30T22:00:00.000Z');
  // Cùng giờ tường 20:00 01/10 ở Los Angeles (PDT, UTC-7) = 03:00 ngày 02/10 UTC (tiến một ngày).
  const la = toBatchRows(vn.rows.map((r) => ({ ...r, time: '20:00' })), off, newKey, 'America/Los_Angeles');
  assert.equal(la.payload[0].scheduledTime, '2030-10-02T03:00:00.000Z');
  // Cùng giờ tường nhưng đổi múi giờ → instant khác → key idempotency mới (không dính lỗi 2139).
  const same = toBatchRows(la.rows, off, newKey, 'Asia/Ho_Chi_Minh');
  assert.notEqual(same.payload[0].idempotencyKey, la.payload[0].idempotencyKey);
  // Không truyền múi giờ → giữ hành vi cũ (giờ tường, tầng api quy theo múi giờ tài khoản).
  assert.equal(toBatchRows(rows.map((r) => ({ ...r, date: '2030-10-01', time: '05:00' })), off, newKey).payload[0].scheduledTime, '2030-10-01T05:00:00');
  // Giờ không tồn tại khi chuyển giờ mùa hè → RangeError (planner báo schTimeInvalid).
  assert.throws(() => toBatchRows(rows.map((r) => ({ ...r, date: '2030-03-10', time: '02:30' })), off, newKey, 'America/New_York'), RangeError);
});

test('planner timezone: past check, booked-day dots, golden hours and conflicts follow the selected zone', () => {
  const instant = new Date('2030-09-30T20:30:00Z');
  assert.equal(nowWallIn('Asia/Ho_Chi_Minh', instant), '2030-10-01T03:30');
  assert.equal(nowWallIn('America/Los_Angeles', instant), '2030-09-30T13:30');
  const [base] = initialRows([version('v-fb', 'FACEBOOK')], accounts, newKey);
  const row = { ...base, date: '2030-10-01', time: '02:00' };
  assert.equal(validateRow(row, off, nowWallIn('Asia/Ho_Chi_Minh', instant)), 'PAST');
  assert.equal(validateRow(row, off, nowWallIn('America/Los_Angeles', instant)), null);

  // Lịch 01:00 01/10 giờ VN = 19:00 30/09 ở London (BST) → chấm lịch nằm ở ngày 30/09.
  const existing = [{ id: 's1', platformAccountId: 'fb-page', platformName: 'FACEBOOK', status: 'SCHEDULED', scheduledTime: '2030-10-01T01:00:00+07:00' }] as PostSchedule[];
  const london = rezoneSchedules(existing, 'Europe/London');
  assert.equal(london[0].scheduledTime, '2030-09-30T19:00:00+01:00');
  assert.deepEqual([...bookedDays(london, new Set(['fb-page'])).keys()], ['2030-09-30']);
  assert.equal(bookedDays(london, new Set(['other'])).size, 0);
  assert.equal(bookedDays([{ ...london[0], status: 'CANCELLED' }], new Set(['fb-page'])).size, 0);

  // Khung giờ vàng 20:00-21:00 giờ VN = 14:00-15:00 ở London; cùng múi giờ thì giữ nguyên.
  assert.deepEqual(convertGoldenHours(['20:00-21:00'], '2030-10-01', 'Asia/Ho_Chi_Minh', 'Europe/London'), ['14:00-15:00']);
  assert.deepEqual(convertGoldenHours(['08:00-09:00'], '2030-10-01', 'Asia/Ho_Chi_Minh', 'Asia/Ho_Chi_Minh'), ['08:00-09:00']);

  // Trùng lịch so theo instant của giờ tường ở múi giờ đang chọn.
  const near = [{ ...existing[0], scheduledTime: '2030-10-01T13:30:00Z' }] as PostSchedule[];
  assert.equal(localConflicts('fb-page', '2030-10-01T14:00', near, 60, 'Europe/London').length, 1);
  assert.equal(localConflicts('fb-page', '2030-10-01T14:00', near, 60, 'Asia/Ho_Chi_Minh').length, 0);
});

test('suggested slots filter by the clicked day and fall back to the nearest ones', () => {
  const slots = ['2030-09-30T20:00', '2030-10-01T08:00', '2030-10-01T13:00', '2030-10-03T20:00'];
  assert.deepEqual(slotsOnDay(slots, '2030-10-01'), ['2030-10-01T08:00', '2030-10-01T13:00']);
  assert.deepEqual(slotsOnDay(slots, '2030-10-02'), []);
  assert.deepEqual(nearestSlotsFrom(slots, '2030-10-02'), ['2030-10-03T20:00']);
});
