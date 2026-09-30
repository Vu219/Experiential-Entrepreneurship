import {
  AlertTriangle, BrainCircuit, Briefcase, Code, LayoutTemplate, Coins, DollarSign, Gauge, KeyRound,
  Newspaper, Package, Route as RouteIcon, Server, Settings2, Users, FileText, type LucideIcon,
} from 'lucide-react';
import { ICON } from '../data';
import type { Dict } from '../i18n';
import type { Route } from '../types';
import type { UserRole } from '../api/admin';

/**
 * NGUỒN DUY NHẤT của menu khu Quản trị. Sidebar (danh sách mục theo nhóm) và khối "Lối tắt
 * quản trị" trên trang Tổng quan cùng đọc từ đây — thêm/bớt/đổi route một chỗ là cả hai nơi
 * cập nhật, không còn hai danh sách phải nhớ đồng bộ tay.
 *
 * Nhãn lưu dạng KHÓA i18n (`labelKey`) chứ không phải chuỗi, để bản đồ này không phụ thuộc
 * ngôn ngữ đang bật; nơi hiển thị tự tra `t[labelKey]`.
 */
export interface AdminNavItem {
  key: Route;
  labelKey: keyof Dict;
  icon: LucideIcon;
  /** Vai trò được thấy mục này. Cả khu quản trị hiện chỉ dành cho ADMIN. */
  roles: UserRole[];
}

export interface AdminNavGroup {
  /** Nhóm đầu (Bảng điều khiển) không có nhãn — mục Tổng quan tự đứng đầu. */
  labelKey?: keyof Dict;
  /** Icon đại diện cho cả nhóm — sidebar THU GỌN chỉ hiện icon này (mục con nằm trong flyout). */
  icon?: LucideIcon;
  items: AdminNavItem[];
}

const ADMIN_ONLY: UserRole[] = ['ADMIN'];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    items: [{ key: 'admin', labelKey: 'navAdminOverview', icon: ICON.dashboard, roles: ADMIN_ONLY }],
  },
  {
    labelKey: 'admGrpContent',
    icon: Newspaper,
    items: [
      { key: 'adminPosts', labelKey: 'navAdminPosts', icon: AlertTriangle, roles: ADMIN_ONLY },
      { key: 'adminLanding', labelKey: 'navAdminLanding', icon: LayoutTemplate, roles: ADMIN_ONLY },
    ],
  },
  {
    labelKey: 'admGrpBusiness',
    icon: Briefcase,
    items: [
      { key: 'adminUsers', labelKey: 'navAdminUsers', icon: Users, roles: ADMIN_ONLY },
      { key: 'adminRevenue', labelKey: 'navAdminRevenue', icon: DollarSign, roles: ADMIN_ONLY },
      { key: 'adminPlans', labelKey: 'navAdminPlans', icon: Package, roles: ADMIN_ONLY },
      { key: 'adminUsage', labelKey: 'navAdminUsage', icon: Gauge, roles: ADMIN_ONLY },
    ],
  },
  {
    labelKey: 'admGrpAi',
    icon: BrainCircuit,
    items: [
      { key: 'adminAiProviders', labelKey: 'navAdminAiProviders', icon: KeyRound, roles: ADMIN_ONLY },
      { key: 'adminAiModels', labelKey: 'navAdminAiModels', icon: RouteIcon, roles: ADMIN_ONLY },
      { key: 'adminAiUsage', labelKey: 'navAdminAiUsage', icon: Coins, roles: ADMIN_ONLY },
    ],
  },
  {
    labelKey: 'admGrpSystem',
    icon: Settings2,
    items: [
      { key: 'adminSystem', labelKey: 'navAdminSystem', icon: Server, roles: ADMIN_ONLY },
      { key: 'adminLogs', labelKey: 'navAdminLogs', icon: FileText, roles: ADMIN_ONLY },
      { key: 'adminApiVersions', labelKey: 'navAdminApi', icon: Code, roles: ADMIN_ONLY },
    ],
  },
];

/** Nhóm menu mà vai trò hiện tại được thấy; nhóm rỗng sau khi lọc thì bỏ hẳn. */
export function adminNavGroupsFor(role: UserRole | undefined): AdminNavGroup[] {
  if (!role) return [];
  return ADMIN_NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Các mục xuất hiện ở khối "Lối tắt quản trị" trên trang Tổng quan, theo thứ tự hiển thị.
 * Chỉ liệt kê ROUTE — nhãn/icon vẫn lấy từ cùng bản đồ trên, nên lối tắt không bao giờ lệch
 * tên hay lệch đường dẫn so với sidebar.
 */
const SHORTCUT_ROUTES: Route[] = ['adminUsers', 'adminPlans', 'adminPosts', 'adminUsage', 'adminAiUsage'];

/** Lối tắt đã lọc theo quyền — giữ đúng thứ tự của SHORTCUT_ROUTES. */
export function adminShortcutsFor(role: UserRole | undefined): AdminNavItem[] {
  const visible = adminNavGroupsFor(role).flatMap((group) => group.items);
  return SHORTCUT_ROUTES
    .map((route) => visible.find((item) => item.key === route))
    .filter((item): item is AdminNavItem => item !== undefined);
}
