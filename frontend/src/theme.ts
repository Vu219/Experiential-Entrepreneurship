import type { Platform } from './types';

// ===== Brand identity (đồng bộ src/styles/tokens.css) =====
// Dải nhận diện đọc THẲNG từ CSS token qua var() → đổi theo theme đang chọn
// (data-theme trên <html>, xem styles/tokens.css). Dùng trực tiếp trong inline style:
// background = var(--brand-gradient), box-shadow dùng var(--brand-glow).
// Nhờ đó ~mọi nút/badge/accent dùng brandGradient đổi tông khi đổi theme, không sửa lẻ.
export const BRAND_GRADIENT = 'var(--brand-gradient)';
export const BRAND_GLOW = 'var(--brand-glow)';

// Nền box CTA cuối trang: gradient SÁNG, desaturated theo màu thương hiệu
// (xanh nhạt → lavender → hồng nhạt) để card hoà vào phần còn lại của trang.
// Chữ navy đậm (#1E1B4B) trên nền này đạt tương phản thoải mái.
export const CTA_BG =
  'linear-gradient(135deg, #DBEAFE 0%, #F5F3FF 50%, #FCE7F3 100%)';

// Platform brand colors — MVP scope: Facebook → Instagram → Threads (see CLAUDE.md).
export const PLATFORM_BG: Record<string, string> = {
  FB: '#1877f2',
  IG: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)',
  TH: '#000000',
};

// Dải accent trên đỉnh card nền tảng (top accent bar) — gradient theo brand từng nền tảng.
export const PLATFORM_ACCENT: Record<string, string> = {
  FB: 'linear-gradient(90deg,#1877f2,#3b9eff)',
  IG: 'linear-gradient(90deg,#f9ce34,#ee2a7b,#6228d7)',
  TH: 'linear-gradient(90deg,#000000,#404040)',
};

export const PLATFORMS: Platform[] = [
  { name: 'Facebook', tag: 'FB', bg: PLATFORM_BG.FB },
  { name: 'Instagram', tag: 'IG', bg: PLATFORM_BG.IG },
  { name: 'Threads', tag: 'TH', bg: PLATFORM_BG.TH },
];

export const tagOf = (name: string): string =>
  ({
    Facebook: 'FB',
    Instagram: 'IG',
    Threads: 'TH',
  }[name] ?? name.slice(0, 2).toUpperCase());
