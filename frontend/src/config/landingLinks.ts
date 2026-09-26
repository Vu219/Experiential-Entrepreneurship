import type { Dict } from '../i18n';

// Gợi ý đường link cho nút/link trên Landing (ô "Đường link" ở admin /admin/landing).
// CHỈ trang công khai + section của trang chủ — trang trong app/admin bắt đăng nhập, khách bấm
// vào sẽ bị đẩy về /login. id section phải khớp id gắn trong LandingPage / components/landing/*.
// Admin vẫn gõ tự do được (https://…, mailto:…) — đây chỉ là gợi ý.

export interface LinkSuggestion {
  href: string;
  label: keyof Dict;
  group: 'pages' | 'sections';
}

export const LANDING_LINK_SUGGESTIONS: LinkSuggestion[] = [
  { href: '/', label: 'lpSugHome', group: 'pages' },
  { href: '/pricing', label: 'lpSugPricing', group: 'pages' },
  { href: '/register', label: 'lpSugRegister', group: 'pages' },
  { href: '/login', label: 'lpSugLogin', group: 'pages' },
  { href: '/#home', label: 'lpSugTop', group: 'sections' },
  { href: '/#features', label: 'lpTabFeatures', group: 'sections' },
  { href: '/#how-it-works', label: 'lpTabHowItWorks', group: 'sections' },
  { href: '/#integrations', label: 'lpTabIntegrations', group: 'sections' },
  { href: '/#pricing', label: 'lpSugPlans', group: 'sections' },
  { href: '/#faq', label: 'lpTabFaq', group: 'sections' },
  { href: '/#resources', label: 'lpTabFooter', group: 'sections' },
];
