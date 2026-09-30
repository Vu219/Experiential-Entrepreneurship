import type { ContentItemStatus, ReviewStatus } from '../../api/contentGeneration';
import type { SaveReviewChoice } from '../../api/contentCreationService';
import type { Dict } from '../../i18n';
import { TONE_COLORS, type Tone } from '../../statusTokens';

// Map trạng thái TỔNG của bài (backend suy ra từ bản + lịch) → nhãn i18n + tone token.
// Màu KHÔNG đặt rời ở đây nữa — đọc từ bảng TONE_COLORS dùng chung toàn app (statusTokens.ts).
const meta = (labelKey: keyof Dict, tone: Tone) => ({ labelKey, tone, ...TONE_COLORS[tone] });

type StatusMeta = { labelKey: keyof Dict; tone: Tone; color: string; bg: string };

export const CONTENT_STATUS_META: Record<ContentItemStatus, StatusMeta> = {
  DRAFT: meta('clStDraft', 'neutral'),
  GENERATED: meta('clStGenerated', 'purple'),
  FORMATTED: meta('clStFormatted', 'info'),
  SCHEDULED: meta('clStScheduled', 'purple'),
  ON_HOLD: meta('clStOnHold', 'warning'),
  POSTING: meta('clStPosting', 'warning'),
  POSTED: meta('clStPosted', 'success'),
  PARTIALLY_POSTED: meta('clStPartiallyPosted', 'info'),
  FAILED: meta('clStFailed', 'danger'),
};

// FR-34 — duyệt là chip riêng, không trộn vào trạng thái tổng.
export const REVIEW_STATUS_META: Record<ReviewStatus, StatusMeta> = {
  NONE: meta('clRvNone', 'neutral'),
  NEED_REVIEW: meta('clStNeedReview', 'warning'),
  APPROVED: meta('clStApproved', 'success'),
  CHANGES_REQUESTED: meta('clRvChangesRequested', 'danger'),
};

/** Lựa chọn lưu ở mốc Hoàn thiện: "Nháp" dùng màu trạng thái tổng, hai lựa chọn còn lại là màu duyệt. */
export const SAVE_CHOICE_META: Record<SaveReviewChoice, StatusMeta> = {
  DRAFT: CONTENT_STATUS_META.DRAFT,
  NEED_REVIEW: REVIEW_STATUS_META.NEED_REVIEW,
  APPROVED: REVIEW_STATUS_META.APPROVED,
};

// Nhãn minh bạch AI (FR gắn nhãn): nội dung do AI tạo / cần người duyệt / đã tự đăng.
export function aiLabelKey(status: ContentItemStatus, reviewStatus: ReviewStatus): keyof Dict {
  if (reviewStatus === 'NEED_REVIEW') return 'clAiNeedReview';
  if (status === 'POSTED' || status === 'PARTIALLY_POSTED') return 'clAiAutoPosted';
  return 'clAiGenerated';
}
