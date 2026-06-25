import { useCallback, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Route } from '../types';
import { THEMES } from '../theme';
import { getDict } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { useAppStore } from '../store/useAppStore';

// State của app sống trong Zustand (useAppStore). File này giữ nguyên API công khai
// `useApp()` + `AppProvider` để 19 component tiêu thụ không phải đổi import. Phần
// điều hướng (route/go) và auth (authed/login/logout) vẫn nằm ở hook vì cần
// useNavigate/useLocation/useAuth — những thứ không bỏ vào store thuần được.
const PATH_BY_ROUTE: Record<Route, string> = {
  landing: '/',
  login: '/login',
  register: '/register',
  logout: '/logout',
  dashboard: '/dashboard',
  create: '/create',
  calendar: '/calendar',
  analytics: '/analytics',
  trends: '/trends',
  brand: '/brand',
  profile: '/profile',
  settings: '/settings',
  admin: '/admin',
  adminUsers: '/admin/users',
  adminPosts: '/admin/posts',
  adminSystem: '/admin/system',
  adminLogs: '/admin/logs',
  adminApiVersions: '/admin/api-versions',
  adminRevenue: '/admin/revenue',
};
const ROUTE_BY_PATH = Object.fromEntries(
  Object.entries(PATH_BY_ROUTE).map(([r, p]) => [p, r as Route])
) as Record<string, Route>;

// Chỉ còn nhiệm vụ đồng bộ profile hiển thị theo user đã đăng nhập (effect chạy
// một lần ở gốc cây). Không còn Context Provider nào ở đây.
export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const syncUser = useAppStore((s) => s.syncUser);

  useEffect(() => {
    if (user) syncUser(user.fullName, user.email);
  }, [user, syncUser]);

  return <>{children}</>;
}

export function useApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout: authLogout } = useAuth();

  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const brand = useAppStore((s) => s.brand);
  const notif = useAppStore((s) => s.notif);
  const setLang = useAppStore((s) => s.setLang);
  const toggleLang = useAppStore((s) => s.toggleLang);
  const setTheme = useAppStore((s) => s.setTheme);
  const setProfile = useAppStore((s) => s.setProfile);
  const setBrand = useAppStore((s) => s.setBrand);
  const toggleBrandTone = useAppStore((s) => s.toggleBrandTone);
  const toggleNotif = useAppStore((s) => s.toggleNotif);
  const activeBrandId = useAppStore((s) => s.activeBrandId);
  const setActiveBrand = useAppStore((s) => s.setActiveBrand);

  const route = ROUTE_BY_PATH[location.pathname] ?? 'dashboard';

  const go = useCallback(
    (r: Route) => {
      navigate(PATH_BY_ROUTE[r]);
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    },
    [navigate]
  );

  return {
    lang,
    setLang,
    toggleLang,
    t: getDict(lang),
    theme,
    setTheme,
    brandGradient: THEMES[theme].brand,
    route,
    go,
    authed: !!user,
    login: () => go('dashboard'),
    logout: () => {
      authLogout().finally(() => go('logout'));
    },
    profile,
    setProfile,
    brand,
    setBrand,
    toggleBrandTone,
    notif,
    toggleNotif,
    activeBrandId,
    setActiveBrand,
  };
}
