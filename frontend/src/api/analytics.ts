import client, { type ApiResponse, type PageResponse } from "./apiClient";
import type { Platform } from "./brandProfile";
import type { ConnectionStatus } from "./connections";

// Số liệu bài đã đăng (FR-59..FR-62) — backend PostAnalyticsController (/analytics).
// Mỗi bài kèm snapshot các mốc 24h/48h/7 ngày; CTR/conversion/watch time = null trong MVP.

export interface AnalyticsSnapshot {
  id: string;
  /** 24, 48 hoặc 168 (7 ngày). */
  milestoneHours: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  ctr: number | null;
  conversion: number | null;
  watchTime: number | null;
  collectedAt: string;
}

export interface AnalyzedPost {
  id: string;
  platformName: Platform;
  platformPostId: string | null;
  accountName: string | null;
  contentItemId: string | null;
  formattedCaption: string | null;
  publishedAt: string;
  /** Sắp theo mốc tăng dần (24h → 48h → 7d). */
  analytics: AnalyticsSnapshot[];
}

// GET /analytics/posts — bài POSTED mới nhất trước, phân trang server-side.
export async function listAnalyzedPosts(params: { page?: number; size?: number } = {}): Promise<PageResponse<AnalyzedPost>> {
  const { data } = await client.get<ApiResponse<PageResponse<AnalyzedPost>>>("/analytics/posts", { params });
  return data.result;
}

// GET /analytics/posts/{postId}
export async function getAnalyzedPost(postId: string): Promise<AnalyzedPost> {
  const { data } = await client.get<ApiResponse<AnalyzedPost>>(`/analytics/posts/${postId}`);
  return data.result;
}

// ============================================================================
// Trang Phân tích tổng hợp (UI-08) — backend AnalyticsController (/analytics/*).
// Bộ lọc dùng chung: from/to (yyyy-MM-dd, mặc định 7 ngày gần nhất) + platforms
// (bỏ trống = mọi nền tảng) + contentTypes (bỏ trống = mọi loại nội dung) + source (aima = chỉ bài
// đăng qua AIMA; bỏ trống = toàn bộ bài của Trang, kể cả bài tự đăng — giai đoạn 2). Chỉ
// FB/IG/Threads trong scope. So sánh luôn theo kỳ liền trước cùng độ dài;
// deltaPct = null khi kỳ trước bằng 0.
//
// HAI NGOẠI LỆ BỘ LỌC (cố ý, backend quy định): /by-platform KHÔNG nhận platforms
// và /by-content-type KHÔNG nhận contentTypes — mỗi donut bỏ qua đúng chiều của
// chính nó, nếu không donut chỉ còn một lát 100%. FE phải ghi chú rõ trên 2 card.
// ============================================================================

/** Nhãn loại nội dung dùng cho bộ lọc (IN HOA, khớp media_format chuẩn hoá của backend). */
export type ContentTypeLabel = 'IMAGE' | 'VIDEO' | 'TEXT' | 'OTHER';
export const CONTENT_TYPES: ContentTypeLabel[] = ['IMAGE', 'VIDEO', 'TEXT', 'OTHER'];

/** Một thẻ KPI: tổng trong kỳ + % thay đổi so kỳ trước + chuỗi/ngày để vẽ sparkline. */
export interface AnalyticsStat {
  total: number;
  /** null = kỳ trước bằng 0, không có mốc so sánh (hiển thị "—"). */
  deltaPct: number | null;
  /** Giá trị mỗi ngày trong kỳ, cũ → mới. */
  series: number[];
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  rangeDays: number;
  /** Khoảng kỳ so sánh (kỳ liền trước cùng độ dài). */
  compareFrom: string;
  compareTo: string;
  views: AnalyticsStat;
  likes: AnalyticsStat;
  comments: AnalyticsStat;
  shares: AnalyticsStat;
}

/** Một điểm của biểu đồ đa series (khối C) — đã zero-fill mọi ngày trong kỳ. */
export interface AnalyticsPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** Số của ngày có phần ƯỚC TÍNH (chia đều từ ngày đăng đến lần đồng bộ đầu tiên khi bài được theo dõi muộn). */
  estimated?: boolean;
}

export interface AnalyticsTimeseries {
  from: string;
  to: string;
  rangeDays: number;
  points: AnalyticsPoint[];
}

