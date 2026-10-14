import { AlertTriangle, type LucideIcon } from 'lucide-react';
import { ICON } from '../data';
import type { Dict } from '../i18n';
import type { Route } from '../types';

/**
 * NGUỒN DUY NHẤT của menu khu người dùng (cùng mẫu `config/adminNav.ts`). Sidebar và ô tìm kiếm
 * toàn cục (`search/registry.ts`) cùng đọc từ đây — thêm/đổi một trang ở một chỗ là cả hai cập nhật.
 *
 * Nhãn lưu dạng KHÓA i18n (`labelKey`), nơi hiển thị tự tra `t[labelKey]`. Khu này dành cho mọi
 * user đã đăng nhập nên không có trường `roles`; badge động (số lịch sắp đăng) do Sidebar tự gắn.
 */
export interface AppNavItem {
  key: Route;
  labelKey: keyof Dict;
  icon: LucideIcon;
}

export interface AppNavGroup {
  labelKey: keyof Dict;
  items: AppNavItem[];
}

// "Token & mức dùng" không còn là mục menu — đã thành tab trong Cài đặt (mục 7), lối vào là
// widget token ở đáy sidebar + dropdown avatar.
export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    labelKey: 'secMain',
    items: [
      { key: 'dashboard', labelKey: 'navDashboard', icon: ICON.dashboard },
      { key: 'analytics', labelKey: 'navAnalytics', icon: ICON.analytics },
      { key: 'trends', labelKey: 'navTrends', icon: ICON.trends },
    ],
  },
  {
    labelKey: 'secContent',
    items: [
      { key: 'create', labelKey: 'navCreate', icon: ICON.create },
      { key: 'calendar', labelKey: 'navCalendar', icon: ICON.calendar },
      // Trung tâm hồi phục bài lỗi (FR-35..FR-39) — bổ trợ lối vào từ trang Lịch + notification.
      { key: 'failedPosts', labelKey: 'navFailedPosts', icon: AlertTriangle },
    ],
  },
  {
    labelKey: 'secBrand',
    items: [{ key: 'brand', labelKey: 'navBrand', icon: ICON.brand }],
  },
];
