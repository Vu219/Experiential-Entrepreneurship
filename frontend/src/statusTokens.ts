// Design tokens cho màu trạng thái kết nối — MỘT nguồn duy nhất, dùng chung giữa
// badge trong bảng "Danh sách tài khoản đã kết nối" và phần "Chú thích trạng thái".
// Mỗi token gồm: color (chữ/icon), bg (nền badge), dot (chấm tròn legend).
// Không hardcode hex rải rác — mọi nơi cần màu trạng thái import từ đây.

export type StatusToken = 'active' | 'expired' | 'error' | 'info';

export const STATUS_COLORS: Record<StatusToken, { color: string; bg: string }> = {
  active: { color: '#16a34a', bg: '#dcfce7' }, // Đang hoạt động / Còn hiệu lực
  expired: { color: '#c2410c', bg: '#ffedd5' }, // Hết hạn
  error: { color: '#dc2626', bg: '#fee2e2' }, // Lỗi kết nối
  info: { color: '#7c3aed', bg: '#f1e9ff' }, // Thông tin / primary (kiểm tra trước khi đăng)
};

// Trạng thái phụ (chưa kết nối / chờ xử lý) — giữ để map đầy đủ ConnectionStatus của backend.
export const STATUS_NEUTRAL = { color: '#6b7280', bg: '#f3f4f6' };
export const STATUS_PENDING = { color: '#d97706', bg: '#fef3c7' };

// ===== Tone ngữ nghĩa dùng chung TOÀN APP =====
// Một bảng duy nhất cho MỌI badge/chip trạng thái (bài đăng, user, log, dịch vụ, nhãn AI):
// admin/StatusBadge + create/statusMeta cùng đọc từ đây. Thêm nơi hiển thị trạng thái mới
// thì import tone từ bảng này, KHÔNG tự đặt mã màu rời.
export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'neutral' | 'ai';

export const TONE_COLORS: Record<Tone, { color: string; bg: string }> = {
  success: { color: '#16a34a', bg: '#e8f8ee' }, // Đã đăng / Đã duyệt / Active / Operational
  danger: { color: '#dc2626', bg: '#fde8e8' }, // Thất bại / Locked / Down / ERROR
  warning: { color: '#d97706', bg: '#fdf0dc' }, // Cần duyệt / Đang đăng / Retrying / WARN
  info: { color: '#0e7490', bg: '#e0f7fb' }, // Đã định dạng / Đang phân tích / INFO
  purple: { color: '#7c3aed', bg: '#f1e9ff' }, // Đã tạo / Đã lên lịch / Pro
  neutral: { color: '#64748b', bg: '#eef2f7' }, // Nháp / Idle / DEBUG
  ai: { color: '#7c3aed', bg: '#f3edff' }, // Nhãn minh bạch "✨ AI tạo" (NFR-14)
};
