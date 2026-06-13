import client, { ApiResponse } from "./client";

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
}

export async function listBrandProfiles(): Promise<BrandProfile[]> {
  const { data } = await client.get<ApiResponse<BrandProfile[]>>("/brand-profiles");
  return data.result;
}

export async function createBrandProfile(input: BrandProfileInput): Promise<BrandProfile> {
  const { data } = await client.post<ApiResponse<BrandProfile>>("/brand-profiles", input);
  return data.result;
}

export async function updateBrandProfile(
  id: string,
  input: BrandProfileInput
): Promise<BrandProfile> {
  const { data } = await client.put<ApiResponse<BrandProfile>>(`/brand-profiles/${id}`, input);
  return data.result;
}

export async function deleteBrandProfile(id: string): Promise<void> {
  await client.delete(`/brand-profiles/${id}`);
}
