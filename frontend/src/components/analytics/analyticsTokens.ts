/**
 * Màu cho các chart của trang Phân tích. Cố ý dùng cùng dải màu 4 tone của `StatCard`
 * (dashboardTokens.STAT_TONES) để KPI card và biểu đồ đa series đọc như một hệ: mỗi metric
 * một màu cố định xuyên suốt cả 4 thẻ, đường chart và donut nền tảng.
 *
 * GRID_LINE / AXIS_TEXT giữ đúng giá trị dùng chung toàn site (trùng dashboardTokens/chartTokens)
 * để lưới + nhãn trục đồng bộ; mỗi khu vực giữ token riêng thay vì import chéo.
 */

import type { StatTone } from '../dashboard/dashboardTokens';
import { C } from '../../styles/colors';

export type MetricKey = 'views' | 'likes' | 'comments' | 'shares';

/** Màu đường/điểm của từng metric — khớp `stroke` trong STAT_TONES. */
export const METRIC_COLOR: Record<MetricKey, string> = {
  views: '#8b5cf6', // violet
  likes: '#f43f5e', // rose
  comments: '#f59e0b', // amber
  shares: '#10b981', // emerald
};

/** Tone của thẻ KPI tương ứng mỗi metric (dùng lại STAT_TONES qua StatCard). */
export const METRIC_TONE: Record<MetricKey, StatTone> = {
  views: 'violet',
  likes: 'rose',
  comments: 'amber',
  shares: 'emerald',
};

/** Thứ tự metric hiển thị nhất quán ở KPI, chart, bảng. */
export const METRIC_ORDER: MetricKey[] = ['views', 'likes', 'comments', 'shares'];

export const GRID_LINE = C.chartGrid;
export const AXIS_TEXT = C.chartAxis;

/** Màu donut nền tảng — cố định theo nền tảng để khớp `PlatformTag`. */
export const PLATFORM_DONUT: Record<string, string> = {
  FACEBOOK: '#1877f2',
  INSTAGRAM: '#ee2a7b',
  THREADS: C.chartThreads,
};
