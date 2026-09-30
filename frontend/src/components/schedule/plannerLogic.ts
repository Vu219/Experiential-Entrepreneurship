// Logic thuần của SchedulePlanner (không JSX) — test bằng node --test (tests/schedulePlanner.test.ts).
// Giờ trong planner là GIỜ TƯỜNG theo múi giờ đăng của user (yyyy-MM-dd + HH:mm); chuyển sang instant
// bằng publishingInstant (không dùng Date theo timezone máy).

import type { Platform } from '../../api/brandProfile';
import type { ContentVersionResponse } from '../../api/contentGeneration';
import type { PostSchedule, ScheduleBatchResult, ScheduleBatchRow } from '../../api/schedules';
import { publishingInstant } from '../../utils/publishingTime.ts'; // đuôi .ts: node --test chạy trực tiếp file này

/** NOW = đăng ngay; SCHEDULE = tự chọn giờ; SUGGEST = chọn một khung gợi ý; NONE = không lên lịch nền tảng này. */
export type RowMode = 'NOW' | 'SCHEDULE' | 'SUGGEST' | 'NONE';

/** Lý do dòng không lên lịch được (khóa, có giải thích) — null = đủ điều kiện. */
export type RowBlock = 'NOT_FORMATTED' | 'ALREADY_SCHEDULED' | 'UNSUPPORTED_MEDIA' | 'NO_ACCOUNT' | null;

/** Tài khoản đích tối thiểu planner cần (ACTIVE, Facebook chỉ Trang — lọc trước khi đưa vào). */
export interface PlannerAccount {
  id: string;
  platform: Platform;
  accountName: string;
}

export interface RowResult {
  ok: boolean;
  code: number;
  message: string;
  schedule: PostSchedule | null;
}

export interface PlannerRow {
  /** = clientRowId gửi lên batch (mỗi bản nền tảng một dòng). */
  versionId: string;
  platform: Platform;
  block: RowBlock;
  accountId: string;
  mode: RowMode;
  date: string;
  time: string;
  /** Key idempotency đang dùng + chữ ký payload lúc tạo key: payload đổi → key mới (tránh 2139). */
  key: string;
  keyPayload: string | null;
  result: RowResult | null;
}

export interface SharedTime {
  enabled: boolean;
  date: string;
  time: string;
}

export function blockOf(version: ContentVersionResponse, accounts: PlannerAccount[]): RowBlock {
  if (version.platformName === 'INSTAGRAM') return 'UNSUPPORTED_MEDIA';
  if (version.status !== 'FORMATTED') return 'NOT_FORMATTED';
  if (version.scheduleStatus) return 'ALREADY_SCHEDULED';
  if (!accounts.some((a) => a.platform === version.platformName)) return 'NO_ACCOUNT';
  return null;
}

/** Một dòng / bản nền tảng; dòng đủ điều kiện mặc định SCHEDULE trên tài khoản đầu tiên của nền tảng. */
export function initialRows(versions: ContentVersionResponse[], accounts: PlannerAccount[], newKey: () => string): PlannerRow[] {
  return versions.map((v) => {
    const block = blockOf(v, accounts);
    return {
      versionId: v.id,
      platform: v.platformName,
      block,
      accountId: accounts.find((a) => a.platform === v.platformName)?.id ?? '',
      mode: block ? 'NONE' : 'SCHEDULE',
      date: '',
      time: '',
      key: newKey(),
      keyPayload: null,
      result: null,
    };
  });
}

/** Giờ tường áp cho dòng (chung giờ bật → giờ chung, trừ dòng chọn khung gợi ý riêng); null khi không cần giờ. */
export function wallDateTime(row: PlannerRow, shared: SharedTime): string | null {
  if (row.mode === 'NOW' || row.mode === 'NONE') return null;
  const useShared = shared.enabled && row.mode === 'SCHEDULE';
  const date = useShared ? shared.date : row.date;
  const time = useShared ? shared.time : row.time;
  return date && time ? `${date}T${time}` : null;
}

export type RowError = 'MISSING_ACCOUNT' | 'MISSING_TIME' | 'PAST' | 'TOO_SOON' | null;

/** Giờ đăng phải cách hiện tại ít nhất ngần này phút (chỉ kiểm ở FE — server chỉ chặn giờ đã qua). */
export const MIN_LEAD_MINUTES = 5;

/** Số phút từ giờ tường {@code from} tới {@code to} (cùng múi giờ đăng, dạng yyyy-MM-ddTHH:mm). */
export function wallDiffMinutes(to: string, from: string): number {
  const ms = (w: string) => Date.UTC(+w.slice(0, 4), +w.slice(5, 7) - 1, +w.slice(8, 10), +w.slice(11, 13), +w.slice(14, 16));
  return Math.round((ms(to) - ms(from)) / 60_000);
}

