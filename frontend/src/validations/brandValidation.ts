// Validation cho Hồ sơ thương hiệu (FR-09) và Chiến lược content (FR-13).
// Trả về KEY i18n (không hardcode chuỗi) — component map qua `t[key]` để hiện inline.
// Mirror backend BrandProfileRequest: brandName / industry / targetAudience không trống,
// ít nhất 1 nền tảng. (postingFrequency được FE gửi default ngầm nên không validate ở đây.)

import type { Platform } from "../api/brandProfile";

export type BrandFieldError = "brandName" | "industry" | "targetAudience" | "platforms";
export type BrandFormErrors = Partial<Record<BrandFieldError, string>>;

export function validateBrandProfile(v: {
  brandName: string;
  industry: string;
  targetAudience: string;
  platforms: Platform[];
}): BrandFormErrors {
  const e: BrandFormErrors = {};
  if (!v.brandName.trim()) e.brandName = "errBrandNameReq";
  if (!v.industry.trim()) e.industry = "errIndustryReq";
  if (!v.targetAudience.trim()) e.targetAudience = "errAudienceReq";
  if (!v.platforms.length) e.platforms = "errPlatformReq";
  return e;
}

export type StrategyFieldError = "name" | "goals" | "contentTypes" | "platforms";
export type StrategyFormErrors = Partial<Record<StrategyFieldError, string>>;

export function validateStrategy(v: {
  name: string;
  goals: string[];
  contentTypes: string[];
  platforms: Platform[];
}): StrategyFormErrors {
  const e: StrategyFormErrors = {};
  if (!v.name.trim()) e.name = "csErrName";
  if (!v.goals.length) e.goals = "csErrGoal";
  if (!v.contentTypes.length) e.contentTypes = "csErrType";
  if (!v.platforms.length) e.platforms = "errPlatformReq";
  return e;
}
