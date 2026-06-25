import type { Platform } from "./brandProfile";
import { STRATEGY_STORE_KEY, seedStrategiesIfEmpty } from "./mockSeed";
export type { Platform } from "./brandProfile";

// ⚠️ TODO(backend): Content Strategy CHƯA có ở backend (xem root CLAUDE.md scope).
// File này hiện trả MOCK lưu trong localStorage để dựng UI list-first + detail.
// Khi BE sẵn sàng: thay phần thân mỗi hàm bằng lời gọi `client.<verb>(...)` qua
// api/apiClient.ts (envelope { code, message, result }) — GIỮ NGUYÊN chữ ký hàm &
// kiểu dữ liệu để FE không phải đổi. Endpoint dự kiến ghi chú ở từng hàm.
//
// Trạng thái: DRAFT (nháp) | ACTIVE (đang hoạt động) | PAUSED (tạm dừng).
// Quy tắc Agent AI: CHỈ `ACTIVE` mới được tạo nội dung / tự lên lịch.
// Cả DRAFT và PAUSED đều KHÔNG cho Agent AI tạo nội dung mới (FR-13).

export type StrategyStatus = "DRAFT" | "ACTIVE" | "PAUSED";

export interface ContentStrategy {
  id: string;
  brandId: string; // mỗi chiến lược gắn 1 hồ sơ thương hiệu
  name: string;
  status: StrategyStatus;
  goals: string[]; // 01 — mục tiêu content
  contentTypes: string[]; // 02 — loại nội dung ưu tiên (tối đa 5)
  postsPerWeek: number; // 03 — tần suất đăng (số bài/tuần, 2..5)
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

// ===== MOCK store (localStorage) — bỏ khi nối BE. Dữ liệu mẫu ở api/mockSeed.ts =====
const delay = <T>(value: T, ms = 300): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));
const nowIso = () => new Date().toISOString();
const uid = () => "cs_" + Math.random().toString(36).slice(2, 10);

function readAll(): ContentStrategy[] {
  seedStrategiesIfEmpty();
  try {
    return JSON.parse(localStorage.getItem(STRATEGY_STORE_KEY) ?? "[]") as ContentStrategy[];
  } catch {
    return [];
  }
}

function writeAll(rows: ContentStrategy[]): void {
  localStorage.setItem(STRATEGY_STORE_KEY, JSON.stringify(rows));
}

// GET /content-strategies?brandId= — chiến lược của một thương hiệu.
export async function listContentStrategies(brandId: string): Promise<ContentStrategy[]> {
  return delay(readAll().filter((s) => s.brandId === brandId));
}

// GET /content-strategies — toàn bộ (dùng đếm "số chiến lược liên kết" trên card hồ sơ).
export async function listAllContentStrategies(): Promise<ContentStrategy[]> {
  return delay(readAll());
}

// POST /content-strategies
export async function createContentStrategy(input: ContentStrategyInput): Promise<ContentStrategy> {
  const row: ContentStrategy = { ...input, id: uid(), createdAt: nowIso(), updatedAt: nowIso() };
  writeAll([row, ...readAll()]);
  return delay(row);
}

// PUT /content-strategies/{id}
export async function updateContentStrategy(id: string, input: ContentStrategyInput): Promise<ContentStrategy> {
  const rows = readAll();
  const idx = rows.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Strategy not found");
  const updated: ContentStrategy = { ...rows[idx], ...input, updatedAt: nowIso() };
  rows[idx] = updated;
  writeAll(rows);
  return delay(updated);
}

// PATCH /content-strategies/{id}/status (FR-13: kích hoạt / tạm dừng)
export async function setStrategyStatus(id: string, status: StrategyStatus): Promise<ContentStrategy> {
  const rows = readAll();
  const idx = rows.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Strategy not found");
  rows[idx] = { ...rows[idx], status, updatedAt: nowIso() };
  writeAll(rows);
  return delay(rows[idx]);
}

// DELETE /content-strategies/{id}
export async function deleteContentStrategy(id: string): Promise<void> {
  writeAll(readAll().filter((s) => s.id !== id));
  return delay(undefined);
}
