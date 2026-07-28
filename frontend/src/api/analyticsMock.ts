import type { Platform } from './brandProfile';
import type {
  AnalyticsContentType, AnalyticsFilter, AnalyticsHeatmap, AnalyticsHeatmapCell, AnalyticsInsights, ContentTypeLabel,
  AnalyticsPlatform, AnalyticsPoint, AnalyticsStat, AnalyticsSummary,
  AnalyticsTimeseries, AnalyticsTopPost, TopPostSort,
} from './analytics';

/**
 * ⚠️ DỮ LIỆU MẪU (DEMO) — KHÔNG phải dữ liệu thật.
 *
 * Chỉ dùng để xem trước giao diện trang Phân tích khi CHƯA có số liệu thật / không muốn boot backend
 * (`.env` dev trỏ Postgres từ xa + scheduler đăng bài thật). Bật bằng cờ `VITE_USE_MOCK=true`; khi bật,
 * các hàm `getAnalytics*` trong `api/analytics.ts` trả về đây thay vì gọi backend. Sinh **tất định**
 * (không random) để render ổn định giữa các lần vẽ và tôn trọng bộ lọc (khoảng ngày / nền tảng / sort).
 * Không import ở bất kỳ luồng nghiệp vụ nào; production để cờ tắt.
 */

// ---- date helpers (local time) ----
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const shiftISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + days));
};
/** Danh sách ISO ngày từ from → to (đã bao gồm hai đầu). */
function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  // Chặn vòng lặp vô hạn nếu from > to (kẹp 400 ngày).
  for (let i = 0; i < 400 && cur <= to; i++) {
    out.push(cur);
    cur = shiftISO(cur, 1);
  }
  return out;
}

/** Hàm băm tất định chuỗi → [0,1) để sinh số ổn định (thay cho Math.random). */
function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// Trọng số đóng góp mỗi nền tảng / loại nội dung — dùng để scale số liệu khi lọc.
const WEIGHT: Record<Platform, number> = { FACEBOOK: 0.5, INSTAGRAM: 0.35, THREADS: 0.15 };
const TYPE_WEIGHT: Record<string, number> = { IMAGE: 0.46, VIDEO: 0.28, TEXT: 0.2, OTHER: 0.06 };
const factorOf = (platforms?: Platform[]) =>
  platforms && platforms.length > 0 ? platforms.reduce((s, p) => s + (WEIGHT[p] ?? 0), 0) : 1;
const typeFactorOf = (types?: string[]) =>
  types && types.length > 0 ? types.reduce((s, ty) => s + (TYPE_WEIGHT[ty] ?? 0), 0) : 1;

const defFrom = () => shiftISO(todayISO(), -6);

/** Bộ lọc mặc định khi gọi mock trực tiếp (chưa có filter từ trang). */
const defFilter = (): AnalyticsFilter => ({ from: defFrom(), to: todayISO(), platforms: [], contentTypes: [] });

