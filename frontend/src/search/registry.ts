import {
  Activity, AlertTriangle, BarChart3, Bell, Clock, Flame, Globe, Hash, History, Layers, Lightbulb, ListChecks,
  LogOut, Monitor, Moon, Palette, PieChart, Plug, Receipt, Send, Sparkles, Sun, Target, Gauge, Star, XCircle,
  Search as SearchIcon, type LucideIcon,
} from 'lucide-react';
import { APP_NAV_GROUPS } from '../config/appNav';
import { ADMIN_NAV_GROUPS } from '../config/adminNav';
import { ICON } from '../data';
import type { Dict } from '../i18n';
import type { Route } from '../types';
import type { SearchArea, StaticSearchItem } from './types';

/**
 * Registry TĨNH của ô tìm kiếm toàn cục: trang & chức năng / khu vực trong trang / hành động nhanh.
 *
 * - TRANG lấy thẳng từ `config/appNav.ts` + `config/adminNav.ts` (cùng nguồn với sidebar) — thêm mục menu là
 *   tự tìm được; ở đây chỉ bổ sung TỪ ĐỒNG NGHĨA theo route và vài trang không nằm trên menu (Hồ sơ, Cài đặt, Gói).
 * - Từ đồng nghĩa (vi + en) chỉ dùng để khớp, KHÔNG hiển thị nên không đi qua i18n; nhãn hiển thị luôn là `t[...]`.
 * - Khu vực quản trị chỉ có trang + hành động quản trị (không tìm dữ liệu).
 */

const APP: readonly SearchArea[] = ['app'];
const ADMIN: readonly SearchArea[] = ['admin'];
const BOTH: readonly SearchArea[] = ['app', 'admin'];

/** Từ đồng nghĩa theo route — dùng cho mục trang (cả trang lấy từ menu). */
const PAGE_KEYWORDS: Partial<Record<Route, readonly string[]>> = {
  dashboard: ['bảng điều khiển', 'tổng quan', 'trang chính', 'home', 'dashboard', 'overview'],
  analytics: ['phân tích', 'thống kê', 'báo cáo', 'số liệu', 'hiệu quả', 'analytics', 'report', 'insights', 'metrics'],
  trends: ['xu hướng', 'nghiên cứu', 'ý tưởng', 'trend', 'trending', 'research', 'ideas'],
  create: ['nội dung', 'bài viết', 'bài đăng', 'thư viện', 'content', 'posts', 'library'],
  calendar: ['lịch đăng', 'lên lịch', 'hàng đợi', 'schedule', 'calendar', 'queue', 'planner'],
  failedPosts: ['bài lỗi', 'đăng lỗi', 'thất bại', 'vi phạm', 'thử lại', 'failed', 'errors', 'retry', 'rejected'],
  brand: ['thương hiệu', 'hồ sơ thương hiệu', 'chiến lược', 'chiến dịch', 'brand', 'strategy', 'campaign'],
  profile: ['hồ sơ', 'tài khoản', 'mật khẩu', 'ảnh đại diện', 'profile', 'account', 'password', 'avatar'],
  settings: ['cài đặt', 'thiết lập', 'tùy chỉnh', 'settings', 'preferences'],
  billing: ['gói', 'thanh toán', 'nâng cấp', 'hóa đơn', 'billing', 'plan', 'upgrade', 'pro', 'payment'],
  admin: ['tổng quan', 'bảng điều khiển', 'overview', 'dashboard'],
  adminUsers: ['người dùng', 'tài khoản', 'khóa tài khoản', 'users', 'accounts'],
  adminPosts: ['bài lỗi', 'bị từ chối', 'vi phạm', 'failed posts', 'rejected'],
  adminRevenue: ['doanh thu', 'đơn hàng', 'thanh toán', 'revenue', 'orders', 'payments'],
  adminPlans: ['gói dịch vụ', 'bảng giá', 'plans', 'pricing'],
  adminLanding: ['trang chủ', 'landing', 'cms', 'nội dung trang chủ'],
  adminUsage: ['token', 'hạn mức', 'mức dùng', 'usage', 'quota'],
  adminAiProviders: ['nhà cung cấp ai', 'api key', 'providers', 'anthropic', 'google'],
  adminAiModels: ['model', 'định tuyến', 'routing', 'fallback'],
  adminAiUsage: ['chi phí ai', 'sử dụng ai', 'ai usage', 'cost'],
  adminSystem: ['hệ thống', 'trạng thái', 'sức khỏe', 'system', 'status', 'health'],
  adminLogs: ['nhật ký', 'logs', 'log hệ thống', 'activity log'],
  adminApiVersions: ['phiên bản api', 'graph api', 'api versions', 'meta'],
};

