import { useApp } from '../../context/AppContext';
import type { Platform } from '../../api/brandProfile';

/**
 * Giới hạn nội dung theo từng nền tảng (FB/IG/Threads — scope MVP) cho bộ đếm
 * caption + hashtag. Con số hashtag là mức khuyến nghị của nền tảng.
 */
export const PLATFORM_LIMITS: Record<Platform, { caption: number; hashtags: number }> = {
  FACEBOOK: { caption: 63206, hashtags: 30 },
  INSTAGRAM: { caption: 2200, hashtags: 30 },
  THREADS: { caption: 500, hashtags: 10 },
};

const counterStyle = (over: boolean) =>
  ({ fontSize: 11, fontWeight: 600, color: over ? '#dc2626' : '#a59fbb', marginTop: 5, textAlign: 'right' }) as const;

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