/** Số liệu 4 metric theo từng ngày — sóng mượt + xu hướng tăng nhẹ, jitter tất định theo ngày. */
function dailyPoints(dates: string[], factor: number): AnalyticsPoint[] {
  return dates.map((date, idx) => {
    const wave = Math.sin(idx / 2.4) * 0.3 + Math.sin(idx / 5.5) * 0.22;
    const jitter = 0.8 + seed(date) * 0.5; // 0.8 → 1.3
    const views = Math.max(0, Math.round((900 + idx * 22 + wave * 520) * jitter * factor));
    const likes = Math.round(views * (0.07 + 0.02 * seed('l' + date)));
    const comments = Math.round(views * (0.015 + 0.01 * seed('c' + date)));
    const shares = Math.round(views * (0.008 + 0.006 * seed('s' + date)));
    return { date, views, likes, comments, shares };
  });
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

/** deltaPct tất định trong khoảng ~[-15, +38] để badge tăng/giảm sinh động. */
function mockDelta(key: string): number {
  return Math.round((seed('d' + key) * 53 - 15) * 10) / 10;
}

function statOf(series: number[], key: string): AnalyticsStat {
  return { total: sum(series), deltaPct: series.length ? mockDelta(key) : null, series };
}

// ---- builders (khớp shape DTO backend) ----

/** Hệ số gộp của một bộ lọc (nền tảng × loại nội dung) — mock tôn trọng cả hai chiều. */
const filterFactor = (f: AnalyticsFilter) => factorOf(f.platforms) * typeFactorOf(f.contentTypes);

export function mockTimeseries(f: AnalyticsFilter = defFilter()): AnalyticsTimeseries {
  const dates = dateRange(f.from, f.to);
  const points = dailyPoints(dates, filterFactor(f));
  return { from: f.from, to: f.to, rangeDays: dates.length, points };
}

export function mockSummary(f: AnalyticsFilter = defFilter()): AnalyticsSummary {
  const dates = dateRange(f.from, f.to);
  const points = dailyPoints(dates, filterFactor(f));
  const rangeDays = dates.length;
  return {
    from: f.from, to: f.to, rangeDays,
    compareFrom: shiftISO(f.from, -rangeDays),
    compareTo: shiftISO(f.from, -1),
    views: statOf(points.map((p) => p.views), 'views' + f.from),
    likes: statOf(points.map((p) => p.likes), 'likes' + f.from),
    comments: statOf(points.map((p) => p.comments), 'comments' + f.from),
    shares: statOf(points.map((p) => p.shares), 'shares' + f.from),
  };
}

// KHÔNG áp bộ lọc nền tảng (ngoại lệ 1 của backend) — donut thể hiện tỷ trọng GIỮA các nền tảng.
export function mockByPlatform(f: AnalyticsFilter = defFilter()): AnalyticsPlatform[] {
  // Tổng theo nền tảng suy từ cùng chuỗi ngày để nhất quán với KPI/chart.
  const dates = dateRange(f.from, f.to);
  const totalViews = sum(dailyPoints(dates, typeFactorOf(f.contentTypes)).map((p) => p.views));

  // FB + IG đã kết nối (có số liệu); Threads CHƯA kết nối để minh hoạ CTA "Kết nối ngay".
  const base: Omit<AnalyticsPlatform, 'engagement' | 'sharePct'>[] = [
    {
      platform: 'FACEBOOK', connected: true, accountName: 'AIMA Fanpage', avatarUrl: null, status: 'ACTIVE',
      views: Math.round(totalViews * 0.5), likes: Math.round(totalViews * 0.5 * 0.08),
      comments: Math.round(totalViews * 0.5 * 0.02), shares: Math.round(totalViews * 0.5 * 0.011),
    },
    {
      platform: 'INSTAGRAM', connected: true, accountName: '@aima.official', avatarUrl: null, status: 'ACTIVE',
      views: Math.round(totalViews * 0.35), likes: Math.round(totalViews * 0.35 * 0.11),
      comments: Math.round(totalViews * 0.35 * 0.025), shares: Math.round(totalViews * 0.35 * 0.009),
    },
    {
      platform: 'THREADS', connected: false, accountName: null, avatarUrl: null, status: null,
      views: 0, likes: 0, comments: 0, shares: 0,
    },
  ];

  const withEng = base.map((p) => ({ ...p, engagement: p.likes + p.comments + p.shares }));
  const totalEng = sum(withEng.map((p) => p.engagement)) || 1;
  return withEng.map((p) => ({ ...p, sharePct: Math.round((p.engagement / totalEng) * 1000) / 10 }));
}

const CAPTIONS = [
  'Bí quyết chăm sóc da mùa hè cho làn da luôn khỏe mạnh',
  '5 xu hướng marketing không thể bỏ lỡ trong năm 2026',
  'Cách xây dựng thương hiệu cá nhân từ con số 0',
  'Review sản phẩm mới: có thật sự đáng tiền không?',
  'Hậu trường buổi chụp hình bộ sưu tập mùa thu',
  'Mẹo tăng tương tác tự nhiên trên mạng xã hội',
  'Câu chuyện khách hàng: hành trình chuyển đổi ngoạn mục',
  'Livestream ra mắt sản phẩm — ưu đãi độc quyền',
  'Top 3 công cụ AI hỗ trợ sáng tạo nội dung nhanh hơn',
  'Ưu đãi đặc biệt cuối tuần — số lượng có hạn',
  'Chia sẻ quy trình lên kế hoạch nội dung 30 ngày',
  'Những lỗi thường gặp khi mới bắt đầu bán hàng online',
  'Cách viết caption thu hút chỉ trong 3 bước đơn giản',
  'Xu hướng màu sắc thương hiệu được ưa chuộng năm nay',
  'Bí kíp lên lịch đăng bài để tiếp cận tối đa',
  'Phân tích 1 chiến dịch viral: vì sao nó thành công?',
  'Checklist chuẩn bị trước khi ra mắt sản phẩm mới',
  'Hỏi đáp cùng chuyên gia: xây dựng cộng đồng trung thành',
  'Mini game cuối tháng — nhận quà cực hấp dẫn',
  'Tổng kết hiệu quả nội dung tháng qua & bài học rút ra',
];

export function mockTopPosts(f: AnalyticsFilter = defFilter(), sort?: TopPostSort, limit = 10): AnalyticsTopPost[] {
  const { from, to, platforms } = f;
  const dates = dateRange(from, to);
  // Chỉ nền tảng ĐÃ kết nối mới có bài (Threads chưa kết nối); tôn trọng bộ lọc nền tảng.
  const connected: Platform[] = ['FACEBOOK', 'INSTAGRAM'];
  const pool = platforms.length > 0 ? connected.filter((p) => platforms.includes(p)) : connected;
  const account: Record<string, string> = { FACEBOOK: 'AIMA Fanpage', INSTAGRAM: '@aima.official' };

  // Loại nội dung gán tất định theo vị trí caption để bộ lọc "loại nội dung" có tác dụng thật.
  const rows: AnalyticsTopPost[] = pool.length === 0 ? [] : CAPTIONS
    .map((caption, i) => ({ caption, i }))
    .filter(({ i }) => f.contentTypes.length === 0 || f.contentTypes.includes(mockTypeOf(i)))
    .map(({ caption, i }) => {
    const platform = pool[i % pool.length];
    // Rải đều bài trong khoảng đã chọn để luôn hiển thị dù đổi preset.
    const date = dates[Math.floor((i / CAPTIONS.length) * dates.length)] ?? dates[dates.length - 1] ?? to;
    const r = seed(caption);
    const views = Math.round(1200 + r * 6400);
    const likes = Math.round(views * (0.06 + 0.05 * seed('l' + caption)));
    const comments = Math.round(views * (0.01 + 0.02 * seed('c' + caption)));
    const shares = Math.round(views * (0.006 + 0.012 * seed('s' + caption)));
    return {
      postId: `mock-${i}`,
      contentItemId: `mock-item-${i}`,
      platform,
      caption,
      accountName: account[platform],
      publishedAt: `${date}T${pad(8 + (i % 10))}:${pad((i * 7) % 60)}:00`,
      views, likes, comments, shares,
      engagement: likes + comments + shares,
    };
  });

  // Sắp xếp theo cột (whitelist) — khớp hành vi backend, thay cho query thật.
  const field = sort?.field ?? 'views';
  const asc = sort?.asc ?? false;
  const key = (row: AnalyticsTopPost): number =>
    field === 'date' ? new Date(row.publishedAt).getTime() : (row[field] as number);
  rows.sort((a, b) => (asc ? key(a) - key(b) : key(b) - key(a)));

  return rows.slice(0, Math.min(Math.max(limit, 1), 50));
}

/** Loại nội dung của bài mock thứ i — MVP không có "Reels" (AI chỉ sinh image/video/text). */
const MOCK_TYPES: ContentTypeLabel[] = ['IMAGE', 'VIDEO', 'TEXT', 'IMAGE', 'OTHER'];
const mockTypeOf = (i: number) => MOCK_TYPES[i % MOCK_TYPES.length];

// KHÔNG áp bộ lọc loại nội dung (ngoại lệ 2 của backend) — donut là tỷ trọng GIỮA các loại.
export function mockByContentType(f: AnalyticsFilter = defFilter()): AnalyticsContentType[] {
  const dates = dateRange(f.from, f.to);
  const totalViews = sum(dailyPoints(dates, factorOf(f.platforms)).map((p) => p.views));

  const rows = (['IMAGE', 'VIDEO', 'TEXT', 'OTHER'] as ContentTypeLabel[]).map((label) => {
    const w = TYPE_WEIGHT[label];
    const views = Math.round(totalViews * w);
    const likes = Math.round(views * (0.07 + 0.03 * seed('l' + label)));
    const comments = Math.round(views * (0.017 + 0.008 * seed('c' + label)));
    const shares = Math.round(views * (0.009 + 0.005 * seed('s' + label)));
    return {
      label,
      posts: Math.max(1, Math.round(dates.length * w * 1.4)),
      views, likes, comments, shares,
      engagement: likes + comments + shares,
      sharePct: 0,
    };
  });

  const totalEng = sum(rows.map((r) => r.engagement)) || 1;
  return rows.map((r) => ({ ...r, sharePct: Math.round((r.engagement / totalEng) * 1000) / 10 }));
}

/**
 * Heatmap mẫu: cố ý sinh CẢ BA loại ô để giao diện thể hiện đúng ba nghĩa khác nhau —
 * ô vắng mặt (chưa từng đăng), ô `lowSample` (có bài nhưng < 3), ô đủ mẫu (vào thang màu).
 */
export function mockHeatmap(f: AnalyticsFilter = defFilter()): AnalyticsHeatmap {
  const minPostsForScale = 3;
  const factor = filterFactor(f);
  const cells: AnalyticsHeatmapCell[] = [];

  for (let dow = 1; dow <= 7; dow++) {
    for (let slot = 0; slot < 8; slot++) {
      const r = seed(`h${dow}-${slot}-${f.from}`);
      // Khung đêm (0–2, 3–5) hầu như không đăng → để trống, đúng như dữ liệu thật.
      if (slot <= 1 ? r < 0.82 : r < 0.28) continue;
      const posts = Math.max(1, Math.round(r * 6 * (slot >= 4 ? 1 : 0.5)));
      // Buổi tối (18–21h) tương tác tốt hơn để khung giờ vàng có ý nghĩa.
      const perPost = (40 + r * 160) * (slot === 6 ? 1.9 : slot === 5 ? 1.3 : 1) * factor;
      const engagement = Math.round(posts * perPost);
      cells.push({
        dow, slot, hourStart: slot * 3, posts, engagement,
        avgEngagement: Math.round((engagement / posts) * 10) / 10,
        lowSample: posts < minPostsForScale,
      });
    }
  }

  const scaled = cells.filter((c) => !c.lowSample);
  return {
    from: f.from, to: f.to, cells,
    max: scaled.length ? Math.max(...scaled.map((c) => c.avgEngagement)) : null,
    min: scaled.length ? Math.min(...scaled.map((c) => c.avgEngagement)) : null,
    minPostsForScale,
    scaledCells: scaled.length,
  };
}

export function mockInsights(f: AnalyticsFilter = defFilter()): AnalyticsInsights {
  const dates = dateRange(f.from, f.to);
  const rangeDays = dates.length;
  const heat = mockHeatmap(f);
  const posts = heat.cells.reduce((s, c) => s + c.posts, 0);
  const engagement = heat.cells.reduce((s, c) => s + c.engagement, 0);
  const avgEngagementPerPost = posts ? Math.round((engagement / posts) * 10) / 10 : 0;

  // Khung giờ vàng chỉ lấy trong các ô ĐỦ MẪU — không đủ thì null (FE hiện "Chưa đủ dữ liệu").
  const best = heat.cells
    .filter((c) => !c.lowSample)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];

  const views = sum(dailyPoints(dates, filterFactor(f)).map((p) => p.views));
  // Bài Facebook thường thiếu lượt xem → bị loại khỏi mẫu số, giống hệt dữ liệu thật.
  const ratedPosts = Math.round(posts * 0.45);

  return {
    from: f.from, to: f.to,
    compareFrom: shiftISO(f.from, -rangeDays),
    compareTo: shiftISO(f.from, -1),
    totalPosts: posts,
    totalPostsDeltaPct: mockDelta('tp' + f.from),
    goodPosts: Math.round(posts * 0.38),
    goodPostsDeltaPct: mockDelta('gp' + f.from),
    avgEngagementPerPost,
    needsAttentionPosts: Math.round(1 + seed('na' + f.from) * 4),
    needsAttentionDeltaPct: mockDelta('na' + f.from),
    goldenHour: best
      ? {
          dow: best.dow, slot: best.slot, hourStart: best.hourStart, hourEnd: best.hourStart + 3,
          posts: best.posts, avgEngagement: best.avgEngagement,
        }
      : null,
    engagementRatePct: views ? Math.round((engagement / views) * 1000) / 10 : null,
    engagementRateDeltaPct: mockDelta('er' + f.from),
    ratedPosts,
    excludedPosts: posts - ratedPosts,
  };
}