const page = (route: Route, label: (t: Dict) => string, icon: LucideIcon, areas: readonly SearchArea[],
  extra: Partial<StaticSearchItem> = {}): StaticSearchItem => ({
  id: `page:${route}`, group: 'pages', label, icon, areas, keywords: PAGE_KEYWORDS[route],
  target: { kind: 'route', route }, ...extra,
});

const appPages: StaticSearchItem[] = APP_NAV_GROUPS.flatMap((g) =>
  g.items.map((n) => page(n.key, (t) => t[n.labelKey], n.icon, APP)));

const adminPages: StaticSearchItem[] = ADMIN_NAV_GROUPS.flatMap((g) =>
  g.items.map((n) => page(n.key, (t) => t[n.labelKey], n.icon, ADMIN, {
    roles: n.roles,
    desc: g.labelKey ? (t) => t[g.labelKey as keyof Dict] : undefined,
  })));

/** Trang không nằm trên menu nhưng vẫn là đích hay dùng (dropdown avatar). */
const extraPages: StaticSearchItem[] = [
  page('profile', (t) => t.navProfile, ICON.profile, BOTH),
  page('settings', (t) => t.navSettings, ICON.settings, BOTH),
  page('billing', (t) => t.blTitle, Receipt, APP),
];

/** Tab con: đi tới trang kèm `?tab=` (mỗi trang tự đọc tham số này). */
const tab = (id: string, route: Route, search: string, label: (t: Dict) => string, parent: (t: Dict) => string,
  icon: LucideIcon, areas: readonly SearchArea[], keywords: readonly string[]): StaticSearchItem => ({
  id: `section:${id}`, group: 'sections', label, desc: parent, icon, areas, keywords,
  target: { kind: 'route', route, search },
});

/** Khối trên một trang: cuộn tới phần tử `id={sectionId}` và tô sáng tạm thời. */
const block = (sectionId: string, route: Route, label: (t: Dict) => string, parent: (t: Dict) => string,
  icon: LucideIcon, keywords: readonly string[]): StaticSearchItem => ({
  id: `section:${sectionId}`, group: 'sections', label, desc: parent, icon, areas: APP, keywords,
  target: { kind: 'section', route, sectionId },
});

const dashboardName = (t: Dict) => t.navDashboard;
const settingsName = (t: Dict) => t.navSettings;
const trendsName = (t: Dict) => t.navTrends;
const failedName = (t: Dict) => t.navFailedPosts;
const brandName = (t: Dict) => t.navBrand;