/** Hiệu suất một nền tảng (khối D). Luôn đủ 3 nền tảng, kể cả chưa kết nối. */
export interface AnalyticsPlatform {
  platform: Platform;
  /** false → FE hiển thị CTA "Kết nối ngay". */
  connected: boolean;
  accountName: string | null;
  avatarUrl: string | null;
  status: ConnectionStatus | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  /** Tỷ trọng tương tác của nền tảng trên tổng (%). */
  sharePct: number;
}

/** Nguồn bài: đăng qua AIMA hay người dùng tự đăng trên nền tảng (import từ giai đoạn 2). */
export type MediaOrigin = 'AIMA' | 'EXTERNAL';
/** Bài còn trên nền tảng không — DELETED vẫn giữ số liệu đã thu. */
export type PlatformMediaStatus = 'ACTIVE' | 'UNAVAILABLE' | 'DELETED';

/** Một dòng bảng "Top bài viết hiệu quả" (khối E). MVP không có thumbnail. */
export interface AnalyticsTopPost {
  /** Id dòng theo dõi số liệu — luôn có, dùng làm khoá dòng. */
  mediaId: string;
  /** null với bài đăng ngoài AIMA. */
  postId: string | null;
  contentItemId: string | null;
  platform: Platform;
  caption: string | null;
  accountName: string | null;
  publishedAt: string;
  /** null = KHÔNG có số liệu lượt xem (khác 0) — hiện "—". */
  views: number | null;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  /** true = số liệu duy nhất là bản chép từ mốc cũ (bài đăng trước khi có đồng bộ đầy đủ). */
  legacyOnly: boolean;
  origin: MediaOrigin;
  /** Đường dẫn bài trên nền tảng; null khi chưa quét được. */
  permalink: string | null;
  platformStatus: PlatformMediaStatus;
}

/** Cột sắp xếp hợp lệ của bảng Top bài viết (whitelist, khớp backend). */
export type TopPostSortField = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'date';
export interface TopPostSort {
  field: TopPostSortField;
  asc: boolean;
}

/** Một lát donut "Hiệu suất theo loại nội dung" (khối F). Chỉ loại CÓ bài mới được trả về. */
export interface AnalyticsContentType {
  /** Nhãn IN HOA: IMAGE/VIDEO/TEXT/OTHER (OTHER = bản chưa định dạng). */
  label: string;
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  sharePct: number;
}

/** Một ô heatmap (khối G) — chỉ ô CÓ bài; ô vắng mặt = chưa từng đăng khung đó. */
export interface AnalyticsHeatmapCell {
  /** 1 = Thứ 2 … 7 = Chủ nhật (ISO). */
  dow: number;
  /** 0 = 00:00–02:59 … 7 = 21:00–23:59. */
  slot: number;
  hourStart: number;
  posts: number;
  engagement: number;
  /** Tương tác TB mỗi bài — giá trị tô màu (KHÔNG dùng tổng). */
  avgEngagement: number;
  /** posts < minPostsForScale → mẫu nhỏ, FE đánh dấu "chưa đủ dữ liệu". */
  lowSample: boolean;
}

export interface AnalyticsHeatmap {
  from: string;
  to: string;
  cells: AnalyticsHeatmapCell[];
  /** null khi chưa ô nào đủ mẫu → thang màu chưa đáng tin. */
  max: number | null;
  min: number | null;
  minPostsForScale: number;
  scaledCells: number;
}

/** Ô "Khung giờ vàng" — null khi chưa ô heatmap nào đủ mẫu (không được bịa khung giờ). */
export interface AnalyticsGoldenHour {
  dow: number;
  slot: number;
  hourStart: number;
  hourEnd: number;
  posts: number;
  avgEngagement: number;
}

