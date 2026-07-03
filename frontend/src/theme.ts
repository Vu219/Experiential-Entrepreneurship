import type { Platform } from './types';

// ===== Brand identity (đồng bộ src/styles/tokens.css) =====
// Dải nhận diện TƯƠI, độc lập theme — dùng cho logo, nút chính, badge, avatar…
// Giữ bản JS song song với CSS token để code inline (style={{ background }}) dùng trực tiếp.
export const BRAND_GRADIENT = 'linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6)';
export const BRAND_GLOW = 'rgba(99,102,241,0.45)';

// Nền deep cho box CTA cuối trang: indigo sâu + glow brand ở 2 góc để có chiều sâu.
// Chữ trắng trên nền này đạt tương phản WCAG AA thoải mái.
export const CTA_BG =
  'radial-gradient(circle at 15% 20%, rgb(34 211 238 / .22), transparent 45%),' +
  'radial-gradient(circle at 85% 80%, rgb(139 92 246 / .32), transparent 50%),' +
  'linear-gradient(135deg,#1e1b4b,#312e81)';

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