const sections: StaticSearchItem[] = [
  // Bảng điều khiển — id phải khớp prop `id` gắn trên từng khối ở pages/app/Dashboard.tsx.
  block('dashboard-stats', 'dashboard', (t) => t.gsSecStats, dashboardName, ListChecks,
    ['thống kê', 'số bài', 'đã đăng', 'chờ duyệt', 'bị từ chối', 'stats', 'kpi', 'posted', 'pending']),
  block('dashboard-setup', 'dashboard', (t) => t.dbsTitle, dashboardName, Target,
    ['thiết lập', 'bắt đầu', 'hướng dẫn', 'onboarding', 'checklist', 'getting started']),
  block('dashboard-performance', 'dashboard', (t) => t.perfTitle, dashboardName, BarChart3,
    ['hiệu quả', 'tiếp cận', 'tương tác', 'biểu đồ', 'reach', 'engagement', 'performance', 'chart']),
  block('dashboard-platforms', 'dashboard', (t) => t.dbPlatformsTitle, dashboardName, Plug,
    ['nền tảng', 'kết nối', 'facebook', 'instagram', 'threads', 'platforms', 'connected']),
  block('dashboard-topics', 'dashboard', (t) => t.dbTopicsTitle, dashboardName, Hash,
    ['chủ đề', 'hashtag', 'topics', 'top']),
  block('dashboard-types', 'dashboard', (t) => t.dbTypesTitle, dashboardName, PieChart,
    ['loại nội dung', 'định dạng', 'video', 'hình ảnh', 'content type', 'format']),
  block('dashboard-activity', 'dashboard', (t) => t.dbActivityTitle, dashboardName, Activity,
    ['hoạt động', 'gần đây', 'lịch sử', 'activity', 'recent', 'timeline']),

  // Cài đặt — tab qua ?tab= (/settings/usage là route riêng của tab Token).
  tab('settings.appearance', 'settings', '', (t) => t.seTabAppearance, settingsName, Palette, BOTH,
    ['giao diện', 'màu', 'ngôn ngữ', 'chế độ tối', 'appearance', 'theme', 'language', 'dark mode']),
  tab('settings.usage', 'usage', '', (t) => t.navUsage, settingsName, Gauge, BOTH,
    ['token', 'hạn mức', 'mức dùng', 'usage', 'quota', 'limit']),
  tab('settings.publishing', 'settings', '?tab=publishing', (t) => t.seTabPublishing, settingsName, Send, BOTH,
    ['đăng bài', 'múi giờ', 'duyệt bài', 'giọng thương hiệu', 'publishing', 'timezone', 'approval', 'brand voice']),
  tab('settings.notifications', 'settings', '?tab=notifications', (t) => t.seTabNotif, settingsName, Bell, BOTH,
    ['thông báo', 'email', 'notifications', 'alerts']),
  tab('settings.connections', 'settings', '?tab=connections', (t) => t.seTabConnect, settingsName, Plug, APP,
    ['kết nối', 'tài khoản mạng xã hội', 'facebook', 'instagram', 'threads', 'connections', 'social accounts']),

  // Xu hướng / Bài lỗi / Thương hiệu — tab qua ?tab= (hooks/useTabParam).
  tab('trends.hot', 'trends', '', (t) => t.trTabHot, trendsName, Flame, APP, ['trend nổi bật', 'hot', 'top trends']),
  tab('trends.ideas', 'trends', '?tab=ideas', (t) => t.trTabIdeas, trendsName, Lightbulb, APP,
    ['ý tưởng', 'gợi ý nội dung', 'ideas', 'content ideas']),
  tab('trends.history', 'trends', '?tab=history', (t) => t.trTabHistory, trendsName, History, APP,
    ['lịch sử research', 'phiên nghiên cứu', 'research history', 'sessions']),
  tab('failed.needsAction', 'failedPosts', '', (t) => t.fpTabNeedsAction, failedName, AlertTriangle, APP,
    ['cần xử lý', 'needs action', 'lỗi']),
  tab('failed.retrying', 'failedPosts', '?tab=AUTO_RETRYING', (t) => t.fpTabAutoRetrying, failedName, Clock, APP,
    ['đang thử lại', 'tự thử lại', 'retrying', 'auto retry']),
  tab('failed.dismissed', 'failedPosts', '?tab=DISMISSED', (t) => t.fpTabDismissed, failedName, XCircle, APP,
    ['đã bỏ qua', 'dismissed', 'ignored']),
  tab('brand.profiles', 'brand', '', (t) => t.bpTabBrand, brandName, Star, APP,
    ['hồ sơ thương hiệu', 'brand profile', 'thương hiệu']),
  tab('brand.strategies', 'brand', '?tab=strategy', (t) => t.bpTabStrategy, brandName, Layers, APP,
    ['chiến lược', 'chiến dịch', 'kế hoạch nội dung', 'strategy', 'campaign', 'content plan']),

  // Quản trị
  {
    ...tab('admin.revenue.orders', 'adminRevenue', '?tab=orders', (t) => t.revTabOrders, (t) => t.navAdminRevenue,
      Receipt, ADMIN, ['đơn hàng', 'đơn chờ', 'đối soát', 'orders', 'reconcile', 'payos']),
    roles: ['ADMIN'],
  },
];

const darkMode = (ctx: { darkModeEnabled: boolean }) => ctx.darkModeEnabled;

