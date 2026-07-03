import client, { type ApiResponse, type PageResponse } from "./apiClient";
import type { Platform } from "./brandProfile";
export type { Platform } from "./brandProfile";

// Content Strategy gọi backend thật qua api/apiClient.ts (envelope { code, message, result }).
// Endpoint: /content-strategies (controller backend, context-path đã ở baseURL).
//
// Trạng thái: DRAFT (nháp) | ACTIVE (đang hoạt động) | PAUSED (tạm dừng).
// Quy tắc Agent AI: CHỈ `ACTIVE` mới được tạo nội dung / tự lên lịch.
// Cả DRAFT và PAUSED đều KHÔNG cho Agent AI tạo nội dung mới (FR-13).
//
// goals/contentTypes/styles/ctas là FREE-TEXT (vừa chọn gợi ý vừa tự nhập) — DB lưu nguyên văn,
// không ràng buộc enum; phần dịch Anh/Việt chỉ ở danh sách gợi ý (src/data.ts), state luôn là chuỗi đã chọn.

export type StrategyStatus = "DRAFT" | "ACTIVE" | "PAUSED";
export type FrequencyUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export interface ContentStrategy {
  id: string;
  brandId: string; // mỗi chiến lược gắn 1 hồ sơ thương hiệu
  name: string;
  status: StrategyStatus;
  goals: string[]; // 01 — mục tiêu content
  contentTypes: string[]; // 02 — loại nội dung ưu tiên
  frequencyCount: number; // 03 — số bài đăng (vd: 3)
  frequencyUnit: FrequencyUnit; // 03 — đơn vị (DAY, WEEK, MONTH, YEAR)
  platforms: Platform[]; // 04 — nền tảng đăng
  timeSlots: string[]; // 05 — khung giờ ưu tiên
  audiences: string[]; // 06 — đối tượng mục tiêu
  styles: string[]; // 07 — phong cách nội dung
  ctas: string[]; // 08 — CTA mong muốn
  createdAt: string;
  updatedAt: string;
}

export type ContentStrategyInput = Omit<ContentStrategy, "id" | "createdAt" | "updatedAt">;

/** Agent AI chỉ tạo nội dung cho chiến lược ACTIVE (DRAFT/PAUSED bị chặn). */
export const isStrategyRunnable = (s: ContentStrategy): boolean => s.status === "ACTIVE";

// Tham số phân trang + lọc server-side (PageResponse của backend; page đánh số từ 0).
export interface ContentStrategyListParams {
  brandId?: string;
  status?: StrategyStatus;
  q?: string;
  page?: number;
  size?: number;
}

// GET /content-strategies — phân trang server-side (mặc định backend: 4/trang, cập nhật mới nhất trước).
export async function listContentStrategies(params: ContentStrategyListParams = {}): Promise<PageResponse<ContentStrategy>> {
  const { data } = await client.get<ApiResponse<PageResponse<ContentStrategy>>>("/content-strategies", { params });
  return data.result;
}

// Lấy TOÀN BỘ chiến lược (của 1 brand hoặc của user) — cho các màn không phân trang UI
// (Create chọn chiến lược, Trend Research kiểm tra chiến lược ACTIVE).
export async function listAllContentStrategies(brandId?: string): Promise<ContentStrategy[]> {
  const { data } = await client.get<ApiResponse<PageResponse<ContentStrategy>>>("/content-strategies", {
    params: { brandId, size: 1000 },
  });
  return data.result.content;
}

// POST /content-strategies
export async function createContentStrategy(input: ContentStrategyInput): Promise<ContentStrategy> {
  const { data } = await client.post<ApiResponse<ContentStrategy>>("/content-strategies", input);
  return data.result;
}

// PUT /content-strategies/{id}
export async function updateContentStrategy(id: string, input: ContentStrategyInput): Promise<ContentStrategy> {
  const { data } = await client.put<ApiResponse<ContentStrategy>>(`/content-strategies/${id}`, input);
  return data.result;
}

// PATCH /content-strategies/{id}/status (FR-13: kích hoạt / tạm dừng)
export async function setStrategyStatus(id: string, status: StrategyStatus): Promise<ContentStrategy> {
  const { data } = await client.patch<ApiResponse<ContentStrategy>>(`/content-strategies/${id}/status`, { status });
  return data.result;
}

// DELETE /content-strategies/{id}
export async function deleteContentStrategy(id: string): Promise<void> {
  await client.delete(`/content-strategies/${id}`);
}
