import client, { type ApiResponse } from "./apiClient";

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

export async function listBrandProfiles(): Promise<BrandProfile[]> {
  const { data } = await client.get<ApiResponse<BrandProfile[]>>(BASE);
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
