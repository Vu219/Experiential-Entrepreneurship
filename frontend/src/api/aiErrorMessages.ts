import type { Lang } from '../types';

// Mã lỗi tạo nội dung AI → câu thân thiện cho người dùng cuối. Mã (tên ErrorCode backend, cùng tên
// với error_code của AI service) đến từ job FAILED (`errorCode`) hoặc `code` số của envelope lỗi.
// KHÔNG BAO GIỜ hiện JSON thô / stack trace / chuỗi kỹ thuật của provider: mã lạ → câu chung.
// Module thuần (chỉ import type) để test được bằng `node --test` — xem tests/aiErrorMessages.test.ts.

export type AiErrorCode = 'AI_PROVIDER_OVERLOADED' | 'AI_QUOTA_EXHAUSTED' | 'AI_TIMEOUT' | 'AI_BAD_REQUEST' | 'AI_UNAVAILABLE';

/** `code` số của ErrorCode backend → tên (lỗi trả đồng bộ qua envelope `{code, message}`). */
const NUMERIC_CODES: Record<number, AiErrorCode> = {
  1904: 'AI_UNAVAILABLE', // AI_SERVICE_ERROR — lỗi gọi AI chung
  1907: 'AI_TIMEOUT',
  1908: 'AI_PROVIDER_OVERLOADED',
  1909: 'AI_QUOTA_EXHAUSTED',
  1954: 'AI_BAD_REQUEST',
  1955: 'AI_UNAVAILABLE',
};

const MESSAGES: Record<AiErrorCode, { vi: string; en: string }> = {
  AI_PROVIDER_OVERLOADED: {
    vi: 'Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút.',
    en: 'The AI system is overloaded, please try again in a few minutes.',
  },
  AI_QUOTA_EXHAUSTED: {
    vi: 'Đã đạt giới hạn sử dụng AI hôm nay. Vui lòng thử lại sau hoặc liên hệ quản trị viên.',
    en: "Today's AI usage limit has been reached. Please try again later or contact an administrator.",
  },
  AI_TIMEOUT: {
    vi: 'Quá trình tạo nội dung mất nhiều thời gian hơn dự kiến. Nội dung có thể vẫn đang được tạo, hãy kiểm tra Thư viện nội dung sau ít phút.',
    en: 'Content generation is taking longer than expected. It may still be in progress — check the Content Library in a few minutes.',
  },
  AI_BAD_REQUEST: {
    vi: 'Yêu cầu không hợp lệ, vui lòng chỉnh lại nội dung đầu vào.',
    en: 'The request is invalid, please adjust your input.',
  },
  AI_UNAVAILABLE: {
    vi: 'Không thể tạo nội dung lúc này, vui lòng thử lại.',
    en: 'Content cannot be generated right now, please try again.',
  },
};

/** Tên mã AI đã biết, hoặc null nếu `code` không phải lỗi AI (vd 1906 bài không ở trạng thái Nháp). */
export function toAiErrorCode(code: string | number | null | undefined): AiErrorCode | null {
  if (code == null || code === '') return null;
  if (typeof code === 'number') return NUMERIC_CODES[code] ?? null;
  if (code === 'AI_SERVICE_ERROR') return 'AI_UNAVAILABLE';
  return code in MESSAGES ? (code as AiErrorCode) : null;
}

/** Câu hiển thị cho một mã lỗi AI; mã lạ / thiếu → "Không thể tạo nội dung lúc này…". */
export function aiErrorMessage(lang: Lang, code: string | number | null | undefined): string {
  const known = toAiErrorCode(code) ?? 'AI_UNAVAILABLE';
  return lang === 'en' ? MESSAGES[known].en : MESSAGES[known].vi;
}
