import client, { type ApiResponse } from "./apiClient";

// Tối ưu chiến lược từ dữ liệu (FR-65..FR-68) — backend StrategyOptimizationController.
// Job async (NFR-04): start → poll tới SUCCESS/FAILED; đề xuất PENDING chờ user duyệt.

export type OptimizationJobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
export type AppliedStatus = "PENDING" | "APPLIED" | "REJECTED";

/** Mã lỗi backend: chưa có bài nào thu analytics — không thể tối ưu (BR-10). */
export const ERR_NO_ANALYZED_POSTS = 1961;

export interface StrategyAdjustment {
  id: string;
  strategyId: string;
  adjustmentContent: string;
  rationale: string | null;
  insightContent: string | null;
  recommendation: string | null;
  appliedStatus: AppliedStatus;
  decidedAt: string | null;
  createdAt: string;
}

export interface StrategyOptimizationJob {
  id: string;
  status: OptimizationJobStatus;
  errorMessage: string | null;
  futureImprovements: string[];
  adjustments: StrategyAdjustment[];
}

// POST /content-strategies/{strategyId}/optimize
export async function startOptimization(strategyId: string): Promise<StrategyOptimizationJob> {
  const { data } = await client.post<ApiResponse<StrategyOptimizationJob>>(
    `/content-strategies/${strategyId}/optimize`,
  );
  return data.result;
}

// GET /content-strategies/optimize-jobs/{jobId}
export async function getOptimizationJob(jobId: string): Promise<StrategyOptimizationJob> {
  const { data } = await client.get<ApiResponse<StrategyOptimizationJob>>(
    `/content-strategies/optimize-jobs/${jobId}`,
  );
  return data.result;
}

// GET /content-strategies/{strategyId}/adjustments — FR-67: lịch sử đề xuất, mới nhất trước.
export async function listAdjustments(strategyId: string, status?: AppliedStatus): Promise<StrategyAdjustment[]> {
  const { data } = await client.get<ApiResponse<StrategyAdjustment[]>>(
    `/content-strategies/${strategyId}/adjustments`,
    { params: status ? { status } : {} },
  );
  return data.result;
}

// PATCH /content-strategies/adjustments/{id} — FR-68: APPLIED (chấp nhận) / REJECTED (từ chối).
export async function decideAdjustment(id: string, status: "APPLIED" | "REJECTED"): Promise<StrategyAdjustment> {
  const { data } = await client.patch<ApiResponse<StrategyAdjustment>>(
    `/content-strategies/adjustments/${id}`,
    { status },
  );
  return data.result;
}
