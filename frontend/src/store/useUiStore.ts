import { create } from "zustand";
import type { Route } from "../types";

// UI-only global state (tách biệt hoàn toàn với AuthContext — auth vẫn do
// AuthProvider quản lý). Dùng cho landing header: trạng thái cuộn dùng chung
// và panel menu mobile, tránh mỗi component tự gắn listener riêng.
interface UiState {
  scrolled: boolean;
  setScrolled: (v: boolean) => void;
  mobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
  // Sidebar (desktop) thu gọn: `sidebarCollapsed` là trạng thái ghim thủ công
  // qua nút mũi tên; `autoCollapse` (bật từ Cài đặt) cho chế độ hover-to-expand.
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  autoCollapse: boolean;
  toggleAutoCollapse: () => void;
  // Route mà từ đó người dùng mở Hồ sơ/Cài đặt. Giữ để sidebar vẫn highlight
  // đúng khu vực gốc (vd đang ở Quản trị/Bảng điều khiển) thay vì nhảy về.
  profileOrigin: Route | null;
  setProfileOrigin: (r: Route | null) => void;
  // Heading động cho Topbar: trang chi tiết (vd /admin/usage/users/:id) set tên user
  // + dòng phụ sau khi tải dữ liệu; null = dùng PAGE_KEYS tĩnh. Trang phải tự clear
  // khi unmount để không rò sang trang khác.
  pageHeading: { title: string; sub?: string } | null;
  setPageHeading: (h: { title: string; sub?: string } | null) => void;
  // Tín hiệu "tạo chiến lược mới": nút nằm ở header trang (Brand) còn logic mở form
  // ở StrategyManager — tăng nonce để StrategyManager mở form tạo mới (không lift toàn bộ state).
  strategyCreateNonce: number;
  requestStrategyCreate: () => void;
  // Tab mở sẵn khi điều hướng tới /brand từ nơi khác (vd wizard Tạo nội dung →
  // "Chỉnh sửa hồ sơ/chiến lược"). Brand đọc 1 lần lúc mount rồi xóa.
  brandInitialTab: 'brand' | 'strategy' | null;
  setBrandInitialTab: (t: 'brand' | 'strategy' | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  scrolled: false,
  // No-op nếu giá trị không đổi → tránh re-render thừa.
  setScrolled: (v) => set((s) => (s.scrolled === v ? s : { scrolled: v })),
  mobileOpen: false,
  toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
  closeMobile: () => set({ mobileOpen: false }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set((s) => (s.sidebarCollapsed === v ? s : { sidebarCollapsed: v })),
  autoCollapse: false,
  toggleAutoCollapse: () => set((s) => ({ autoCollapse: !s.autoCollapse })),
  profileOrigin: null,
  setProfileOrigin: (r) => set((s) => (s.profileOrigin === r ? s : { profileOrigin: r })),
  pageHeading: null,
  setPageHeading: (h) => set({ pageHeading: h }),
  strategyCreateNonce: 0,
  requestStrategyCreate: () => set((s) => ({ strategyCreateNonce: s.strategyCreateNonce + 1 })),
  brandInitialTab: null,
  setBrandInitialTab: (t) => set((s) => (s.brandInitialTab === t ? s : { brandInitialTab: t })),
}));
