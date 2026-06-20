import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Lang, ThemeKey, Route, ProfileState, BrandState } from '../types';
import { THEMES } from '../theme';
import { getDict, type Dict } from '../i18n';
import { brandDefaults, bioDefault } from '../data';
import { useAuth } from '../auth/AuthContext';

// The design ships with its own in-memory router (route + go). We bridge it to
// React Router so the real backend-driven URLs (OAuth callback, complete-profile,
// deep links) keep working, while design components keep calling go()/route.
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
};
const ROUTE_BY_PATH = Object.fromEntries(
  Object.entries(PATH_BY_ROUTE).map(([r, p]) => [p, r as Route])
) as Record<string, Route>;

interface AppContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: Dict;
  theme: ThemeKey;
  setTheme: (k: ThemeKey) => void;
  brandGradient: string;
  route: Route;
  go: (r: Route) => void;
  authed: boolean;
  login: () => void;
  logout: () => void;
  profile: ProfileState;
  setProfile: (patch: Partial<ProfileState>) => void;
  brand: BrandState;
  setBrand: (patch: Partial<BrandState>) => void;
  toggleBrandTone: (i: number) => void;
  notif: boolean[];
  toggleNotif: (i: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout: authLogout } = useAuth();

  const [lang, setLang] = useState<Lang>('vi');
  const [theme, setTheme] = useState<ThemeKey>('aurora');
  const [profile, setProfileState] = useState<ProfileState>(() => ({
    name: 'AIMA User',
    email: 'contact@aima.studio',
    bio: bioDefault('vi'),
  }));
  const [brand, setBrandState] = useState<BrandState>(() => ({
    ...brandDefaults('vi'),
    toneIdx: [0, 1, 3],
  }));
  const [notif, setNotif] = useState<boolean[]>([true, true, true, false]);

  // Keep the display profile in sync with the authenticated user.
  useEffect(() => {
    if (user) {
      setProfileState((p) => ({
        ...p,
        name: user.fullName || p.name,
        email: user.email || p.email,
      }));
    }
  }, [user]);

  const route = ROUTE_BY_PATH[location.pathname] ?? 'dashboard';

  const value = useMemo<AppContextValue>(() => {
    const go = (r: Route) => {
      navigate(PATH_BY_ROUTE[r]);
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    };
    return {
      lang,
      setLang,
      toggleLang: () => setLang((l) => (l === 'vi' ? 'en' : 'vi')),
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
      setProfile: (patch) => setProfileState((p) => ({ ...p, ...patch })),
      brand,
      setBrand: (patch) => setBrandState((b) => ({ ...b, ...patch })),
      toggleBrandTone: (i) =>
        setBrandState((b) => ({
          ...b,
          toneIdx: b.toneIdx.includes(i) ? b.toneIdx.filter((x) => x !== i) : [...b.toneIdx, i],
        })),
      notif,
      toggleNotif: (i) => setNotif((n) => n.map((v, idx) => (idx === i ? !v : v))),
    };
  }, [lang, theme, route, user, profile, brand, notif, navigate, authLogout]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
