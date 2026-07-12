import type { Lang } from '../types';

// ===== Dữ liệu gói giá FALLBACK =====
// 2026-07-12: nguồn thật là bảng `plans` trong DB (GET /plans/public — xem api/plans.ts,
// hooks/usePublicPlans.ts). File này chỉ còn là fallback khi API lỗi/đang tải (nội dung
// trùng dữ liệu seed của backend PlanDataInitializer) + nơi khai báo type dùng chung.

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

export interface PricingPlan {
  /** Mã gói viết thường ('free'/'plus'/'pro' + gói admin thêm sau qua DB). */
  id: string;
  name: string;
  /** Giá dạng số (đ/tháng) — dùng cho hiệu ứng đếm StatNumber. 0 = miễn phí. */
  priceValue: number;
  cadence: string;
  desc: string;
  /** Danh sách tính năng đầy đủ (card ở trang /pricing). */
  features: string[];
  /** 2–3 dòng nổi bật cho pricing teaser ở Landing. */
  teaserFeatures: string[];
  cta: string;
  featured?: boolean;
}

export function pricingPlans(lang: Lang): PricingPlan[] {
  return [
    {
      id: 'free',
      name: 'Free',
      priceValue: 0,
      cadence: P(lang, 'trọn đời', 'forever'),
      desc: P(lang, 'Trải nghiệm quy trình AI với một thương hiệu.', 'Try the AI pipeline with one brand.'),
      features: [
        P(lang, '1 hồ sơ thương hiệu', '1 brand profile'),
        P(lang, '5 bài viết AI mỗi tháng', '5 AI posts per month'),
        P(lang, 'Kết nối 1 nền tảng', 'Connect 1 platform'),
        P(lang, 'Nghiên cứu xu hướng cơ bản', 'Basic trend research'),
      ],
      teaserFeatures: [
        P(lang, '5 bài viết AI mỗi tháng', '5 AI posts per month'),
        P(lang, '1 thương hiệu · 1 nền tảng', '1 brand · 1 platform'),
      ],
      cta: P(lang, 'Bắt đầu miễn phí', 'Start for free'),
    },
    {
      id: 'plus',
      name: 'Plus',
      priceValue: 499000,
      cadence: P(lang, '/tháng', '/month'),
      desc: P(lang, 'Cho creator & shop cần nội dung đều đặn mỗi ngày.', 'For creators & shops posting every day.'),
      features: [
        P(lang, '3 hồ sơ thương hiệu', '3 brand profiles'),
        P(lang, '100 bài viết AI mỗi tháng', '100 AI posts per month'),
        P(lang, 'Đủ 3 nền tảng: Facebook · Instagram · Threads', 'All 3 platforms: Facebook · Instagram · Threads'),
        P(lang, 'Lên lịch & tự động đăng bài', 'Scheduling & auto-publishing'),
        P(lang, 'Phân tích hiệu quả sau đăng', 'Post-publish analytics'),
      ],
      teaserFeatures: [
        P(lang, '100 bài viết AI mỗi tháng', '100 AI posts per month'),
        P(lang, 'Đủ 3 nền tảng · tự động đăng', 'All 3 platforms · auto-publish'),
        P(lang, 'Phân tích sau đăng', 'Post-publish analytics'),
      ],
      cta: P(lang, 'Dùng thử Plus', 'Try Plus'),
    },
    {
      id: 'pro',
      name: 'Pro',
      priceValue: 1990000,
      cadence: P(lang, '/tháng', '/month'),
      desc: P(lang, 'Cho doanh nghiệp nhỏ chạy nhiều thương hiệu cùng lúc.', 'For small businesses running multiple brands.'),
      features: [
        P(lang, 'Không giới hạn hồ sơ thương hiệu', 'Unlimited brand profiles'),
        P(lang, 'Không giới hạn bài viết AI', 'Unlimited AI posts'),
        P(lang, 'AI tối ưu chiến lược từ dữ liệu', 'Data-driven strategy optimization'),
        P(lang, 'Báo cáo hiệu quả chuyên sâu', 'In-depth performance reports'),
        P(lang, 'Hỗ trợ ưu tiên', 'Priority support'),
      ],
      teaserFeatures: [
        P(lang, 'Không giới hạn thương hiệu & bài viết', 'Unlimited brands & posts'),
        P(lang, 'AI tối ưu chiến lược từ dữ liệu', 'Data-driven optimization'),
        P(lang, 'Hỗ trợ ưu tiên', 'Priority support'),
      ],
      cta: P(lang, 'Chọn Pro', 'Choose Pro'),
      featured: true,
    },
  ];
}

