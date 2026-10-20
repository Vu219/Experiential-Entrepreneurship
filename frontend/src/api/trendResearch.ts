import client, { type ApiResponse } from "./apiClient";

// Trend Research gọi backend thật qua api/apiClient.ts (envelope { code, message, result }).
// Endpoint: /trend-research (controller backend, context-path đã ở baseURL).
//
// NFR-04: research chạy nền — POST /trend-research/sessions trả phiên PENDING ngay,
// FE poll GET /trend-research/sessions/{id} tới khi status là COMPLETED hoặc FAILED.

export type ResearchStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type ResearchSuitability = "LOW" | "MEDIUM" | "HIGH";
export type ResearchPlatform = "FACEBOOK" | "INSTAGRAM" | "THREADS";
export type TrendType = "EVENT" | "NEWS" | "FORMAT" | "NICHE";
export type TrendMomentum = "NEW" | "RISING" | "STABLE" | "FADING";
export type ResearchTrigger = "MANUAL" | "SCHEDULED";

/** Nguồn thật đứng sau một trend (AI không tự viết URL — code gắn từ dữ liệu đã thu thập). */
export interface TrendEvidence {
  title: string;
  url: string; // rỗng với mốc lịch marketing
  source: "web" | "google_trends" | "calendar" | "youtube" | "instagram" | "threads" | string;
}

/** Một nguồn dữ liệu của phiên và kết quả của nó — minh bạch chất lượng research. */
export interface ResearchDataSource {
  name: string; // web_search | google_trends | calendar | youtube | instagram | threads
  status: "ok" | "empty" | "skipped" | "failed";
  items: number;
}

export interface ResearchContentIdea {
  id: string;
  ideaTitle: string;
  ideaDescription: string | null;
  platform: ResearchPlatform;
  suitabilityLevel: ResearchSuitability | null;
  executionSuggestions?: string[];
  relatedGoals?: string[];
  /** Người dùng đã lưu (V19 — trước đây chỉ ở localStorage). */
  saved?: boolean;
}

export interface ResearchTrend {
  id: string;
  trendName: string;
  platform: ResearchPlatform;
  relevanceScore: number | null;
  description: string | null;
  // Nghiên cứu dựa trên bằng chứng — phiên cũ trả null/[].
  relevance?: ResearchSuitability | null;
  trendType?: TrendType | null;
  momentum?: TrendMomentum | null;
  actBy?: string | null; // yyyy-MM-dd
  confidence?: ResearchSuitability | null;
  hashtags?: string[];
  evidence?: TrendEvidence[];
  contentIdeas: ResearchContentIdea[];
}

export interface ResearchSessionDetail {
  id: string;
  industry: string;
  platform: ResearchPlatform;
  strategyName: string | null; // chiến lược user chọn lúc bắt đầu (phiên cũ: null)
  articleCount: number | null; // số ý tưởng user yêu cầu (null = mặc định backend)
  researchTime: string; // ISO datetime
  status: ResearchStatus;
  summary: string | null;
  errorMessage: string | null;
  triggerType?: ResearchTrigger;
  grounded?: boolean | null; // true = AI đã tìm kiếm web thật; false/null = nguồn hạn chế
  webSearches?: number | null;
  dataSources?: ResearchDataSource[];
  trends: ResearchTrend[];
}

export interface ResearchSessionSummary {
  id: string;
  industry: string;
  platform: ResearchPlatform;
  researchTime: string;
  status: ResearchStatus;
  trendsFound: number;
  ideasCreated: number;
  triggerType?: ResearchTrigger;
  grounded?: boolean | null;
}

export interface TrendResearchInput {
  brandProfileId?: string; // mặc định: brand profile đang hoạt động
  platform?: ResearchPlatform; // mặc định: FACEBOOK
  strategyId?: string; // mặc định: chiến lược ACTIVE mới nhất của brand
  articleCount?: number; // số ý tưởng mong muốn 1–20; mặc định backend = 10
}

// POST /trend-research/sessions — "Research ngay" (FR-19)
export async function startTrendResearch(input?: TrendResearchInput): Promise<ResearchSessionDetail> {
  const { data } = await client.post<ApiResponse<ResearchSessionDetail>>("/trend-research/sessions", input ?? {});
  return data.result;
}

// GET /trend-research/sessions/{sessionId} — poll trạng thái + kết quả
export async function getTrendResearchSession(sessionId: string): Promise<ResearchSessionDetail> {
  const { data } = await client.get<ApiResponse<ResearchSessionDetail>>(`/trend-research/sessions/${sessionId}`);
  return data.result;
}

// GET /trend-research/sessions — lịch sử phiên (FR-23), mới nhất trước
export async function listTrendResearchSessions(): Promise<ResearchSessionSummary[]> {
  const { data } = await client.get<ApiResponse<ResearchSessionSummary[]>>("/trend-research/sessions");
  return data.result;
}

// DELETE /trend-research/trends — xóa (soft delete) nhiều trend không phù hợp; trả số đã xóa
export async function deleteTrends(trendIds: string[]): Promise<number> {
  const { data } = await client.delete<ApiResponse<number>>("/trend-research/trends", { data: { trendIds } });
  return data.result;
}

// PUT /trend-research/ideas/{id}/saved — "Lưu ý tưởng" lưu ở backend (V19).
export async function setIdeaSaved(ideaId: string, saved: boolean): Promise<ResearchContentIdea> {
  const { data } = await client.put<ApiResponse<ResearchContentIdea>>(`/trend-research/ideas/${ideaId}/saved`, { saved });
  return data.result;
}

// ===== Lịch nghiên cứu tự động (V19) — backend chạy đúng giờ đã chọn (mỗi giờ quét, phút bỏ qua) =====
export type TrendScheduleFrequency = "DAILY" | "WEEKLY";

export interface TrendResearchScheduleDto {
  enabled: boolean;
  brandProfileId: string | null;
  brandName: string | null;
  strategyId: string | null;
  strategyName: string | null;
  platforms: ResearchPlatform[];
  frequency: TrendScheduleFrequency;
  /** 0 = Thứ Hai … 6 = Chủ nhật (chỉ WEEKLY). */
  days: number[];
  /** "HH:mm". */
  time: string;
  lastRunAt: string | null;
}

export type TrendResearchScheduleInput = Omit<TrendResearchScheduleDto, "brandName" | "strategyName" | "lastRunAt">;

/** null = chưa cấu hình (backend chạy mặc định 02:00 hằng ngày cho hồ sơ đang hoạt động). */
export async function getTrendResearchSchedule(): Promise<TrendResearchScheduleDto | null> {
  const { data } = await client.get<ApiResponse<TrendResearchScheduleDto | null>>("/trend-research/schedule");
  return data.result ?? null;
}

export async function saveTrendResearchSchedule(input: TrendResearchScheduleInput): Promise<TrendResearchScheduleDto> {
  const { data } = await client.put<ApiResponse<TrendResearchScheduleDto>>("/trend-research/schedule", input);
  return data.result;
}
