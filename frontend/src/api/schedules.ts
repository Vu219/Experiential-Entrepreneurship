import client, { type ApiResponse } from "./apiClient";
import type { Platform } from "./brandProfile";
import type { ContentVersionResponse } from "./contentGeneration";
import { publishingInstant, setPublishingTimezone, zonedTimestamp } from '../utils/publishingTime';

/** Cài đặt đăng bài của user (GET/PUT /users/me/publishing-settings). */
export interface PublishingSettings {
  timezone: string;
  /** Bài phải được duyệt mới đăng; lịch của bài chưa duyệt bị tạm giữ (PENDING_REVIEW). */
  requireApproval: boolean;
  /** Cảnh báo khi hai lịch cùng tài khoản gần nhau hơn số phút này. */
  conflictWindowMinutes: number;
  brandVoiceBlockingEnabled: boolean;
  /** 0–100, bắt buộc khi bật chặn brand voice. */
  brandVoiceThreshold: number | null;
}

export async function getPublishingSettings(): Promise<PublishingSettings> {
  const { data } = await client.get<ApiResponse<PublishingSettings>>('/users/me/publishing-settings');
  return data.result;
}

export async function updatePublishingSettings(input: PublishingSettings): Promise<PublishingSettings> {
  const { data } = await client.put<ApiResponse<PublishingSettings>>('/users/me/publishing-settings', input);
  setPublishingTimezone(data.result.timezone);
  return data.result;
}

export async function loadPublishingTimezone() {
  setPublishingTimezone((await getPublishingSettings()).timezone);
}
const inPublishingTimezone = (schedule: PostSchedule): PostSchedule => ({
  ...schedule, scheduledTime: zonedTimestamp(schedule.scheduledTime),
});

// Lịch đăng bài (FR-47..FR-51) — backend PostScheduleController (/schedules).
// POSTING/POSTED/FAILED do auto-posting (FR-52+) cập nhật; FE chỉ tạo/dời/hủy.

export type ScheduleStatus = "SCHEDULED" | "ON_HOLD" | "POSTING" | "POSTED" | "FAILED" | "CANCELLED";

/** Lý do tạm giữ — một lịch có thể có nhiều lý do cùng lúc (mirror HoldReason backend). */
export type HoldReason = "ACCOUNT_ISSUE" | "PENDING_REVIEW" | "ACCOUNT_REMOVED" | "USER_PENDING_DELETE" | "UNSUPPORTED_MEDIA";

export interface PostSchedule {
  id: string;
  status: ScheduleStatus;
  /** Lý do đang tạm giữ (rỗng khi không ON_HOLD). */
  holdReasons: HoldReason[];
  /** ON_HOLD và đã qua giờ đăng — không tự đăng, cần chọn giờ mới. */
  overdue: boolean;
  /** Job đăng bài do chính lời gọi này tạo (đăng ngay / mode NOW). */
  jobId?: string | null;
  /** Cảnh báo không chặn: lịch khác cùng tài khoản nằm trong cửa sổ trùng lịch. */
  warnings?: ScheduleWarning[] | null;
  /** ISO-8601 with workspace offset; API transports UTC instants. */
  scheduledTime: string;
  platformName: Platform;
  platformAccountId: string;
  platformAccountName: string;
  platformAccountAvatarUrl: string | null;
  contentItemId: string;
  contentVersion: ContentVersionResponse;
}

export interface ScheduleWarning {
  type: "CONFLICT";
  scheduleId: string;
  scheduledTime: string;
}

/** SCHEDULE = đặt giờ; NOW = server gán giờ hiện tại và tạo job ngay. */
export type ScheduleMode = "SCHEDULE" | "NOW";

export interface ScheduleBatchRow {
  /** Id dòng phía client — trả lại nguyên trong kết quả. */
  clientRowId: string;
  /** Giữ nguyên khi thử lại cùng dòng: cùng key + cùng dữ liệu → trả lại kết quả cũ, không tạo trùng. */
  idempotencyKey: string;
  contentVersionId: string;
  platformAccountId: string;
  mode: ScheduleMode;
  /** Giờ tường theo múi giờ đăng hoặc ISO có offset; bắt buộc với SCHEDULE. */
  scheduledTime?: string;
}

export interface ScheduleRowResult {
  clientRowId: string;
  /** 200 = thành công; khác = mã ErrorCode backend của dòng đó. */
  code: number;
  message: string;
  schedule: PostSchedule | null;
}

export interface ScheduleBatchResult {
  rows: ScheduleRowResult[];
  succeeded: number;
  failed: number;
}

export interface SuggestedSlot {
  /** ISO có offset theo múi giờ đăng. */
  time: string;
  window: string;
}

export interface GoldenHours {
  platform: Platform;
  /** false = khung giờ mặc định nền tảng; true = rút từ ≥10 bài đã phân tích (FR-48). */
  dataDriven: boolean;
  /** Vd "20:00-21:00". */
  suggestedHours: string[];
  rationale: string | null;
}

