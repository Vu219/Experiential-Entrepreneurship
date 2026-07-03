import client, { type ApiResponse, type PageResponse } from "./apiClient";

// Brand Profile gọi backend thật qua api/apiClient.ts (envelope { code, message, result }).
// Controller backend map "/api/brand-profiles"; baseURL đã chứa context-path nên path tương đối
// là "/api/brand-profiles".

export type Platform = "FACEBOOK" | "INSTAGRAM" | "THREADS";

export interface BrandProfile {
  id: string;
  brandName: string;
  industry: string;
  description: string | null;
  brandVoice: string | null;
  targetAudience: string;
  contentGoal: string | null;
  platforms: Platform[];
  logoUrl: string | null;
  brandKeywords: string[];
  brandDos: string[];
  brandDonts: string[];
  /** Hồ sơ đang dùng (tối đa 1 active / user) — hồ sơ đầu tiên tạo ra tự động active. */
  isActive: boolean;
  /** Số chiến lược content liên kết (backend chỉ đếm sẵn ở API list — get/create/update trả null). */
  strategyCount: number | null;
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
  logoUrl?: string | null;
  brandKeywords?: string[];
  brandDos?: string[];
  brandDonts?: string[];
}

const BASE = "/api/brand-profiles";

// Tham số phân trang + lọc server-side (PageResponse của backend; page đánh số từ 0).
export interface BrandProfileListParams {
  q?: string;
  industry?: string;
  page?: number;
  size?: number;
}

// GET /api/brand-profiles — phân trang server-side (mặc định backend: 6/trang, mới nhất trước).
export async function listBrandProfiles(params: BrandProfileListParams = {}): Promise<PageResponse<BrandProfile>> {
  const { data } = await client.get<ApiResponse<PageResponse<BrandProfile>>>(BASE, { params });
  return data.result;
}

// Lấy TOÀN BỘ hồ sơ (chọn thương hiệu ở Trend Research / Chiến lược content — không phân trang UI).
export async function listAllBrandProfiles(): Promise<BrandProfile[]> {
  const { data } = await client.get<ApiResponse<PageResponse<BrandProfile>>>(BASE, { params: { size: 1000 } });
  return data.result.content;
}

// GET /api/brand-profiles/industries — toàn bộ ngành hàng user đang dùng (dropdown lọc).
export async function listBrandIndustries(): Promise<string[]> {
  const { data } = await client.get<ApiResponse<string[]>>(`${BASE}/industries`);
  return data.result;
}

export async function createBrandProfile(input: BrandProfileInput): Promise<BrandProfile> {
  const { data } = await client.post<ApiResponse<BrandProfile>>(BASE, input);
  return data.result;
}

export async function updateBrandProfile(id: string, input: BrandProfileInput): Promise<BrandProfile> {
  const { data } = await client.put<ApiResponse<BrandProfile>>(`${BASE}/${id}`, input);
  return data.result;
}

export async function deleteBrandProfile(id: string): Promise<void> {
  await client.delete(`${BASE}/${id}`);
}
