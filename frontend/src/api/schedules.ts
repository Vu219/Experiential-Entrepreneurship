import client, { type ApiResponse } from "./apiClient";
import type { Platform } from "./brandProfile";
import type { ContentVersionResponse } from "./contentGeneration";

// Lịch đăng bài (FR-47..FR-51) — backend PostScheduleController (/schedules).
// POSTING/POSTED/FAILED do auto-posting (FR-52+) cập nhật; FE chỉ tạo/dời/hủy.

export type ScheduleStatus = "SCHEDULED" | "ON_HOLD" | "POSTING" | "POSTED" | "FAILED" | "CANCELLED";

export interface PostSchedule {
  id: string;
  status: ScheduleStatus;
  /** LocalDateTime của server, vd "2026-07-12T20:00:00". */
  scheduledTime: string;
  platformName: Platform;
  platformAccountId: string;
  platformAccountName: string;
  platformAccountAvatarUrl: string | null;
  contentItemId: string;
  contentVersion: ContentVersionResponse;
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

// GET /schedules — sắp theo scheduledTime tăng dần; filter optional.
export async function listSchedules(params: { status?: ScheduleStatus; platform?: Platform } = {}): Promise<PostSchedule[]> {
  const { data } = await client.get<ApiResponse<PostSchedule[]>>("/schedules", { params });
  return data.result;
}

export interface CreateScheduleInput {
  contentVersionId: string;
  platformAccountId: string;
  /** "YYYY-MM-DDTHH:mm:ss" — phải ở tương lai. */
  scheduledTime: string;
}

// POST /schedules — version phải FORMATTED, account ACTIVE cùng nền tảng (BR-05).
export async function createSchedule(input: CreateScheduleInput): Promise<PostSchedule> {
  const { data } = await client.post<ApiResponse<PostSchedule>>("/schedules", input);
  return data.result;
}

// PUT /schedules/{id} — dời giờ (SCHEDULED/ON_HOLD); lịch ON_HOLD với account đã ACTIVE lại → tự về SCHEDULED.
export async function updateSchedule(id: string, scheduledTime: string): Promise<PostSchedule> {
  const { data } = await client.put<ApiResponse<PostSchedule>>(`/schedules/${id}`, { scheduledTime });
  return data.result;
}

// DELETE /schedules/{id} — hủy (SCHEDULED/ON_HOLD/FAILED) → CANCELLED, version về FORMATTED (FR-39/FR-58).
export async function cancelSchedule(id: string): Promise<PostSchedule> {
  const { data } = await client.delete<ApiResponse<PostSchedule>>(`/schedules/${id}`);
  return data.result;
}

// GET /schedules/golden-hours?platform= — gợi ý khung giờ vàng (FR-48).
export async function getGoldenHours(platform: Platform): Promise<GoldenHours> {
  const { data } = await client.get<ApiResponse<GoldenHours>>("/schedules/golden-hours", { params: { platform } });
  return data.result;
}