const actions: StaticSearchItem[] = [
  { id: 'action:createContent', group: 'actions', label: (t) => t.createNew, icon: Sparkles, areas: APP,
    keywords: ['tạo bài', 'viết bài', 'bài mới', 'ai viết', 'new post', 'create', 'write'],
    target: { kind: 'action', action: 'createContent' } },
  { id: 'action:newStrategy', group: 'actions', label: (t) => t.gsActNewStrategy, icon: Layers, areas: APP,
    keywords: ['chiến lược mới', 'tạo chiến lược', 'chiến dịch mới', 'new strategy', 'campaign'],
    target: { kind: 'action', action: 'newStrategy' } },
  { id: 'action:researchNow', group: 'actions', label: (t) => t.trResearchNow, icon: SearchIcon, areas: APP,
    keywords: ['nghiên cứu xu hướng', 'tìm trend', 'research', 'trend research'],
    target: { kind: 'action', action: 'researchNow' } },
  { id: 'action:connectFacebook', group: 'actions', label: (t) => t.gsActConnect.replace('{platform}', 'Facebook'),
    icon: Plug, areas: APP, keywords: ['fb', 'fanpage', 'trang facebook', 'connect facebook'],
    target: { kind: 'action', action: 'connectFacebook' } },
  { id: 'action:connectInstagram', group: 'actions', label: (t) => t.gsActConnect.replace('{platform}', 'Instagram'),
    icon: Plug, areas: APP, keywords: ['ig', 'insta', 'connect instagram'],
    target: { kind: 'action', action: 'connectInstagram' } },
  { id: 'action:connectThreads', group: 'actions', label: (t) => t.gsActConnect.replace('{platform}', 'Threads'),
    icon: Plug, areas: APP, keywords: ['threads', 'connect threads'],
    target: { kind: 'action', action: 'connectThreads' } },
  { id: 'action:toggleLang', group: 'actions', label: (t) => t.gsActLang, icon: Globe, areas: BOTH,
    keywords: ['ngôn ngữ', 'tiếng việt', 'tiếng anh', 'language', 'english', 'vietnamese'],
    target: { kind: 'action', action: 'toggleLang' } },
  { id: 'action:colorLight', group: 'actions', label: (t) => t.gsActLight, icon: Sun, areas: BOTH, available: darkMode,
    keywords: ['giao diện sáng', 'chế độ sáng', 'light mode', 'light theme'], target: { kind: 'action', action: 'colorLight' } },
  { id: 'action:colorDark', group: 'actions', label: (t) => t.gsActDark, icon: Moon, areas: BOTH, available: darkMode,
    keywords: ['giao diện tối', 'chế độ tối', 'ban đêm', 'dark mode', 'dark theme', 'night'], target: { kind: 'action', action: 'colorDark' } },
  { id: 'action:colorSystem', group: 'actions', label: (t) => t.gsActSystem, icon: Monitor, areas: BOTH, available: darkMode,
    keywords: ['theo hệ thống', 'tự động', 'system theme', 'auto'], target: { kind: 'action', action: 'colorSystem' } },
  { id: 'action:openNotifications', group: 'actions', label: (t) => t.gsActNotif, icon: Bell, areas: BOTH,
    keywords: ['thông báo', 'chuông', 'notifications', 'bell', 'inbox'], target: { kind: 'action', action: 'openNotifications' } },
  { id: 'action:logout', group: 'actions', label: (t) => t.signOut, icon: LogOut, areas: BOTH,
    keywords: ['đăng xuất', 'thoát', 'logout', 'sign out', 'log out'], target: { kind: 'action', action: 'logout' } },
];

export const SEARCH_REGISTRY: readonly StaticSearchItem[] = [
  ...appPages, ...extraPages, ...adminPages, ...sections, ...actions,
];

export const REGISTRY_BY_ID: ReadonlyMap<string, StaticSearchItem> = new Map(SEARCH_REGISTRY.map((it) => [it.id, it]));

/** Icon của các nhóm dữ liệu (kết quả API + mục dữ liệu trong lịch sử). */
export const DATA_ICONS = { content: Sparkles, strategy: Layers, schedule: ICON.calendar } as const;
