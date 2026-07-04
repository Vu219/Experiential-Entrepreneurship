import { create } from "zustand";
import type { Lang, ThemeKey, ProfileState, BrandState } from "../types";
import { brandDefaults, bioDefault } from "../data";

// State thuần của app (trước đây nằm trong AppContext) → chuyển sang Zustand.
// KHÔNG đụng tới điều hướng (React Router) và auth: phần đó vẫn nằm trong hook
// useApp() vì cần các hook useNavigate/useLocation/useAuth.
// "Hồ sơ đang dùng" (active) làm nền cho Agent AI. Chưa có ở backend → giữ ở FE
// (localStorage, key ACTIVE_BRAND_KEY) cho tới khi BE bổ sung cờ active.
// Chỉ MỘT hồ sơ active tại một thời điểm.
const ACTIVE_BRAND_KEY = "aima.activeBrandId";
const readActiveBrand = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_BRAND_KEY);
  } catch {
    return null;
  }
};

// Theme (bảng màu thương hiệu) được người dùng chọn ở Cài đặt > Giao diện.
// Nguồn chân lý = localStorage (key "aima-theme"), default "ocean". Áp bằng cách gắn
// data-theme lên <html> → mọi var(--brand-*/--theme-surface-*) đổi theo (tokens.css).
// FOUC được chặn bằng inline script ở index.html (áp trước paint); ở đây đồng bộ store.
const THEME_KEY = "aima-theme";
const ALLOWED_THEMES: ThemeKey[] = ["ocean", "aurora", "sunset"];
const readTheme = (): ThemeKey => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t && (ALLOWED_THEMES as string[]).includes(t) ? (t as ThemeKey) : "ocean";
  } catch {
    return "ocean";
  }
};
const applyTheme = (k: ThemeKey): void => {
  try {
    localStorage.setItem(THEME_KEY, k);
  } catch {
    /* ignore persistence errors */
  }
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", k);
  }
};

interface AppStoreState {
  lang: Lang;
  theme: ThemeKey;
  profile: ProfileState;
  brand: BrandState;
  notif: boolean[];
  activeBrandId: string | null;

  setLang: (l: Lang) => void;
  toggleLang: () => void;
  setTheme: (k: ThemeKey) => void;
  setProfile: (patch: Partial<ProfileState>) => void;
  setBrand: (patch: Partial<BrandState>) => void;
  toggleBrandTone: (i: number) => void;
  toggleNotif: (i: number) => void;
  setActiveBrand: (id: string) => void;
  // Đồng bộ tên/email hiển thị theo user đã đăng nhập (gọi từ AppProvider).
  syncUser: (fullName?: string, email?: string) => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  lang: "vi",
  theme: readTheme(),
  profile: { name: "AIMA User", email: "contact@aima.studio", bio: bioDefault("vi") },
  brand: { ...brandDefaults("vi"), toneIdx: [0, 1, 3] },
  notif: [true, true, true, false],
  activeBrandId: readActiveBrand(),

  setLang: (l) => set({ lang: l }),
  toggleLang: () => set((s) => ({ lang: s.lang === "vi" ? "en" : "vi" })),
  setTheme: (k) => {
    applyTheme(k); // đổi ngay (đồng bộ, trước re-render) + lưu localStorage → không nhấp nháy
    set({ theme: k });
  },
  setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  setBrand: (patch) => set((s) => ({ brand: { ...s.brand, ...patch } })),
  toggleBrandTone: (i) =>
    set((s) => ({
      brand: {
        ...s.brand,
        toneIdx: s.brand.toneIdx.includes(i)
          ? s.brand.toneIdx.filter((x) => x !== i)
          : [...s.brand.toneIdx, i],
      },
    })),
  toggleNotif: (i) => set((s) => ({ notif: s.notif.map((v, idx) => (idx === i ? !v : v)) })),
  setActiveBrand: (id) => {
    try {
      localStorage.setItem(ACTIVE_BRAND_KEY, id);
    } catch {
      /* ignore persistence errors */
    }
    set({ activeBrandId: id });
  },
  syncUser: (fullName, email) =>
    set((s) => ({
      profile: { ...s.profile, name: fullName || s.profile.name, email: email || s.profile.email },
    })),
}));
