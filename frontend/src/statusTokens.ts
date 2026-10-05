// Design tokens cho màu trạng thái kết nối — MỘT nguồn duy nhất, dùng chung giữa
// badge trong bảng "Danh sách tài khoản đã kết nối" và phần "Chú thích trạng thái".
// Mỗi token gồm: color (chữ/icon), bg (nền badge), dot (chấm tròn legend).
// Giá trị là var(--c-*) (styles/tokens.css) → tự đổi theo chế độ sáng/tối; mã hex ở comment = giá trị sáng.
// Cần độ trong suốt thì dùng alpha() trong styles/colors.ts, KHÔNG ghép hậu tố hex kiểu `${color}1f`.
// Không hardcode hex rải rác — mọi nơi cần màu trạng thái import từ đây.

import { C } from './styles/colors';

export type StatusToken = 'active' | 'expired' | 'error' | 'info';

export const STATUS_COLORS: Record<StatusToken, { color: string; bg: string }> = {
  active: { color: C.success, bg: C.successSoft2 }, // #16a34a / #dcfce7 — Đang hoạt động / Còn hiệu lực
  expired: { color: C.orange, bg: C.orangeSoft }, // #c2410c / #ffedd5 — Hết hạn
  error: { color: C.danger, bg: C.dangerSoft2 }, // #dc2626 / #fee2e2 — Lỗi kết nối
  info: { color: C.primary, bg: C.purpleSoft }, // #7c3aed / #f1e9ff — Thông tin / primary (kiểm tra trước khi đăng)
};

// Trạng thái phụ (chưa kết nối / chờ xử lý) — giữ để map đầy đủ ConnectionStatus của backend.
export const STATUS_NEUTRAL = { color: C.gray, bg: C.graySoft }; // #6b7280 / #f3f4f6
export const STATUS_PENDING = { color: C.warning, bg: C.warningSoft2 }; // #d97706 / #fef3c7

// ===== Tone ngữ nghĩa dùng chung TOÀN APP =====
// Một bảng duy nhất cho MỌI badge/chip trạng thái (bài đăng, user, log, dịch vụ, nhãn AI):
// admin/StatusBadge + create/statusMeta cùng đọc từ đây. Thêm nơi hiển thị trạng thái mới
// thì import tone từ bảng này, KHÔNG tự đặt mã màu rời.
export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'neutral' | 'ai';

export const TONE_COLORS: Record<Tone, { color: string; bg: string }> = {
  success: { color: C.success, bg: C.successSoft }, // #16a34a / #e8f8ee — Đã đăng / Đã duyệt / Active / Operational
  danger: { color: C.danger, bg: C.dangerSoft }, // #dc2626 / #fde8e8 — Thất bại / Locked / Down / ERROR
  warning: { color: C.warning, bg: C.warningSoft }, // #d97706 / #fdf0dc — Cần duyệt / Đang đăng / Retrying / WARN
  info: { color: C.info, bg: C.infoSoft }, // #0e7490 / #e0f7fb — Đã định dạng / Đang phân tích / INFO
  purple: { color: C.primary, bg: C.purpleSoft }, // #7c3aed / #f1e9ff — Đã tạo / Đã lên lịch / Pro
  neutral: { color: C.slate, bg: C.slateSoft }, // #64748b / #eef2f7 — Nháp / Idle / DEBUG
  ai: { color: C.primary, bg: C.primarySoft }, // #7c3aed / #f3edff — Nhãn minh bạch "✨ AI tạo" (NFR-14)
};
