/**
 * Màu cho các chart của Bảng điều khiển. Phải là mã màu rời (không dùng `brandGradient` của theme)
 * vì SVG cần từng stop tường minh, còn brandGradient là chuỗi CSS.
 *
 * GRID_LINE / AXIS_TEXT cố ý trùng giá trị với `components/admin/revenue/chartTokens.ts` để lưới
 * và nhãn trục toàn site giống nhau; hai khu vực giữ token riêng thay vì import chéo nhau.
 */

import { C } from '../../styles/colors';

/** Hai đường của biểu đồ hiệu suất — tím (tiếp cận) và xanh (tương tác), lấy từ dải thương hiệu. */
export const REACH_LINE = '#8b5cf6';
export const ENGAGEMENT_LINE = '#46d6ec';

// Lưới/nhãn trục đổi theo chế độ sáng/tối (sáng: #f1eef8 / #a59fbb). Hai đường + bảng màu donut giữ
// nguyên ở cả hai chế độ (màu thương hiệu, cần mã rời cho stop gradient SVG).
export const GRID_LINE = C.chartGrid;
export const AXIS_TEXT = C.chartAxis;

/** Bảng màu donut "Loại nội dung" — gán theo thứ tự lát, không theo tên định dạng, để định dạng
 *  mới (REEL, STORY…) tự có màu mà không phải sửa code. */
const TYPE_PALETTE = ['#8b5cf6', '#46d6ec', '#f083c0', '#10b981', '#f59e0b', '#6366f1'];

export const typeColor = (index: number) => TYPE_PALETTE[index % TYPE_PALETTE.length];

/** Tone của 4 thẻ số liệu — nền/màu icon (token sáng/tối); sparkline dùng `stroke` (giữ nguyên). */
export const STAT_TONES = {
  violet: { bg: C.purpleSoft, color: C.primary, stroke: '#8b5cf6' }, // #f1e9ff / #7c3aed
  emerald: { bg: C.successSoft, color: C.success, stroke: '#10b981' }, // #e8f8ee / #16a34a
  amber: { bg: C.amberSoft, color: C.warning, stroke: '#f59e0b' }, // #fdf4e5 / #d97706
  rose: { bg: C.roseSoft, color: C.rose, stroke: '#f43f5e' }, // #fdecf1 / #e23d6e
} as const;

export type StatTone = keyof typeof STAT_TONES;
