import type { getDict } from '../../../i18n';
import type { Lang } from '../../../types';
import type { Tone } from '../../../statusTokens';
import type { AdminPostProblem } from '../../../api/admin';
import {
  publishErrorCategoryLabel, publishErrorCopy, type PublishErrorCategory, type PublishErrorCopy,
} from '../../../api/publishErrorCatalog';
import { AP_PLATFORM_NAME } from './platforms';

// NGUỒN DUY NHẤT cho "lý do" của trang admin "Bài đăng lỗi & bị từ chối": badge + câu mô tả lấy từ MÃ LỖI CHUẨN
// do backend chuẩn hoá (PublishErrorCode) qua catalog dùng chung với trang của người dùng (api/publishErrorCatalog.ts).
// Trước đây FE tự đoán phân loại bằng từ khoá trong message gốc — đã bỏ: phân loại nằm ở backend (luật + ánh xạ
// admin), message gốc (đã redact) chỉ hiển thị nguyên văn trong khối "Phản hồi gốc" của panel chi tiết.

export type ApDict = ReturnType<typeof getDict>;

/**
 * Tone theo nhóm lỗi — dùng lại 7 tone ngữ nghĩa của statusTokens theo CÁCH XỬ LÝ: đỏ = vi phạm chính sách,
 * tím = tài khoản/quyền (kết nối lại), cam = nội dung/media (sửa bài), xanh = nền tảng/mạng (tự thử lại),
 * xám = lỗi hệ thống / chưa phân loại (admin xử lý).
 */
export const CATEGORY_TONE: Record<PublishErrorCategory, Tone> = {
  POLICY: 'danger',
  AUTH: 'purple',
  PERMISSION: 'purple',
  ACCOUNT: 'purple',
  CONTENT: 'warning',
  MEDIA: 'warning',
  RATE_LIMIT: 'info',
  NETWORK: 'info',
  PLATFORM: 'info',
  QUOTA: 'info',
  INTERNAL: 'neutral',
  UNKNOWN: 'neutral',
};

/** Badge nhóm lỗi của một bài. */
export function reasonBadge(post: AdminPostProblem, lang: Lang): { tone: Tone; label: string } {
  return { tone: CATEGORY_TONE[post.category] ?? 'neutral', label: publishErrorCategoryLabel(lang, post.category) };
}

/** Câu chữ thân thiện (tiêu đề / chuyện gì / vì sao / các bước) — cùng câu người dùng nhìn thấy. */
export function reasonCopy(post: AdminPostProblem, lang: Lang): PublishErrorCopy {
  return publishErrorCopy(lang, post.code, { platform: AP_PLATFORM_NAME[post.platform], account: post.accountName });
}

/** Dòng phụ cột "Thử lại": chỉ lỗi TẠM THỜI đã thử đủ lượt mới là "Đã hết lượt"; lỗi vĩnh viễn không tự thử lại. */
export function retryHint(post: AdminPostProblem, t: ApDict): string {
  if (post.nextRetryAt) return `${t.apNextRetry} ${post.nextRetryAt.slice(11, 16)}`;
  return post.errorType === 'TEMPORARY' && (post.retryCount ?? 0) >= 3 ? t.apRetryExhausted : t.apRetryNone;
}
