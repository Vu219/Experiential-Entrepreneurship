import { BRAND_STORE_KEY, seedBrandsIfEmpty } from "./mockSeed";

export type Platform = "FACEBOOK" | "INSTAGRAM" | "THREADS";
export type PostingFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface BrandProfile {
  id: string;
  brandName: string;
  industry: string;
  description: string | null;
  brandVoice: string | null;
  targetAudience: string;
  contentGoal: string | null;
  platforms: Platform[];
  postingFrequency: PostingFrequency;
  preferredTimes: string[];
  // FE-only (chưa có ở BE). TODO(backend): bổ sung cột logo_url + brand_keywords/dos/donts,
  // và upload logo lên storage thật (hiện lưu base64/data URL ngay trong field này).
  logoUrl: string | null;
  brandKeywords: string[];
  brandDos: string[];
  brandDonts: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfileInput {
  brandName: string;
  industry: string;
  description?: string;
  brandVoice?: string;
  targetAudience: string;
  contentGoal?: string;
  platforms: Platform[];
  postingFrequency: PostingFrequency;
  preferredTimes: string[];
  logoUrl?: string | null;
  brandKeywords?: string[];
  brandDos?: string[];
  brandDonts?: string[];
}

// ⚠️ TODO(backend): hiện dùng MOCK localStorage để xem giao diện offline (xem api/mockSeed.ts).
// Khi nối BE thật, thay 4 hàm dưới bằng lời gọi qua api/apiClient.ts (đã viết sẵn bên dưới
// dạng comment) — GIỮ NGUYÊN chữ ký & kiểu để FE không phải đổi:
//   import client, { ApiResponse } from "./apiClient";
//   list   → client.get<ApiResponse<BrandProfile[]>>("/brand-profiles")            → data.result
//   create → client.post<ApiResponse<BrandProfile>>("/brand-profiles", input)      → data.result
//   update → client.put<ApiResponse<BrandProfile>>(`/brand-profiles/${id}`, input) → data.result
//   delete → client.delete(`/brand-profiles/${id}`)

const delay = <T>(value: T, ms = 300): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));
const nowIso = () => new Date().toISOString();
const uid = () => "bp_" + Math.random().toString(36).slice(2, 10);

function readAll(): BrandProfile[] {
  seedBrandsIfEmpty();
  try {
    return JSON.parse(localStorage.getItem(BRAND_STORE_KEY) ?? "[]") as BrandProfile[];
  } catch {
    return [];
  }
}
const writeAll = (rows: BrandProfile[]) => localStorage.setItem(BRAND_STORE_KEY, JSON.stringify(rows));

const fromInput = (input: BrandProfileInput): Omit<BrandProfile, "id" | "createdAt" | "updatedAt"> => ({
  brandName: input.brandName,
  industry: input.industry,
  description: input.description?.trim() || null,
  brandVoice: input.brandVoice?.trim() || null,
  targetAudience: input.targetAudience,
  contentGoal: input.contentGoal?.trim() || null,
  platforms: input.platforms,
  postingFrequency: input.postingFrequency,
  preferredTimes: input.preferredTimes,
  logoUrl: input.logoUrl ?? null,
  brandKeywords: input.brandKeywords ?? [],
  brandDos: input.brandDos ?? [],
  brandDonts: input.brandDonts ?? [],
});

export async function listBrandProfiles(): Promise<BrandProfile[]> {
  return delay(readAll());
}

export async function createBrandProfile(input: BrandProfileInput): Promise<BrandProfile> {
  const row: BrandProfile = { ...fromInput(input), id: uid(), createdAt: nowIso(), updatedAt: nowIso() };
  writeAll([row, ...readAll()]);
  return delay(row);
}

export async function updateBrandProfile(id: string, input: BrandProfileInput): Promise<BrandProfile> {
  const rows = readAll();
  const idx = rows.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Brand profile not found");
  const updated: BrandProfile = { ...rows[idx], ...fromInput(input), updatedAt: nowIso() };
  rows[idx] = updated;
  writeAll(rows);
  return delay(updated);
}

export async function deleteBrandProfile(id: string): Promise<void> {
  writeAll(readAll().filter((p) => p.id !== id));
  return delay(undefined);
}
