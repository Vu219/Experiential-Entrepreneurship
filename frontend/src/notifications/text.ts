// Câu hiển thị của một thông báo theo ngôn ngữ người dùng (D5: backend lưu type + params, FE dựng câu).
// Module thuần — test ở tests/notificationText.test.ts.
//
// Khoá i18n: ntf_<TYPE>_title + ntf_<TYPE>_body (hoặc ntf_<TYPE>_body_<variant> khi params.variant có giá trị).
// Placeholder {key} lấy từ params; nền tảng → tên hiển thị, mốc thời gian → định dạng theo ngôn ngữ.
// Không có params (bản ghi trước V17) hoặc thiếu khoá → title/message tiếng Việt backend đã lưu.
import type { AppNotification } from '../api/notifications.ts';
import { platformDisplayName, publishErrorCopy } from '../api/publishErrorCatalog.ts';
import { aiErrorMessage } from '../api/aiErrorMessages.ts';
import type { Lang } from '../types.ts';

export interface NotificationText {
  title: string;
  body: string;
}

type Dict = Record<string, string>;

const DATE_KEYS = /(At|Time|Date)$/;

function formatValue(key: string, value: unknown, lang: Lang): string {
  if (value == null) return '';
  if (key === 'platform') return platformDisplayName(String(value));
  if (typeof value === 'string' && DATE_KEYS.test(key)) {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(dateOnly ? `${value}T00:00:00` : value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'vi-VN',
        dateOnly ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    }
  }
  return String(value);
}

/** Thay {key} bằng params (thiếu → chuỗi rỗng), gộp khoảng trắng thừa. */
export function fillTemplate(template: string, params: Record<string, unknown>, lang: Lang): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => formatValue(key, params[key], lang))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function notificationText(n: AppNotification, t: Dict, lang: Lang): NotificationText {
  const fallback = { title: n.title, body: n.message ?? '' };
  const params = n.params;
  if (!params) return fallback;

  const variant = typeof params.variant === 'string' && params.variant ? params.variant : null;
  const extra: Record<string, unknown> = { ...params };

  // Lỗi đăng bài: câu lấy từ catalog theo mã chuẩn (một nguồn với trang Bài lỗi) — không bao giờ hiện message gốc.
  if (n.type === 'POST_FAILED' || (n.type === 'RECONNECT_NEEDED' && variant === 'PUBLISH_ERROR')) {
    const copy = publishErrorCopy(lang, String(params.code ?? ''), {
      platform: params.platform ? String(params.platform) : null,
      account: params.accountName ? String(params.accountName) : null,
    });
    const ref = params.reference ? ` ${fillTemplate(t.ntfRefLine ?? '', params, lang)}` : '';
    return { title: copy.title, body: `${copy.what}${ref}`.trim() };
  }
  if (n.type === 'CONTENT_GENERATION_FAILED') {
    extra.reason = aiErrorMessage(lang, params.errorCode as string | undefined);
  }

  const titleTpl = t[`ntf_${n.type}_title`];
  const bodyTpl = (variant && t[`ntf_${n.type}_body_${variant}`]) || t[`ntf_${n.type}_body`];
  if (!titleTpl || !bodyTpl) return fallback;
  return { title: fillTemplate(titleTpl, extra, lang), body: fillTemplate(bodyTpl, extra, lang) };
}
