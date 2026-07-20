/**
 * Màu cho chart doanh thu. Phải khai báo dạng mã màu rời (không dùng `brandGradient` của
 * theme) vì gradient SVG cần từng stop tường minh, còn brandGradient là chuỗi CSS. Giữ tất cả
 * ở một chỗ để chart cột, donut và sparkline luôn cùng bảng màu.
 */

/** Gradient cột: xanh (đáy) → tím (đỉnh), lấy theo dải màu thương hiệu. */
export const BAR_GRADIENT_FROM = '#8b5cf6';
export const BAR_GRADIENT_TO = '#46d6ec';

/** Màu doanh thu ÂM (hoàn tiền lớn hơn doanh số trong bucket) — không dùng gradient. */
export const BAR_NEGATIVE = '#ef4444';

export const GRID_LINE = '#f1eef8';
export const AXIS_TEXT = '#a59fbb';

/**
 * Bảng màu donut "Cơ cấu gói dịch vụ" — gán theo THỨ TỰ gói (`displayOrder`), không gán theo
 * tên gói, để admin thêm gói mới vẫn có màu mà không phải sửa code.
 */
const PLAN_PALETTE = ['#8b5cf6', '#46d6ec', '#f083c0', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'];

export const planColor = (index: number) => PLAN_PALETTE[index % PLAN_PALETTE.length];

/**
 * Tone của `SparklineCard`: stroke, gradient fill và badge % LUÔN lấy từ cùng một tone để card
 * không bị lệch màu (vd đường xanh nhưng badge đỏ). `slate` dùng khi không có % thay đổi.
 */
export const SPARK_TONES = {
  emerald: { stroke: '#10b981', badge: 'bg-emerald-50 text-emerald-600' },
  rose: { stroke: '#f43f5e', badge: 'bg-rose-50 text-rose-600' },
  violet: { stroke: '#8b5cf6', badge: 'bg-violet-50 text-violet-600' },
  slate: { stroke: '#94a3b8', badge: 'bg-slate-100 text-slate-500' },
} as const;

export type SparkTone = keyof typeof SPARK_TONES;
