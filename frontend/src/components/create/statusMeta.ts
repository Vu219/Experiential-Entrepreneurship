import type { ContentLifecycle } from '../../api/contentGeneration';
import type { Dict } from '../../i18n';
import { TONE_COLORS, type Tone } from '../../statusTokens';

// Map trạng thái vòng đời nội dung (state machine WORKFLOWS.md) → nhãn i18n + tone token.
// Màu KHÔNG đặt rời ở đây nữa — đọc từ bảng TONE_COLORS dùng chung toàn app (statusTokens.ts).
const meta = (labelKey: keyof Dict, tone: Tone) => ({ labelKey, tone, ...TONE_COLORS[tone] });

export const CONTENT_STATUS_META: Record<
  ContentLifecycle,
  { labelKey: keyof Dict; tone: Tone; color: string; bg: string }
> = {
  DRAFT: meta('clStDraft', 'neutral'),
  GENERATED: meta('clStGenerated', 'purple'),
  NEED_REVIEW: meta('clStNeedReview', 'warning'),
  APPROVED: meta('clStApproved', 'success'),
  FORMATTED: meta('clStFormatted', 'info'),
  SCHEDULED: meta('clStScheduled', 'purple'),
  POSTING: meta('clStPosting', 'warning'),
  POSTED: meta('clStPosted', 'success'),
  FAILED: meta('clStFailed', 'danger'),
  ANALYZING: meta('clStAnalyzing', 'info'),
  OPTIMIZED: meta('clStOptimized', 'success'),
};

// Nhãn minh bạch AI (FR gắn nhãn): nội dung do AI tạo / cần người duyệt / đã tự đăng.
export function aiLabelKey(status: ContentLifecycle): keyof Dict {
  if (status === 'NEED_REVIEW') return 'clAiNeedReview';
  if (status === 'POSTED') return 'clAiAutoPosted';
  return 'clAiGenerated';
}