// Mã lỗi backend (ErrorCode.java) cần bắt riêng.
export const ERR_SCHEDULE_TIME_IN_PAST = 1933;
export const ERR_SCHEDULE_ALREADY_EXISTS = 1938;
export const ERR_CONNECTION_NOT_ACTIVE = 1936;
export const ERR_SCHEDULE_PLATFORM_UNSUPPORTED = 2130; // Instagram cần ảnh/video — chưa tự đăng
export const ERR_BRAND_VOICE_BELOW_THRESHOLD = 2132;
export const ERR_REVIEW_REQUIRED_BEFORE_PUBLISH = 2138;
export const ERR_IDEMPOTENCY_KEY_REUSED = 2139;
export const ERR_SCHEDULE_HELD_CANNOT_PUBLISH = 2140;

// GET /schedules — sắp theo scheduledTime tăng dần; filter optional.
export async function listSchedules(params: { status?: ScheduleStatus; platform?: Platform } = {}): Promise<PostSchedule[]> {
  await loadPublishingTimezone();
  const { data } = await client.get<ApiResponse<PostSchedule[]>>("/schedules", { params });
  return data.result.map(inPublishingTimezone);
}

export interface CreateScheduleInput {
  contentVersionId: string;
  platformAccountId: string;
  /** Workspace wall time or offset-bearing ISO-8601; converted to UTC before sending. */
  scheduledTime: string;
}

// POST /schedules — version phải FORMATTED, account ACTIVE cùng nền tảng (BR-05).
export async function createSchedule(input: CreateScheduleInput): Promise<PostSchedule> {
  await loadPublishingTimezone();
  const { data } = await client.post<ApiResponse<PostSchedule>>("/schedules", { ...input, scheduledTime: publishingInstant(input.scheduledTime) });
  return inPublishingTimezone(data.result);
}

// PUT /schedules/{id} — dời giờ (SCHEDULED/ON_HOLD), tuỳ chọn chuyển sang tài khoản khác cùng nền tảng;
// lịch ON_HOLD hết lý do tạm giữ → về SCHEDULED, còn lý do thì vẫn giữ.
export async function updateSchedule(id: string, scheduledTime: string, platformAccountId?: string): Promise<PostSchedule> {
  await loadPublishingTimezone();
  const { data } = await client.put<ApiResponse<PostSchedule>>(`/schedules/${id}`, {
    scheduledTime: publishingInstant(scheduledTime), platformAccountId,
  });
  return inPublishingTimezone(data.result);
}

// POST /schedules/batch — mỗi dòng một transaction + key idempotency riêng; kết quả theo dòng.
export async function createScheduleBatch(rows: ScheduleBatchRow[]): Promise<ScheduleBatchResult> {
  await loadPublishingTimezone();
  const { data } = await client.post<ApiResponse<ScheduleBatchResult>>("/schedules/batch", {
    rows: rows.map((r) => ({ ...r, scheduledTime: r.mode === "SCHEDULE" && r.scheduledTime ? publishingInstant(r.scheduledTime) : undefined })),
  });
  return {
    ...data.result,
    rows: data.result.rows.map((r) => ({ ...r, schedule: r.schedule ? inPublishingTimezone(r.schedule) : null })),
  };
}

// POST /schedules/{id}/publish-now — dùng chung claim với bộ lập lịch; trả job ngay, đăng chạy nền.
export async function publishScheduleNow(id: string, idempotencyKey: string): Promise<PostSchedule> {
  await loadPublishingTimezone();
  const { data } = await client.post<ApiResponse<PostSchedule>>(`/schedules/${id}/publish-now`, null, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return inPublishingTimezone(data.result);
}

// GET /schedules/suggested-slots — khung giờ vàng còn trống của tài khoản (không giữ chỗ).
export async function getSuggestedSlots(accountId: string, count = 5, from?: string): Promise<SuggestedSlot[]> {
  await loadPublishingTimezone();
  const { data } = await client.get<ApiResponse<{ time: string; window: string }[]>>("/schedules/suggested-slots", {
    params: { accountId, count, from: from ? publishingInstant(from) : undefined },
  });
  return data.result.map((s) => ({ ...s, time: zonedTimestamp(s.time) }));
}

// DELETE /schedules/{id} — hủy (SCHEDULED/ON_HOLD/FAILED) → CANCELLED, version về FORMATTED (FR-39/FR-58).
export async function cancelSchedule(id: string): Promise<PostSchedule> {
  const { data } = await client.delete<ApiResponse<PostSchedule>>(`/schedules/${id}`);
  return inPublishingTimezone(data.result);
}

// GET /schedules/golden-hours?platform= — gợi ý khung giờ vàng (FR-48).
export async function getGoldenHours(platform: Platform): Promise<GoldenHours> {
  const { data } = await client.get<ApiResponse<GoldenHours>>("/schedules/golden-hours", { params: { platform } });
  return data.result;
}
