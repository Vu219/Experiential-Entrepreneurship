import type { ContentLifecycle } from '../../api/contentGeneration';
import type { Dict } from '../../i18n';

// Map trạng thái vòng đời nội dung (state machine WORKFLOWS.md) → nhãn i18n + màu badge.
// Màu theo bảng đang dùng ở Dashboard/Admin (xanh lá = xong, tím = AI/lịch, cam = chờ, đỏ = lỗi).
export const CONTENT_STATUS_META: Record<ContentLifecycle, { labelKey: keyof Dict; color: string; bg: string }> = {
  DRAFT: { labelKey: 'clStDraft', color: '#64748b', bg: '#eef2f7' },
  GENERATED: { labelKey: 'clStGenerated', color: '#7c3aed', bg: '#f1e9ff' },
  NEED_REVIEW: { labelKey: 'clStNeedReview', color: '#d97706', bg: '#fdf0dc' },
  APPROVED: { labelKey: 'clStApproved', color: '#16a34a', bg: '#e8f8ee' },
  FORMATTED: { labelKey: 'clStFormatted', color: '#0e7490', bg: '#e0f7fb' },
  SCHEDULED: { labelKey: 'clStScheduled', color: '#7c3aed', bg: '#f1e9ff' },
  POSTING: { labelKey: 'clStPosting', color: '#d97706', bg: '#fdf0dc' },
  POSTED: { labelKey: 'clStPosted', color: '#16a34a', bg: '#e8f8ee' },
  FAILED: { labelKey: 'clStFailed', color: '#dc2626', bg: '#fee2e2' },
  ANALYZING: { labelKey: 'clStAnalyzing', color: '#0e7490', bg: '#e0f7fb' },
  OPTIMIZED: { labelKey: 'clStOptimized', color: '#16a34a', bg: '#e8f8ee' },
};

// Nhãn minh bạch AI (FR gắn nhãn): nội dung do AI tạo / cần người duyệt / đã tự đăng.
export function aiLabelKey(status: ContentLifecycle): keyof Dict {
  if (status === 'NEED_REVIEW') return 'clAiNeedReview';
  if (status === 'POSTED') return 'clAiAutoPosted';
  return 'clAiGenerated';
}
