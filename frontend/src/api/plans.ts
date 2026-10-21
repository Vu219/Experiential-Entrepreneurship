import type { Lang } from '../types';
import client, { type ApiResponse } from './apiClient';
import type { PlanFeatureLimits, PlanLimitKey } from './planLimits';
import type { PlatformEnum } from './connections';
import type { PricingPlan, ComparisonGroup, ComparisonValue } from '../config/plans';
import { getDict } from '../i18n';
import { autoCellValue } from '../utils/comparisonCell';

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
  /** Nhãn chu kỳ để HIỂN THỊ cạnh giá (text tự do) — không dùng để tính toán. */
  billingCycleVi: string | null;
  billingCycleEn: string | null;
  /** Chu kỳ THẬT tính bằng tháng (tháng = 1, quý = 3, năm = 12) — mẫu số quy giá về MRR. */
  billingIntervalMonths: number;
  /** Số token HIỂN THỊ — backend sinh từ monthlyTokenLimit (không còn nhập riêng). null = không giới hạn. */
  tokenQuota: number | null;
  /** Hạn mức token THẬT mỗi kỳ (dùng chặn quota). null = không giới hạn. */
  monthlyTokenLimit: number | null;
  /** Mọi giới hạn theo gói (V15/V18/V20, gồm 2 giới hạn AI), giá trị thô — null khi BE cũ chưa trả. */
  featureLimits: PlanFeatureLimits | null;
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
  /** Chỉ admin: số người dùng đang ở gói (xác nhận khi lưu). */
  subscriberCount?: number;
}

export interface PlanFeatureValueDto {
  planCode: string;
  /** Ô dạng tick: true = ✓, false = —; null = dùng text. */
  boolValue: boolean | null;
  textVi: string | null;
  textEn: string | null;
}

/** Ô tự động của dòng so sánh LIÊN KẾT giới hạn — giá trị có cấu trúc, FE dựng chữ theo ngôn ngữ. */
export interface PlanFeatureAutoValueDto {
  planCode: string;
  kind: 'NUMBER' | 'UNLIMITED' | 'OFF' | 'ON' | 'PLATFORMS';
  value: number | null;
  /** PLATFORMS: nền tảng gói cho phép; comingSoon = đang khoá toàn hệ thống. */
  platforms: { platform: PlatformEnum; comingSoon: boolean }[] | null;
}

export interface PlanFeatureDto {
  id: string;
  groupVi: string | null;
  groupEn: string | null;
  nameVi: string;
  nameEn: string;
  displayOrder: number;
  values: PlanFeatureValueDto[];
  /** Liên kết một giới hạn thật → giá trị cột tự động (autoValues). null = nhập tay. */
  limitKey?: PlanLimitKey | null;
  autoValues?: PlanFeatureAutoValueDto[] | null;
}

export const PLAN_AI_UNLIMITED = -1;
export const PLAN_AI_LIMIT_MAX = 100_000;

/** Mặc định hệ thống (env) cho ô "Mặc định" của 3 gói lõi — giá trị THÔ (-1 = không giới hạn, 0 = tắt). */
export interface PlanLimitDefaults {
  featureLimits?: PlanFeatureLimits;
}

export interface PlansPayload {
  plans: PlanDto[];
  features: PlanFeatureDto[];
  limitDefaults?: PlanLimitDefaults;
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

/**
 * Body POST/PUT /admin/plans — thông tin hiển thị gửi trọn form. Giới hạn: null = GIỮ NGUYÊN (từng ô của featureLimits
 * và monthlyTokenLimit; -1 = không giới hạn); đưa ô về "Mặc định hệ thống" qua `resetToDefault` (chỉ gói lõi).
 * Gói tạo mới bắt buộc đủ mọi ô giới hạn (BE 2211).
 */
export interface PlanSaveInput {
  nameVi: string;
  nameEn: string;
  price: number;
  billingCycleVi: string | null;
  billingCycleEn: string | null;
  billingIntervalMonths: number;
  monthlyTokenLimit: number | null;
  featureLimits: PlanFeatureLimits | null;
  resetToDefault?: PlanLimitKey[];
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
  /** Liên kết giới hạn thật (null = nhập tay). */
  limitKey: PlanLimitKey | null;
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

/** Giá trị một ô của dòng so sánh: dòng liên kết giới hạn lấy từ autoValues, dòng nhập tay lấy từ values. */
export function featureCellValue(f: PlanFeatureDto, planCode: string, lang: Lang): ComparisonValue {
  if (f.limitKey && f.autoValues) {
    const cell = f.autoValues.find((x) => x.planCode === planCode);
    return cell ? autoCellValue(cell, f.limitKey, getDict(lang) as unknown as Record<string, string>) : false;
  }
  const v = f.values.find((x) => x.planCode === planCode);
  if (!v) return false; // ô chưa điền → hiển thị "—"
  if (v.boolValue !== null && v.boolValue !== undefined) return v.boolValue;
  return L(lang, v.textVi, v.textEn);
}

/** Gom dòng feature theo tên nhóm (giữ thứ tự xuất hiện); dòng không nhóm đứng riêng nhóm rỗng. */
export function toComparisonGroups(payload: PlansPayload, lang: Lang): ComparisonGroup[] {
  const groups: ComparisonGroup[] = [];
  for (const f of payload.features) {
    const title = L(lang, f.groupVi, f.groupEn);
    const values = payload.plans.map((p) => featureCellValue(f, p.code, lang));
    const row = { label: L(lang, f.nameVi, f.nameEn), values, auto: !!f.limitKey };
    const last = groups[groups.length - 1];
    if (last && last.title === title) {
      last.rows.push(row);
    } else {
      groups.push({ title, rows: [row] });
    }
  }
  return groups;
}
