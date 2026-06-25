// ⚠️ DỮ LIỆU MẪU (MOCK) — nguồn DUY NHẤT để xem giao diện offline, KHÔNG gọi backend.
// 👉 Sửa/thêm dữ liệu mẫu CHỈ ở file này. Cả Brand Profile lẫn Content Strategy đọc seed từ đây.
// Khi nối backend thật: gỡ phần mock trong api/brandProfile.ts + api/contentStrategy.ts
// (đã ghi TODO ở mỗi file) — file này có thể xoá luôn.
//
// Liên kết dữ liệu (qua brandId cố định):
//   bp_seed_1 (active, ~83%)  → 3 chiến lược: ACTIVE + PAUSED + DRAFT
//   bp_seed_2 (~50%)          → 1 chiến lược: ACTIVE
//   bp_seed_3 (~33%, "Cần bổ sung") → 0 chiến lược

import type { BrandProfile } from "./brandProfile";
import type { ContentStrategy } from "./contentStrategy";

// v2: bump khi thêm field logoUrl/brandKeywords/brandDos/brandDonts (shape mới).
export const BRAND_STORE_KEY = "aima.brandProfiles.v2";
// v2: bump để bỏ qua seed cũ (v1) có thể đã ghi với brandId không khớp các hồ sơ mẫu mới.
export const STRATEGY_STORE_KEY = "aima.contentStrategies.v2";
export const ACTIVE_BRAND_KEY = "aima.activeBrandId";

const iso = (d: string) => new Date(d).toISOString();

// ===== Brand profiles =====
export const SEED_BRANDS: BrandProfile[] = [
  {
    // Hồ sơ "đang dùng" (active = phần tử đầu) — độ hoàn thiện cao (5/6 ≈ 83%).
    id: "bp_seed_1",
    brandName: "AIMA Studio",
    industry: "Marketing & Công nghệ",
    description: null, // bỏ trống 1 trường → 83% (để vẫn thấy gợi ý "Cần bổ sung: Mô tả")
    brandVoice: "Chuyên nghiệp, Hiện đại",
    targetAudience: "Chủ doanh nghiệp nhỏ, Creator",
    contentGoal: null,
    platforms: ["FACEBOOK", "INSTAGRAM", "THREADS"],
    postingFrequency: "WEEKLY",
    preferredTimes: ["09:00-11:00", "19:00-22:00"],
    logoUrl: null, // placeholder chữ cái đầu (mock chưa có ảnh thật)
    brandKeywords: ["AI Marketing", "Content Automation", "Agent AI", "Social Media"],
    brandDos: ["Ngắn gọn", "Hiện đại", "Truyền cảm hứng"],
    brandDonts: ["Quá lan man", "Quá bán hàng", "Tiêu cực"],
    createdAt: iso("2026-05-12"),
    updatedAt: iso("2026-06-23"),
  },
  {
    // Chưa active (có nút "Chọn dùng") — độ hoàn thiện trung bình (3/6 = 50%).
    id: "bp_seed_2",
    brandName: "Cỏ Cây Coffee",
    industry: "Thực phẩm & Đồ uống",
    description: null,
    brandVoice: null,
    targetAudience: "Gen Z, Nhân viên văn phòng",
    contentGoal: null,
    platforms: [],
    postingFrequency: "WEEKLY",
    preferredTimes: [],
    logoUrl: null,
    brandKeywords: ["Cà phê đặc sản", "Local"],
    brandDos: ["Thân thiện", "Gần gũi"],
    brandDonts: ["Tiêu cực"],
    createdAt: iso("2026-04-02"),
    updatedAt: iso("2026-06-18"),
  },
  {
    // Độ hoàn thiện thấp (2/6 = 33%) — để thấy nhiều gợi ý "Cần bổ sung".
    id: "bp_seed_3",
    brandName: "Nhà Sách Minh Khai",
    industry: "Giáo dục",
    description: null,
    brandVoice: null,
    targetAudience: "",
    contentGoal: null,
    platforms: [],
    postingFrequency: "WEEKLY",
    preferredTimes: [],
    logoUrl: null,
    brandKeywords: [],
    brandDos: [],
    brandDonts: [],
    createdAt: iso("2026-06-10"),
    updatedAt: iso("2026-06-10"),
  },
];

