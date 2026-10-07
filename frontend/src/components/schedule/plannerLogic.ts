// Logic thuần của SchedulePlanner (không JSX) — test bằng node --test (tests/schedulePlanner.test.ts).
// Giờ trong planner là GIỜ TƯỜNG theo múi giờ đăng của user (yyyy-MM-dd + HH:mm); chuyển sang instant
// bằng publishingInstant (không dùng Date theo timezone máy).

import type { Platform } from '../../api/brandProfile';
import type { ContentVersionResponse } from '../../api/contentGeneration';
import type { PostSchedule, ScheduleBatchResult, ScheduleBatchRow } from '../../api/schedules';
import { publishingInstant, wallTime, zonedTimestamp } from '../../utils/publishingTime.ts'; // đuôi .ts: node --test chạy trực tiếp file này

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

/**
 * Một dòng / bản nền tảng; dòng đủ điều kiện mặc định SCHEDULE trên tài khoản đầu tiên của nền tảng.
 * {@code initialDate} (yyyy-MM-dd, đã kiểm không ở quá khứ) — mở từ một ngày trên Lịch đăng → chọn sẵn ngày đó.
 */
export function initialRows(versions: ContentVersionResponse[], accounts: PlannerAccount[], newKey: () => string, initialDate = ''): PlannerRow[] {
  return versions.map((v) => {
    const block = blockOf(v, accounts);
    return {
      versionId: v.id,
      platform: v.platformName,
      block,
      accountId: accounts.find((a) => a.platform === v.platformName)?.id ?? '',
      mode: block ? 'NONE' : 'SCHEDULE',
      date: block ? '' : initialDate,
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
 * cũ, không tạo trùng); payload đổi (giờ/tài khoản/chế độ/múi giờ) → key mới.
 * {@code zone} = múi giờ đang chọn trong planner: có → giờ tường quy ra instant UTC ngay tại đây (tầng api để
 * nguyên chuỗi có 'Z'); bỏ trống → gửi giờ tường, tầng api quy theo múi giờ tài khoản. Ném RangeError khi giờ
 * không tồn tại / mơ hồ do đổi giờ mùa hè.
 */
export function toBatchRows(rows: PlannerRow[], shared: SharedTime, newKey: () => string, zone?: string): { payload: ScheduleBatchRow[]; rows: PlannerRow[] } {
  const payload: ScheduleBatchRow[] = [];
  const next = rows.map((row) => {
    if (!isSubmittable(row)) return row;
    const dt = wallDateTime(row, shared);
    const mode = row.mode === 'NOW' ? 'NOW' : 'SCHEDULE';
    const scheduledTime = dt ? (zone ? publishingInstant(dt, zone) : `${dt}:00`) : undefined;
    const signature = `${row.versionId}|${row.accountId}|${mode}|${scheduledTime ?? ''}`;
    const key = row.keyPayload === null || row.keyPayload === signature ? row.key : newKey();
    payload.push({
      clientRowId: row.versionId,
      idempotencyKey: key,
      contentVersionId: row.versionId,
      platformAccountId: row.accountId,
      mode,
      scheduledTime,
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
export function localConflicts(accountId: string, wall: string | null, schedules: PostSchedule[], windowMinutes: number, zone?: string): PostSchedule[] {
  if (!wall || windowMinutes <= 0 || !accountId) return [];
  let at: number;
  try {
    at = Date.parse(publishingInstant(wall.length === 16 ? `${wall}:00` : wall, zone));
  } catch {
    return [];
  }
  const windowMs = windowMinutes * 60_000;
  return schedules.filter((s) => s.platformAccountId === accountId
    && (s.status === 'SCHEDULED' || s.status === 'ON_HOLD' || s.status === 'POSTING')
    && Math.abs(Date.parse(s.scheduledTime) - at) < windowMs);
}

// ---- Lịch tháng inline + múi giờ riêng của planner ----

/** Cách hiện lịch tháng của một dòng: hidden = không có lịch (dòng khóa / đã xong / đang dùng giờ chung). */
export type CalendarMode = 'interactive' | 'readonly' | 'disabled' | 'hidden';

/**
 * Lịch tháng và ô nhập dùng CHUNG state của dòng (row.date): lịch hiện ngày đang chọn, ô ngày đổi → lịch nhảy
 * tháng. Đăng ngay → chỉ đọc, sáng ngày hôm nay; Không đăng → khóa; Chọn giờ khi bật giờ chung → lịch chung.
 */
export function calendarStateFor(row: PlannerRow, sharedEnabled: boolean, todayISO: string): { mode: CalendarMode; value: string } {
  if (row.block || row.result?.ok) return { mode: 'hidden', value: '' };
  if (row.mode === 'NONE') return { mode: 'disabled', value: '' };
  if (row.mode === 'NOW') return { mode: 'readonly', value: todayISO };
  if (row.mode === 'SCHEDULE' && sharedEnabled) return { mode: 'hidden', value: '' };
  return { mode: 'interactive', value: row.date };
}

/** Bấm một ngày trên lịch (Chọn giờ / giờ chung): điền vào ô ngày; ngày đã qua → null (không đổi gì). */
export function pickCalendarDay(day: string, todayISO: string): { date: string } | null {
  return day && day >= todayISO ? { date: day } : null;
}

/** Badge trạng thái của dòng: chưa đủ thông tin → 'unset' (cam); đủ → 'at' + giờ tường (error khi giờ đã qua / quá sát). */
export type RowBadge =
  | { kind: 'blocked' | 'none' | 'now' | 'unset' }
  | { kind: 'at'; wall: string; error: boolean };

export function rowBadge(row: PlannerRow, shared: SharedTime, error: RowError): RowBadge | null {
  if (row.block) return { kind: 'blocked' };
  if (row.result?.ok) return null;
  if (row.mode === 'NONE') return { kind: 'none' };
  if (row.mode === 'NOW') return { kind: 'now' };
  const wall = wallDateTime(row, shared);
  return wall ? { kind: 'at', wall, error: error === 'PAST' || error === 'TOO_SOON' } : { kind: 'unset' };
}

/**
 * Bật/tắt "Dùng chung giờ" không làm mất giờ đã chọn: bật khi giờ chung còn trống → lấy giờ của dòng Chọn giờ
 * đầu tiên đã có ngày; tắt → dòng Chọn giờ chưa có ngày/giờ riêng nhận lại giờ chung đang dùng.
 */
export function applySharedToggle(enabled: boolean, shared: SharedTime, rows: PlannerRow[]): { shared: SharedTime; rows: PlannerRow[] } {
  const editable = (r: PlannerRow) => !r.block && !r.result?.ok && r.mode === 'SCHEDULE';
  if (enabled) {
    const source = shared.date || shared.time ? null : rows.find((r) => editable(r) && r.date);
    return { shared: source ? { enabled, date: source.date, time: source.time } : { ...shared, enabled }, rows };
  }
  return {
    shared: { ...shared, enabled },
    rows: rows.map((r) => (editable(r) && !r.date && !r.time ? { ...r, date: shared.date, time: shared.time } : r)),
  };
}

/** Giờ tường hiện tại (yyyy-MM-ddTHH:mm) theo {@code zone}. */
export const nowWallIn = (zone: string, now: Date = new Date()) => wallTime(now, zone).slice(0, 16);

/** Chuỗi giờ có offset của API (theo múi giờ tài khoản) → offset của {@code zone}, cùng instant. */
export const rezone = (iso: string, zone: string) => zonedTimestamp(iso, zone);

/** Lịch hiện có hiển thị theo {@code zone}: slice(0, 10) / slice(11, 16) ra đúng ngày & giờ của múi giờ đó. */
export const rezoneSchedules = (schedules: PostSchedule[], zone: string): PostSchedule[] =>
  schedules.map((s) => ({ ...s, scheduledTime: rezone(s.scheduledTime, zone) }));

/** Ngày đã có lịch (chưa hủy) của các tài khoản {@code accountIds} → nền tảng của từng lịch (chấm màu). */
export function bookedDays(schedules: PostSchedule[], accountIds: ReadonlySet<string>): Map<string, Platform[]> {
  const map = new Map<string, Platform[]>();
  for (const s of schedules) {
    if (s.status === 'CANCELLED' || !accountIds.has(s.platformAccountId)) continue;
    const key = s.scheduledTime.slice(0, 10);
    map.set(key, [...(map.get(key) ?? []), s.platformName]);
  }
  return map;
}

/**
 * Giờ HH:mm của ngày {@code date} theo {@code fromZone} → giờ HH:mm theo {@code toZone} (khung giờ vàng tính theo
 * múi giờ tài khoản, hiện theo múi giờ đang chọn). Giờ không tồn tại do đổi giờ mùa hè → giữ nguyên.
 */
export function convertHour(date: string, hhmm: string, fromZone: string, toZone: string): string {
  if (fromZone === toZone || !date || !hhmm) return hhmm;
  try {
    return wallTime(publishingInstant(`${date}T${hhmm}`, fromZone), toZone).slice(11, 16);
  } catch {
    return hhmm;
  }
}

/** Khung giờ vàng "08:00-09:00" đổi sang múi giờ đang chọn (cả hai đầu). */
export const convertGoldenHours = (hours: string[], date: string, fromZone: string, toZone: string): string[] =>
  fromZone === toZone ? hours : hours.map((h) => h.split('-').map((part) => convertHour(date, part.trim(), fromZone, toZone)).join('-'));

/** Gợi ý (giờ tường yyyy-MM-ddTHH:mm) của đúng ngày {@code day}. */
export const slotsOnDay = (slots: string[], day: string) => slots.filter((s) => s.slice(0, 10) === day);

/** {@code n} gợi ý gần nhất từ ngày {@code day} trở đi (khi ngày đó không còn khung trống). */
export const nearestSlotsFrom = (slots: string[], day: string, n = 3) => slots.filter((s) => s.slice(0, 10) >= day).slice(0, n);