/** Giờ tường {@code wall} cộng {@code minutes} phút (yyyy-MM-ddTHH:mm, qua ngày/tháng đúng). */
export function addWallMinutes(wall: string, minutes: number): string {
  const d = new Date(Date.UTC(+wall.slice(0, 4), +wall.slice(5, 7) - 1, +wall.slice(8, 10), +wall.slice(11, 13), +wall.slice(14, 16) + minutes));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/**
 * Giờ sớm nhất còn đăng được trong ngày {@code date} (HH:mm, đã tính MIN_LEAD_MINUTES): ngày tương lai → null
 * (cả ngày chọn được); hôm nay → giờ sớm nhất; hôm nay nhưng đã quá giờ cuối ngày → 'OVER'.
 */
export function earliestTimeOn(date: string, nowWall: string): string | 'OVER' | null {
  if (!date || date > nowWall.slice(0, 10)) return null;
  const earliest = addWallMinutes(nowWall, MIN_LEAD_MINUTES);
  return earliest.slice(0, 10) === date ? earliest.slice(11, 16) : 'OVER';
}

/** Khung giờ bắt đầu {@code time} của ngày {@code date} đã qua / quá sát hiện tại (không chọn được nữa). */
export const isSlotPast = (date: string, time: string, nowWall: string) =>
  !!date && !!time && wallDiffMinutes(`${date}T${time}`, nowWall) < MIN_LEAD_MINUTES;

/** Kiểm tra UX phía client (server vẫn kiểm lại mọi điều kiện). {@code nowWall} = giờ tường hiện tại yyyy-MM-ddTHH:mm. */
export function validateRow(row: PlannerRow, shared: SharedTime, nowWall: string): RowError {
  if (row.block || row.mode === 'NONE' || row.result?.ok) return null;
  if (!row.accountId) return 'MISSING_ACCOUNT';
  if (row.mode === 'NOW') return null;
  const dt = wallDateTime(row, shared);
  if (!dt) return 'MISSING_TIME';
  const diff = wallDiffMinutes(dt, nowWall);
  if (diff <= 0) return 'PAST';
  return diff < MIN_LEAD_MINUTES ? 'TOO_SOON' : null;
}

/**
 * Tóm tắt lượt gửi cho nút chính: 'retry' khi còn dòng lỗi, 'now' khi mọi dòng gửi là Đăng ngay, 'schedule' còn lại.
 * {@code at} = giờ tường chung nếu mọi dòng hẹn giờ cùng một thời điểm (để ghi lên nhãn), ngược lại null.
 */
export function submitSummary(rows: PlannerRow[], shared: SharedTime): { kind: 'none' | 'retry' | 'now' | 'schedule'; count: number; at: string | null } {
  const sendable = rows.filter(isSubmittable);
  if (sendable.length === 0) return { kind: 'none', count: 0, at: null };
  if (rows.some((r) => r.result && !r.result.ok)) return { kind: 'retry', count: sendable.length, at: null };
  if (sendable.every((r) => r.mode === 'NOW')) return { kind: 'now', count: sendable.length, at: null };
  const times = new Set(sendable.filter((r) => r.mode !== 'NOW').map((r) => wallDateTime(r, shared)));
  const only = times.size === 1 ? [...times][0] : null;
  return { kind: 'schedule', count: sendable.length, at: sendable.some((r) => r.mode === 'NOW') ? null : only };
}

/** Dòng sẽ được gửi: đủ điều kiện, có chọn chế độ, chưa thành công ở lần trước (thử lại chỉ gửi dòng lỗi). */
export const isSubmittable = (row: PlannerRow) => !row.block && row.mode !== 'NONE' && !row.result?.ok;

/**
 * Dựng payload batch + cập nhật key: cùng dòng thử lại với CÙNG payload giữ nguyên key (server trả lại kết quả
 * cũ, không tạo trùng); payload đổi (giờ/tài khoản/chế độ) → key mới.
 */
export function toBatchRows(rows: PlannerRow[], shared: SharedTime, newKey: () => string): { payload: ScheduleBatchRow[]; rows: PlannerRow[] } {
  const payload: ScheduleBatchRow[] = [];
  const next = rows.map((row) => {
    if (!isSubmittable(row)) return row;
    const dt = wallDateTime(row, shared);
    const mode = row.mode === 'NOW' ? 'NOW' : 'SCHEDULE';
    const signature = `${row.versionId}|${row.accountId}|${mode}|${dt ?? ''}`;
    const key = row.keyPayload === null || row.keyPayload === signature ? row.key : newKey();
    payload.push({
      clientRowId: row.versionId,
      idempotencyKey: key,
      contentVersionId: row.versionId,
      platformAccountId: row.accountId,
      mode,
      scheduledTime: dt ? `${dt}:00` : undefined,
    });
    return { ...row, key, keyPayload: signature };
  });
  return { payload, rows: next };
}

/** Gắn kết quả theo clientRowId; dòng không có trong kết quả giữ nguyên. */
export function applyBatchResult(rows: PlannerRow[], result: ScheduleBatchResult): PlannerRow[] {
  const byId = new Map(result.rows.map((r) => [r.clientRowId, r]));
  return rows.map((row) => {
    const r = byId.get(row.versionId);
    if (!r) return row;
    return { ...row, result: { ok: r.code === 200, code: r.code, message: r.message, schedule: r.schedule } };
  });
}

/**
 * Cảnh báo trùng lịch phía client (trước khi gửi): lịch chiếm chỗ cùng tài khoản gần hơn cửa sổ của user.
 * Chỉ để nhắc — server tính lại khi tạo lịch.
 */
export function localConflicts(accountId: string, wall: string | null, schedules: PostSchedule[], windowMinutes: number): PostSchedule[] {
  if (!wall || windowMinutes <= 0 || !accountId) return [];
  let at: number;
  try {
    at = Date.parse(publishingInstant(wall.length === 16 ? `${wall}:00` : wall));
  } catch {
    return [];
  }
  const windowMs = windowMinutes * 60_000;
  return schedules.filter((s) => s.platformAccountId === accountId
    && (s.status === 'SCHEDULED' || s.status === 'ON_HOLD' || s.status === 'POSTING')
    && Math.abs(Date.parse(s.scheduledTime) - at) < windowMs);
}