/** Dải "Thông tin chi tiết" (khối H) — 5 ô kèm delta so kỳ liền trước. */
export interface AnalyticsInsights {
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
  totalPosts: number;
  totalPostsDeltaPct: number | null;
  /** Bài có tương tác TRÊN mức trung bình của chính kỳ này (ngưỡng động). */
  goodPosts: number;
  goodPostsDeltaPct: number | null;
  avgEngagementPerPost: number;
  /** Bài ĐĂNG THẤT BẠI trong kỳ — điều hướng sang trang "Bài lỗi & cần xử lý". */
  needsAttentionPosts: number;
  needsAttentionDeltaPct: number | null;
  goldenHour: AnalyticsGoldenHour | null;
  /** Tương tác / lượt xem, CHỈ trên bài có lượt xem; null = không bài nào có lượt xem. */
  engagementRatePct: number | null;
  engagementRateDeltaPct: number | null;
  ratedPosts: number;
  /** Bài bị loại khỏi mẫu số vì nền tảng không trả lượt xem (chủ yếu Facebook). */
  excludedPosts: number;
  /** Người theo dõi MỚI trong kỳ (cấp Trang); null = nền tảng chưa trả số theo ngày (khác 0). */
  newFollowers: number | null;
  newFollowersDeltaPct: number | null;
  /** Tổng người theo dõi hiện tại; null khi chưa có. */
  followersTotal: number | null;
}

// platforms / contentTypes → CSV; Spring bind chuỗi "FACEBOOK,THREADS" thành List. Rỗng = bỏ tham số.
const csvParam = (values?: string[]): string | undefined =>
  values && values.length > 0 ? values.join(',') : undefined;

const sortParamOf = (sort?: TopPostSort): string | undefined =>
  sort ? `${sort.field},${sort.asc ? 'asc' : 'desc'}` : undefined;

/** Bộ lọc dùng chung của cả trang — một nguồn duy nhất, mọi khối đọc từ đây. */
export interface AnalyticsFilter {
  from: string;
  to: string;
  platforms: Platform[];
  contentTypes: ContentTypeLabel[];
  /** true = chỉ bài đăng qua AIMA; false (mặc định) = toàn bộ bài của Trang, kể cả bài tự đăng. */
  aimaOnly: boolean;
}

// Bộ lọc nguồn bài → query param `source` (backend: aima | bỏ trống = toàn Trang).
const sourceParam = (f: AnalyticsFilter): string | undefined => (f.aimaOnly ? 'aima' : undefined);

// GET /analytics/summary — 4 KPI + so sánh kỳ trước (khối B).
export async function getAnalyticsSummary(f: AnalyticsFilter): Promise<AnalyticsSummary> {
  const { data } = await client.get<ApiResponse<AnalyticsSummary>>("/analytics/summary", {
    params: { from: f.from, to: f.to, platforms: csvParam(f.platforms), contentTypes: csvParam(f.contentTypes), source: sourceParam(f) },
  });
  return data.result;
}

// GET /analytics/timeseries — chuỗi 4 metric theo ngày, đã zero-fill (khối C).
export async function getAnalyticsTimeseries(f: AnalyticsFilter): Promise<AnalyticsTimeseries> {
  const { data } = await client.get<ApiResponse<AnalyticsTimeseries>>("/analytics/timeseries", {
    params: { from: f.from, to: f.to, platforms: csvParam(f.platforms), contentTypes: csvParam(f.contentTypes), source: sourceParam(f) },
  });
  return data.result;
}

// GET /analytics/by-platform — donut + danh sách nền tảng (khối D). KHÔNG nhận platforms (ngoại lệ 1).
export async function getAnalyticsByPlatform(f: AnalyticsFilter): Promise<AnalyticsPlatform[]> {
  const { data } = await client.get<ApiResponse<AnalyticsPlatform[]>>("/analytics/by-platform", {
    params: { from: f.from, to: f.to, contentTypes: csvParam(f.contentTypes), source: sourceParam(f) },
  });
  return data.result;
}

// GET /analytics/by-content-type — donut loại nội dung (khối F). KHÔNG nhận contentTypes (ngoại lệ 2).
export async function getAnalyticsByContentType(f: AnalyticsFilter): Promise<AnalyticsContentType[]> {
  const { data } = await client.get<ApiResponse<AnalyticsContentType[]>>("/analytics/by-content-type", {
    params: { from: f.from, to: f.to, platforms: csvParam(f.platforms), source: sourceParam(f) },
  });
  return data.result;
}

// GET /analytics/activity-heatmap — lưới 7 thứ × 8 khung 3 giờ (khối G).
export async function getAnalyticsHeatmap(f: AnalyticsFilter): Promise<AnalyticsHeatmap> {
  const { data } = await client.get<ApiResponse<AnalyticsHeatmap>>("/analytics/activity-heatmap", {
    params: { from: f.from, to: f.to, platforms: csvParam(f.platforms), contentTypes: csvParam(f.contentTypes), source: sourceParam(f) },
  });
  return data.result;
}

