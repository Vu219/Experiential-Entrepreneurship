import type { Lang } from '../types';
import client, { type ApiResponse } from './apiClient';
import type { PricingPlan, ComparisonGroup } from '../config/plans';

// 2026-07-12: Gói dịch vụ chuyển từ hardcode (config/plans.ts) sang DB — bảng plans +
// plan_features (backend). Landing/pricing đọc GET /plans/public (chỉ gói isActive);
// admin quản lý qua /admin/plans. Nội dung song ngữ vi/en, FE chọn theo lang đang bật.

// ===== Shape backend (PlansResponse) =====
export interface PlanDto {
  id: string;
  code: string; // FREE/PLUS/PRO bất biến; gói admin thêm mới thì tùy
  nameVi: string;
  nameEn: string;
  price: number; // VND / chu kỳ, 0 = miễn phí
  billingCycleVi: string | null;
  billingCycleEn: string | null;
  /** Hạn mức token MÔ TẢ để hiển thị (chưa phải số dư thật). null = không giới hạn. */
  tokenQuota: number | null;
  descriptionVi: string | null;
  descriptionEn: string | null;
  featuresVi: string[];
  featuresEn: string[];
  teaserFeaturesVi: string[];
  teaserFeaturesEn: string[];
  ctaVi: string | null;
  ctaEn: string | null;
  highlight: boolean;
  displayOrder: number;
  isActive: boolean;
  /** true với 3 gói lõi — UI khóa sửa code / xóa. */
  core: boolean;
}

export interface PlanFeatureValueDto {
  planCode: string;
  /** Ô dạng tick: true = ✓, false = —; null = dùng text. */
  boolValue: boolean | null;
  textVi: string | null;
  textEn: string | null;
}

export interface PlanFeatureDto {
  id: string;
  groupVi: string | null;
  groupEn: string | null;
  nameVi: string;
  nameEn: string;
  displayOrder: number;
  values: PlanFeatureValueDto[];
}

export interface PlansPayload {
  plans: PlanDto[];
  features: PlanFeatureDto[];
}

// ===== Public (landing + /pricing) =====
export async function getPublicPlans(): Promise<PlansPayload> {
  const { data } = await client.get<ApiResponse<PlansPayload>>('/plans/public');
  return data.result;
}

// ===== Admin =====
export async function getAdminPlans(): Promise<PlansPayload> {
  const { data } = await client.get<ApiResponse<PlansPayload>>('/admin/plans');
  return data.result;
}

/** Body PUT /admin/plans/{id} — FULL update (gửi trọn form; tokenQuota null = không giới hạn). */
export interface PlanSaveInput {
  nameVi: string;
  nameEn: string;
  price: number;
  billingCycleVi: string | null;
  billingCycleEn: string | null;
  tokenQuota: number | null;
  descriptionVi: string | null;
  descriptionEn: string | null;
  featuresVi: string[];
  featuresEn: string[];
  teaserFeaturesVi: string[];
  teaserFeaturesEn: string[];
  ctaVi: string | null;
  ctaEn: string | null;
  highlight: boolean;
  displayOrder: number;
  isActive: boolean;
}

export async function createPlan(input: PlanSaveInput & { code: string }): Promise<PlanDto> {
  const { data } = await client.post<ApiResponse<PlanDto>>('/admin/plans', input);
  return data.result;
}

export async function updatePlan(id: string, input: PlanSaveInput): Promise<PlanDto> {
  const { data } = await client.put<ApiResponse<PlanDto>>(`/admin/plans/${id}`, input);
  return data.result;
}

// Gói lõi bị BE chặn bằng mã 1983 (PLAN_CORE_PROTECTED) — UI đã ẩn nút xóa từ trước.
export async function deletePlan(id: string): Promise<void> {
  await client.delete<ApiResponse<string>>(`/admin/plans/${id}`);
}

export interface FeatureSaveInput {
  groupVi: string | null;
  groupEn: string | null;
  nameVi: string;
  nameEn: string;
  displayOrder: number;
  values: PlanFeatureValueDto[];
}

export async function createFeature(input: FeatureSaveInput): Promise<PlanFeatureDto> {
  const { data } = await client.post<ApiResponse<PlanFeatureDto>>('/admin/plans/features', input);
  return data.result;
}

export async function updateFeature(id: string, input: FeatureSaveInput): Promise<PlanFeatureDto> {
  const { data } = await client.put<ApiResponse<PlanFeatureDto>>(`/admin/plans/features/${id}`, input);
  return data.result;
}

export async function deleteFeature(id: string): Promise<void> {
  await client.delete<ApiResponse<string>>(`/admin/plans/features/${id}`);
}

// ===== Map payload BE → shape UI sẵn có (PlanCard/PricingPage giữ nguyên) =====

const L = (lang: Lang, vi: string | null, en: string | null): string =>
  (lang === 'en' ? en || vi : vi || en) ?? '';

const pickList = (lang: Lang, vi: string[], en: string[]): string[] =>
  lang === 'en' ? (en.length ? en : vi) : (vi.length ? vi : en);

export function toPricingPlans(payload: PlansPayload, lang: Lang): PricingPlan[] {
  return payload.plans.map((p) => ({
    id: p.code.toLowerCase(),
    name: L(lang, p.nameVi, p.nameEn),
    priceValue: p.price,
    cadence: L(lang, p.billingCycleVi, p.billingCycleEn),
    desc: L(lang, p.descriptionVi, p.descriptionEn),
    features: pickList(lang, p.featuresVi, p.featuresEn),
    teaserFeatures: pickList(lang, p.teaserFeaturesVi, p.teaserFeaturesEn),
    cta: L(lang, p.ctaVi, p.ctaEn),
    featured: p.highlight,
  }));
}

/** Gom dòng feature theo tên nhóm (giữ thứ tự xuất hiện); dòng không nhóm đứng riêng nhóm rỗng. */
export function toComparisonGroups(payload: PlansPayload, lang: Lang): ComparisonGroup[] {
  const groups: ComparisonGroup[] = [];
  for (const f of payload.features) {
    const title = L(lang, f.groupVi, f.groupEn);
    const values = payload.plans.map((p) => {
      const v = f.values.find((x) => x.planCode === p.code);
      if (!v) return false; // ô chưa điền → hiển thị "—"
      if (v.boolValue !== null && v.boolValue !== undefined) return v.boolValue;
      return L(lang, v.textVi, v.textEn);
    });
    const last = groups[groups.length - 1];
    if (last && last.title === title) {
      last.rows.push({ label: L(lang, f.nameVi, f.nameEn), values });
    } else {
      groups.push({ title, rows: [{ label: L(lang, f.nameVi, f.nameEn), values }] });
    }
  }
  return groups;
}