// ===== Content strategies (gắn brandId của các hồ sơ trên) =====
export const SEED_STRATEGIES: ContentStrategy[] = [
  {
    id: "cs_seed_1",
    brandId: "bp_seed_1",
    name: "Tăng nhận diện thương hiệu",
    status: "ACTIVE",
    goals: ["Tăng nhận diện thương hiệu", "Xây dựng uy tín"],
    contentTypes: ["Bài viết giáo dục", "Video ngắn"],
    postsPerWeek: 3,
    platforms: ["FACEBOOK", "INSTAGRAM", "THREADS"],
    timeSlots: ["07:00-09:00", "11:00-13:00"],
    audiences: ["Gen Z", "Sinh viên"],
    styles: ["Trẻ trung", "Truyền cảm hứng"],
    ctas: ["Tìm hiểu ngay", "Theo dõi kênh"],
    createdAt: iso("2026-05-14"),
    updatedAt: iso("2026-06-22"),
  },
  {
    id: "cs_seed_2",
    brandId: "bp_seed_1",
    name: "Kéo traffic về website",
    status: "PAUSED",
    goals: ["Kéo traffic về website"],
    contentTypes: ["Bài viết giáo dục", "Hình ảnh"],
    postsPerWeek: 4,
    platforms: ["FACEBOOK", "INSTAGRAM"],
    timeSlots: ["09:00-11:00", "19:00-22:00"],
    audiences: ["Chủ doanh nghiệp nhỏ"],
    styles: ["Chuyên nghiệp"],
    ctas: ["Tìm hiểu ngay"],
    createdAt: iso("2026-05-20"),
    updatedAt: iso("2026-06-15"),
  },
  {
    id: "cs_seed_3",
    brandId: "bp_seed_1",
    name: "Chăm sóc khách hàng",
    status: "DRAFT",
    goals: ["Chăm sóc khách hàng"],
    contentTypes: ["Text/Status"],
    postsPerWeek: 2,
    platforms: ["FACEBOOK"],
    timeSlots: ["17:00-19:00"],
    audiences: ["Cha mẹ trẻ"],
    styles: ["Thân thiện"],
    ctas: ["Để lại bình luận"],
    createdAt: iso("2026-06-08"),
    updatedAt: iso("2026-06-08"),
  },
  {
    id: "cs_seed_4",
    brandId: "bp_seed_2",
    name: "Tăng đơn hàng mùa hè",
    status: "ACTIVE",
    goals: ["Tăng doanh số"],
    contentTypes: ["Hình ảnh", "Reels"],
    postsPerWeek: 5,
    platforms: ["INSTAGRAM", "THREADS"],
    timeSlots: ["11:00-13:00", "19:00-22:00"],
    audiences: ["Nhân viên văn phòng", "Gen Z"],
    styles: ["Hiện đại"],
    ctas: ["Mua ngay"],
    createdAt: iso("2026-06-01"),
    updatedAt: iso("2026-06-19"),
  },
];

// Seed CHỈ khi store chưa tồn tại (lần đầu). Nếu user xoá hết → key vẫn là "[]" nên không seed lại.
const writeIfAbsent = (key: string, value: unknown) => {
  if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
};
export const seedBrandsIfEmpty = () => writeIfAbsent(BRAND_STORE_KEY, SEED_BRANDS);
export const seedStrategiesIfEmpty = () => writeIfAbsent(STRATEGY_STORE_KEY, SEED_STRATEGIES);

/** Xoá & nạp lại toàn bộ dữ liệu mẫu (nút "Reset dữ liệu mẫu"). Gọi xong nên reload trang. */
export const resetMockData = () => {
  localStorage.setItem(BRAND_STORE_KEY, JSON.stringify(SEED_BRANDS));
  localStorage.setItem(STRATEGY_STORE_KEY, JSON.stringify(SEED_STRATEGIES));
  localStorage.setItem(ACTIVE_BRAND_KEY, SEED_BRANDS[0].id); // raw string (khớp useAppStore) — hồ sơ đầu = đang dùng
};
