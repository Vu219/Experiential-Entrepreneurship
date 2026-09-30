// Validation cài đặt đăng bài — mirror backend PublishingSettingsRequest.
// Trả về KEY i18n (không hardcode chuỗi) — component map qua `t[key]` để hiện inline.

import type { PublishingSettings } from "../api/schedules";

export type PublishingSettingsField = "conflictWindowMinutes" | "brandVoiceThreshold";
export type PublishingSettingsErrors = Partial<Record<PublishingSettingsField, string>>;

export function validatePublishingSettings(v: PublishingSettings): PublishingSettingsErrors {
  const e: PublishingSettingsErrors = {};
  const w = v.conflictWindowMinutes;
  if (!Number.isInteger(w) || w < 0 || w > 1440) e.conflictWindowMinutes = "psErrConflict";
  const th = v.brandVoiceThreshold;
  const badThreshold = th != null && (!Number.isInteger(th) || th < 0 || th > 100);
  if (badThreshold || (v.brandVoiceBlockingEnabled && th == null)) e.brandVoiceThreshold = "psErrThreshold";
  return e;
}
