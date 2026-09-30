import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBatchResult, blockOf, initialRows, localConflicts, toBatchRows, validateRow, wallDateTime,
  type PlannerAccount, type PlannerRow, type SharedTime,
} from '../src/components/schedule/plannerLogic.ts';
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