// GET /analytics/insights — dải "Thông tin chi tiết" (khối H).
export async function getAnalyticsInsights(f: AnalyticsFilter): Promise<AnalyticsInsights> {
  const { data } = await client.get<ApiResponse<AnalyticsInsights>>("/analytics/insights", {
    params: { from: f.from, to: f.to, platforms: csvParam(f.platforms), contentTypes: csvParam(f.contentTypes), source: sourceParam(f) },
  });
  return data.result;
}

// GET /analytics/export — CSV dạng CHUỖI trong result (FE tự tạo Blob, cùng quy ước trang Doanh thu).
// Vượt trần 50.000 dòng → backend ném mã 2053, FE hiện hướng dẫn thu hẹp khoảng ngày.
export async function exportAnalyticsCsv(f: AnalyticsFilter, sort?: TopPostSort): Promise<string> {
  const { data } = await client.get<ApiResponse<string>>("/analytics/export", {
    params: {
      from: f.from, to: f.to, platforms: csvParam(f.platforms), contentTypes: csvParam(f.contentTypes),
      source: sourceParam(f), sort: sortParamOf(sort),
    },
  });
  return data.result;
}

// GET /analytics/top-posts — bảng Top bài viết, sắp theo cột (khối E).
export async function getAnalyticsTopPosts(f: AnalyticsFilter, sort?: TopPostSort, limit = 10): Promise<AnalyticsTopPost[]> {
  const { data } = await client.get<ApiResponse<AnalyticsTopPost[]>>("/analytics/top-posts", {
    params: {
      from: f.from, to: f.to, platforms: csvParam(f.platforms), contentTypes: csvParam(f.contentTypes),
      source: sourceParam(f), sort: sortParamOf(sort), limit,
    },
  });
  return data.result;
}

// ---- Đồng bộ số liệu thật từ nền tảng (analytics giai đoạn 1) ----

/** Trạng thái đồng bộ của MỘT kênh đăng (Page / IG Business / Threads). */
export interface AnalyticsSyncAccount {
  accountId: string;
  platform: Platform;
  accountName: string;
  avatarUrl: string | null;
  status: ConnectionStatus | null;
  /** Facebook: token có quyền read_insights (đọc lượt xem); nền tảng khác null. */
  insightsPermission: boolean | null;
  trackedPosts: number;
  /** Bài chưa đồng bộ lần nào (đang chờ lượt quét đầu tiên, ≤ 5 phút). */
  pendingPosts: number;
  stoppedPosts: number;
  permissionErrors: number;
  lastSyncedAt: string | null;
  /** Lần quét kênh gần nhất (bài tự đăng trên Trang + insights); null khi chưa quét. */
  accountSyncedAt?: string | null;
}

export interface AnalyticsSyncStatus {
  /** false = chưa có kênh đăng nào ACTIVE → trang hiện "Dữ liệu mẫu". */
  connected: boolean;
  accounts: AnalyticsSyncAccount[];
}

// GET /analytics/sync-status
export async function getAnalyticsSyncStatus(): Promise<AnalyticsSyncStatus> {
  const { data } = await client.get<ApiResponse<AnalyticsSyncStatus>>("/analytics/sync-status");
  return data.result;
}

// POST /analytics/sync — nút "Làm mới": xếp lịch đồng bộ ngay (job nền ≤ 5 phút). Trả số bài được xếp lịch.
export async function requestAnalyticsSync(): Promise<number> {
  const { data } = await client.post<ApiResponse<number>>("/analytics/sync");
  return data.result;
}

// POST /analytics/dev-seed — DEV-ONLY: sinh số liệu MẪU cho user hiện tại (dựng/demo UI).
// Gated cờ backend aima.dev.analytics-seed-enabled; trả số bài đã seed.
export async function devSeedAnalytics(): Promise<number> {
  const { data } = await client.post<ApiResponse<number>>("/analytics/dev-seed");
  return data.result;
}

// DELETE /analytics/dev-seed — DEV-ONLY: xoá sạch số liệu MẪU đã sinh.
export async function devSeedAnalyticsClear(): Promise<number> {
  const { data } = await client.delete<ApiResponse<number>>("/analytics/dev-seed");
  return data.result;
}
