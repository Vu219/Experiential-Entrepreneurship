import { C } from '../../../styles/colors';
/**
 * Màu cho chart doanh thu. Phải khai báo dạng mã màu rời (không dùng `brandGradient` của
 * theme) vì gradient SVG cần từng stop tường minh, còn brandGradient là chuỗi CSS. Giữ tất cả
 * ở một chỗ để chart doanh thu, donut và sparkline luôn cùng bảng màu.
 */

/** Đường + vùng tô chart doanh thu (tím brand). */
export const AREA_STROKE = C.violetLight;

/** Đường dự kiến nét đứt cho các ngày chưa tới của tháng hiện tại. */
export const PROJECTION_STROKE = '#a78bfa';

/** Nền vùng "ngày chưa tới" — đủ nhạt để không lấn đường thực thu. */
export const FUTURE_FILL = C.legacyBgf7f5fc;

/** Màu doanh thu ÂM (hoàn tiền lớn hơn doanh số trong bucket). */
export const REVENUE_NEGATIVE = '#ef4444';

export const GRID_LINE = C.chartGrid;
export const AXIS_TEXT = C.chartAxis;

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
  emerald: { stroke: C.legacyText10b981, badge: "bg-[var(--c-legacy-bg-ecfdf5)] text-[var(--c-legacy-text-059669)]" },
  rose: { stroke: C.legacyTextf43f5e, badge: "bg-[var(--c-legacy-bg-fff1f2)] text-[var(--c-legacy-text-e11d48)]" },
  violet: { stroke: C.violetLight, badge: "bg-[var(--c-legacy-bg-f5f3ff)] text-[var(--c-primary)]" },
  slate: { stroke: C.legacyText94a3b8, badge: "bg-[var(--c-slate-tint)] text-[var(--c-slate)]" },
} as const;

export type SparkTone = keyof typeof SPARK_TONES;
