import { useApp } from '../../context/AppContext';
import type { Platform } from '../../api/brandProfile';
import { C } from '../../styles/colors';

/**
 * Giới hạn nội dung theo từng nền tảng (FB/IG/Threads — scope MVP) cho bộ đếm
 * caption + hashtag. Con số hashtag là mức khuyến nghị của nền tảng.
 */
export const PLATFORM_LIMITS: Record<Platform, { caption: number; hashtags: number }> = {
  FACEBOOK: { caption: 63206, hashtags: 30 },
  INSTAGRAM: { caption: 2200, hashtags: 30 },
  THREADS: { caption: 500, hashtags: 10 },
};

/** Chuỗi hashtag người dùng gõ (cách nhau bởi space/phẩy) → mảng '#tag' đã chuẩn hóa. */
export const parseHashtags = (text: string): string[] =>
  text.split(/[\s,]+/).map((h) => h.replace(/^#/, '').trim()).filter(Boolean).map((h) => `#${h}`);

const counterStyle = (over: boolean) =>
  ({ fontSize: 11, fontWeight: 600, color: over ? C.danger : C.textFaint, marginTop: 5, textAlign: 'right' }) as const;

/** Bộ đếm ký tự caption theo giới hạn nền tảng — đặt ngay dưới ô/khối caption. */
export function CaptionCounter({ platform, text }: { platform: Platform; text: string }) {
  const { t, lang } = useApp();
  const locale = lang === 'en' ? 'en-US' : 'vi-VN';
  const limit = PLATFORM_LIMITS[platform].caption;
  const n = text.length;
  return (
    <div style={counterStyle(n > limit)}>
      {n.toLocaleString(locale)}/{limit.toLocaleString(locale)} {t.cwCharUnit}
    </div>
  );
}

/** Bộ đếm số hashtag theo mức khuyến nghị nền tảng — đặt ngay dưới ô/khối hashtag. */
export function HashtagCounter({ platform, count }: { platform: Platform; count: number }) {
  const { t } = useApp();
  const limit = PLATFORM_LIMITS[platform].hashtags;
  return (
    <div style={counterStyle(count > limit)}>
      {count}/{limit} {t.cwHashtagUnit}
    </div>
  );
}
