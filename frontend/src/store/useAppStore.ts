import { create } from "zustand";
import type { Lang, ThemeKey, ProfileState, BrandState } from "../types";
import { brandDefaults, bioDefault } from "../data";
import { ACTIVE_BRAND_KEY } from "../api/mockSeed";

// State thuần của app (trước đây nằm trong AppContext) → chuyển sang Zustand.
// KHÔNG đụng tới điều hướng (React Router) và auth: phần đó vẫn nằm trong hook
// useApp() vì cần các hook useNavigate/useLocation/useAuth.
// "Hồ sơ đang dùng" (active) làm nền cho Agent AI. Chưa có ở backend → giữ ở FE
// (localStorage, key ACTIVE_BRAND_KEY ở api/mockSeed) cho tới khi BE bổ sung cờ active.
// Chỉ MỘT hồ sơ active tại một thời điểm.
const readActiveBrand = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_BRAND_KEY);
  } catch {
    return null;
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
  theme: "ocean",
  profile: { name: "AIMA User", email: "contact@aima.studio", bio: bioDefault("vi") },
  brand: { ...brandDefaults("vi"), toneIdx: [0, 1, 3] },
  notif: [true, true, true, false],
  activeBrandId: readActiveBrand(),

  setLang: (l) => set({ lang: l }),
  toggleLang: () => set((s) => ({ lang: s.lang === "vi" ? "en" : "vi" })),
  setTheme: (k) => set({ theme: k }),
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