/** Hiển thị giá dạng chuỗi (dùng ở nơi không cần hiệu ứng đếm). */
export const formatPrice = (value: number): string =>
  value === 0 ? '0đ' : `${new Intl.NumberFormat('vi-VN').format(value)}đ`;

// ===== Bảng so sánh chi tiết (trang /pricing) =====
// Giá trị mỗi ô: string (hiển thị) hoặc boolean (✓ / —), theo thứ tự Free → Plus → Pro.
export type ComparisonValue = string | boolean;

export interface ComparisonRow {
  label: string;
  /** Một giá trị / gói, theo đúng thứ tự danh sách gói. */
  values: ComparisonValue[];
}

export interface ComparisonGroup {
  title: string;
  rows: ComparisonRow[];
}

export function comparisonGroups(lang: Lang): ComparisonGroup[] {
  const unlimited = P(lang, 'Không giới hạn', 'Unlimited');
  return [
    {
      title: P(lang, 'Nội dung & AI', 'Content & AI'),
      rows: [
        { label: P(lang, 'Bài viết AI mỗi tháng', 'AI posts per month'), values: ['5', '100', unlimited] },
        { label: P(lang, 'Hồ sơ thương hiệu', 'Brand profiles'), values: ['1', '3', unlimited] },
        { label: P(lang, 'Nghiên cứu xu hướng', 'Trend research'), values: [P(lang, 'Cơ bản', 'Basic'), P(lang, 'Nâng cao', 'Advanced'), P(lang, 'Nâng cao', 'Advanced')] },
        { label: P(lang, 'Gợi ý media prompt cho ảnh/video', 'Media prompts for images/video'), values: [true, true, true] },
      ],
    },
    {
      title: P(lang, 'Đăng bài & lịch', 'Publishing & scheduling'),
      rows: [
        { label: P(lang, 'Nền tảng kết nối', 'Connected platforms'), values: ['1', P(lang, '3 (FB · IG · Threads)', '3 (FB · IG · Threads)'), P(lang, '3 (FB · IG · Threads)', '3 (FB · IG · Threads)')] },
        { label: P(lang, 'Lên lịch & tự động đăng bài', 'Scheduling & auto-publishing'), values: [false, true, true] },
        { label: P(lang, 'Gợi ý khung giờ vàng', 'Prime-time suggestions'), values: [false, true, true] },
      ],
    },
    {
      title: P(lang, 'Phân tích & tối ưu', 'Analytics & optimization'),
      rows: [
        { label: P(lang, 'Phân tích hiệu quả sau đăng', 'Post-publish analytics'), values: [false, true, true] },
        { label: P(lang, 'AI tối ưu chiến lược từ dữ liệu', 'Data-driven strategy optimization'), values: [false, false, true] },
        { label: P(lang, 'Báo cáo hiệu quả chuyên sâu', 'In-depth performance reports'), values: [false, false, true] },
      ],
    },
    {
      title: P(lang, 'Hỗ trợ', 'Support'),
      rows: [
        { label: P(lang, 'Kênh hỗ trợ', 'Support channel'), values: ['Email', 'Email', P(lang, 'Ưu tiên', 'Priority')] },
      ],
    },
  ];
}
