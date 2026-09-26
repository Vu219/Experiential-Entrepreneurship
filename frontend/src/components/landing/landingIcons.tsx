import {
  BarChart3, Bell, CalendarClock, Clock, Globe, Hash, Image, Layers, Lightbulb, MessageCircle,
  PenLine, Rocket, Search, ShieldCheck, Sparkles, Star, Target, TrendingUp, Users, Zap,
  type LucideIcon,
} from 'lucide-react';
import { PLATFORM_BG } from '../../theme';
import { PlatformTag } from '../ui';
import type { L10n } from '../../api/landing';

// Bộ icon có sẵn cho nội dung Landing do admin chọn (khoá lưu DB dạng chuỗi kebab-case).
// Khoá lạ/đã bỏ → icon mặc định, landing không bao giờ vỡ.

/** Icon cho thẻ "Một quy trình, trọn vẹn". */
export const FEATURE_ICONS: Record<string, { icon: LucideIcon; label: L10n }> = {
  search: { icon: Search, label: { vi: 'Tìm kiếm', en: 'Search' } },
  lightbulb: { icon: Lightbulb, label: { vi: 'Ý tưởng', en: 'Idea' } },
  'pen-line': { icon: PenLine, label: { vi: 'Viết', en: 'Write' } },
  'calendar-clock': { icon: CalendarClock, label: { vi: 'Lịch', en: 'Schedule' } },
  'bar-chart': { icon: BarChart3, label: { vi: 'Biểu đồ', en: 'Chart' } },
  sparkles: { icon: Sparkles, label: { vi: 'AI', en: 'AI' } },
  'trending-up': { icon: TrendingUp, label: { vi: 'Xu hướng', en: 'Trend' } },
  target: { icon: Target, label: { vi: 'Mục tiêu', en: 'Target' } },
  zap: { icon: Zap, label: { vi: 'Tốc độ', en: 'Speed' } },
  rocket: { icon: Rocket, label: { vi: 'Tăng trưởng', en: 'Growth' } },
  'message-circle': { icon: MessageCircle, label: { vi: 'Tương tác', en: 'Engage' } },
  users: { icon: Users, label: { vi: 'Khách hàng', en: 'Audience' } },
  'shield-check': { icon: ShieldCheck, label: { vi: 'Bảo mật', en: 'Security' } },
  clock: { icon: Clock, label: { vi: 'Thời gian', en: 'Time' } },
  image: { icon: Image, label: { vi: 'Hình ảnh', en: 'Media' } },
  hash: { icon: Hash, label: { vi: 'Hashtag', en: 'Hashtag' } },
  layers: { icon: Layers, label: { vi: 'Đa nền tảng', en: 'Multi-platform' } },
  bell: { icon: Bell, label: { vi: 'Thông báo', en: 'Alerts' } },
  star: { icon: Star, label: { vi: 'Nổi bật', en: 'Highlight' } },
};

export const featureIcon = (key: string): LucideIcon => FEATURE_ICONS[key]?.icon ?? Sparkles;

/** Icon có sẵn cho dải nền tảng tích hợp (ngoài bộ này admin dán URL ảnh logo). */
export const PLATFORM_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'threads', label: 'Threads' },
  { key: 'globe', label: 'Globe' },
];

const PLATFORM_TAG: Record<string, [string, string]> = {
  facebook: ['FB', PLATFORM_BG.FB],
  instagram: ['IG', PLATFORM_BG.IG],
  threads: ['TH', PLATFORM_BG.TH],
};

export function PlatformBadge({ icon, logoUrl, name, size = 30 }: { icon: string | null; logoUrl: string | null; name: string; size?: number }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} style={{ width: size, height: size, borderRadius: 9, objectFit: 'contain', display: 'block' }} />;
  }
  const tag = icon ? PLATFORM_TAG[icon] : undefined;
  if (tag) return <PlatformTag tag={tag[0]} bg={tag[1]} size={size} radius={9} fontSize={12} />;
  return (
    <span style={{ width: size, height: size, borderRadius: 9, background: 'linear-gradient(135deg,#edf9ff,#f6effc)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <Globe size={size * 0.55} color="#7c5cff" strokeWidth={1.8} />
    </span>
  );
}

/** Mạng xã hội ở footer (link của công ty — không phải nền tảng đăng bài). */
export const SOCIAL_OPTIONS: { key: string; label: string }[] = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'threads', label: 'Threads' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X' },
  { key: 'website', label: 'Website' },
];

export const socialLabel = (key: string): string => SOCIAL_OPTIONS.find((s) => s.key === key)?.label ?? key;

export function SocialIcon({ platform }: { platform: string }) {
  const stroke = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 } as const;
  const solid = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'currentColor' } as const;
  switch (platform) {
    case 'facebook':
      return <svg {...solid}><path d="M14 9h3V5.5h-3c-2.2 0-3.8 1.7-3.8 3.9V11H8v3.4h2.2V21h3.4v-6.6H16L16.5 11h-2.9V9.4c0-.3.2-.4.4-.4z" /></svg>;
    case 'instagram':
      return <svg {...stroke}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>;
    case 'linkedin':
      return <svg {...solid}><path d="M6.5 8.5A1.5 1.5 0 106.5 5.5a1.5 1.5 0 000 3zM5.2 10h2.6v9H5.2zM10 10h2.5v1.3c.4-.7 1.4-1.5 2.9-1.5 2.4 0 3.4 1.5 3.4 4.1V19h-2.6v-4.6c0-1.2-.4-2-1.5-2-.9 0-1.4.6-1.6 1.2-.1.2-.1.5-.1.8V19H10z" /></svg>;
    case 'youtube':
      return <svg {...stroke}><rect x="3" y="6.5" width="18" height="11" rx="3.2" /><path d="M11 9.8l3.2 1.9-3.2 1.9z" fill="currentColor" stroke="none" /></svg>;
    case 'threads':
      return <svg {...stroke}><path d="M16.5 11.2c-.4-2.3-2-3.5-4.3-3.5-2.6 0-4.2 1.9-4.2 4.4 0 2.8 1.7 4.6 4.4 4.6 2 0 3.4-1.1 3.4-2.7 0-1.5-1.2-2.4-3.2-2.4-1.5 0-2.4.7-2.4 1.6 0 .8.7 1.3 1.6 1.3 1.6 0 2.5-1.2 2.5-3.3" /><path d="M12.2 20.5c-4.6 0-8-3.3-8-8.5s3.4-8.5 8-8.5c3.6 0 6.2 1.9 7.2 5.2" /></svg>;
    case 'x':
      return <svg {...solid}><path d="M16.9 4H19.6l-5.9 6.8L20.6 20h-5.4l-4.2-5.5L6.1 20H3.4l6.3-7.3L3.1 4h5.5l3.8 5zm-.9 14.4h1.5L8 5.5H6.4z" /></svg>;
    default:
      return <Globe size={17} strokeWidth={1.8} />;
  }
}
