import type { LucideIcon } from 'lucide-react';
import type { Dict } from '../i18n.ts';
import type { UserRole } from '../api/admin.ts';
import type { Route } from '../types.ts';
import type { Range } from './match.ts';

// Kiểu dữ liệu của ô tìm kiếm toàn cục (Command Palette). Chỉ khai báo kiểu — import được trong test node.

/** Nhóm hiển thị, theo đúng thứ tự trong palette. */
export type SearchGroup = 'pages' | 'sections' | 'actions' | 'content' | 'strategies' | 'schedules';

/** Khu vực giao diện: palette ở khu quản trị chỉ có trang + hành động quản trị. */
export type SearchArea = 'app' | 'admin';

/** Hành động nhanh — thực thi bởi hooks/useSearchActions (cần hook React nên không nằm trong registry). */
export type ActionId =
  | 'createContent'
  | 'newStrategy'
  | 'researchNow'
  | 'connectFacebook'
  | 'connectInstagram'
  | 'connectThreads'
  | 'toggleLang'
  | 'colorLight'
  | 'colorDark'
  | 'colorSystem'
  | 'openNotifications'
  | 'logout';

export type SearchTarget =
  /** Đi tới trang (qua `go(route, search)` của useApp — giữ đúng hành vi highlight sidebar), vd `?tab=connections`. */
  | { kind: 'route'; route: Route; search?: string }
  /** Đi tới trang rồi cuộn + tô sáng phần tử `id={sectionId}` (qua `?focus=`, xem hooks/useSectionFocus). */
  | { kind: 'section'; route: Route; sectionId: string }
  | { kind: 'action'; action: ActionId };

/** Ngữ cảnh lọc mục tĩnh. */
export interface SearchContext {
  role: UserRole | undefined;
  area: SearchArea;
  darkModeEnabled: boolean;
}

/** Mục TĨNH (trang / khu vực / hành động) — khai báo một lần ở search/registry.ts. */
export interface StaticSearchItem {
  /** Khóa bền vững (lưu vào lịch sử): `page:calendar`, `section:dashboard.performance`, `action:createContent`. */
  id: string;
  group: 'pages' | 'sections' | 'actions';
  /** Nhãn theo ngôn ngữ đang bật. */
  label: (t: Dict) => string;
  /** Dòng phụ (vd tên trang cha của một tab/khu vực). */
  desc?: (t: Dict) => string;
  /** Từ đồng nghĩa vi + en (khớp không dấu) — KHÔNG hiển thị, nên không đi qua i18n. */
  keywords?: readonly string[];
  icon: LucideIcon;
  areas: readonly SearchArea[];
  /** Thiếu = mọi user đã đăng nhập. */
  roles?: readonly UserRole[];
  /** Điều kiện hiện thêm (vd chế độ tối đang bật cờ). */
  available?: (ctx: SearchContext) => boolean;
  target: SearchTarget;
}

/** Một dòng kết quả đã dịch + chấm điểm, sẵn sàng hiển thị. */
export interface RankedItem<T> {
  item: T;
  label: string;
  desc?: string;
  score: number;
  ranges: Range[];
}
