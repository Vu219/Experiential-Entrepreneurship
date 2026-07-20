import type { Lang } from '../../../types';
import type { ActivityAction, ActivityActionGroup } from '../../../api/admin';

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

/**
 * Nhãn hiển thị của từng action. Đặt ở đây (không nhét vào i18n.ts) vì đây là bảng tra
 * 1-1 với một enum backend — để cạnh nhau thì thêm/bớt action chỉ phải sửa một chỗ, cùng
 * cách `aiTaskLabel` trong api/adminAi.ts đang làm.
 */
export const actionLabel = (lang: Lang, action: ActivityAction): string =>
  ({
    LOGIN: P(lang, 'Đăng nhập', 'Signed in'),
    LOGIN_FAILED: P(lang, 'Đăng nhập thất bại', 'Sign-in failed'),
    LOGOUT: P(lang, 'Đăng xuất', 'Signed out'),
    PASSWORD_CHANGED: P(lang, 'Đổi mật khẩu', 'Password changed'),
    PASSWORD_RESET: P(lang, 'Đặt lại mật khẩu', 'Password reset'),

    ACCOUNT_REGISTERED: P(lang, 'Đăng ký tài khoản', 'Account registered'),
    PROFILE_UPDATED: P(lang, 'Cập nhật hồ sơ', 'Profile updated'),
    ACCOUNT_DELETE_REQUESTED: P(lang, 'Yêu cầu xóa tài khoản', 'Account deletion requested'),
    ACCOUNT_RESTORED: P(lang, 'Khôi phục tài khoản', 'Account restored'),
    SOCIAL_CONNECTED: P(lang, 'Liên kết mạng xã hội', 'Social account connected'),
    SOCIAL_DISCONNECTED: P(lang, 'Hủy liên kết mạng xã hội', 'Social account disconnected'),

    CONTENT_CREATED: P(lang, 'Tạo nội dung', 'Content created'),
    CONTENT_UPDATED: P(lang, 'Sửa nội dung', 'Content updated'),
    CONTENT_DELETED: P(lang, 'Xóa nội dung', 'Content deleted'),
    CONTENT_STATUS_CHANGED: P(lang, 'Đổi trạng thái nội dung', 'Content status changed'),
    SCHEDULE_CREATED: P(lang, 'Lên lịch đăng', 'Post scheduled'),
    SCHEDULE_UPDATED: P(lang, 'Sửa lịch đăng', 'Schedule updated'),
    SCHEDULE_CANCELLED: P(lang, 'Hủy lịch đăng', 'Schedule cancelled'),
    POST_PUBLISHED: P(lang, 'Đăng bài thành công', 'Post published'),
    POST_FAILED: P(lang, 'Đăng bài thất bại', 'Post failed'),

    PLAN_CHANGED: P(lang, 'Đổi gói dịch vụ', 'Plan changed'),
    PAYMENT_SUCCEEDED: P(lang, 'Thanh toán thành công', 'Payment succeeded'),
    PAYMENT_FAILED: P(lang, 'Thanh toán thất bại', 'Payment failed'),

    USER_CREATED: P(lang, 'Tạo người dùng', 'User created'),
    USER_UPDATED: P(lang, 'Sửa người dùng', 'User updated'),
    USER_STATUS_CHANGED: P(lang, 'Đổi trạng thái người dùng', 'User status changed'),
    USER_DELETED: P(lang, 'Xóa người dùng', 'User deleted'),
    USER_PASSWORD_RESET: P(lang, 'Đặt lại mật khẩu người dùng', 'User password reset'),
    PLAN_CONFIG_UPDATED: P(lang, 'Sửa cấu hình gói', 'Plan config updated'),
    AI_CONFIG_UPDATED: P(lang, 'Sửa cấu hình AI', 'AI config updated'),
    API_VERSION_UPDATED: P(lang, 'Cập nhật version API', 'API version updated'),
    TOKENS_GRANTED: P(lang, 'Cấp thêm token', 'Tokens granted'),
    USAGE_RESET: P(lang, 'Reset mức dùng', 'Usage reset'),
    BILLING_RATE_CREATED: P(lang, 'Thêm hệ số quy đổi', 'Billing rate created'),
    ALERT_ACKED: P(lang, 'Xác nhận cảnh báo', 'Alert acknowledged'),
    ALERT_CONFIG_UPDATED: P(lang, 'Đổi ngưỡng cảnh báo', 'Alert config updated'),
    USAGE_META_VIEWED: P(lang, 'Xem IP/thiết bị của bản ghi', 'Viewed record IP/device'),
    USER_SESSIONS_VIEWED: P(lang, 'Xem phiên & thiết bị', 'Viewed sessions & devices'),
    DEV_CREDIT_GRANTED: P(lang, 'Cấp credit (dev-tool)', 'Credit granted (dev tool)'),
    DATA_EXPORTED: P(lang, 'Export dữ liệu', 'Data exported'),
  })[action] ?? action;

export const actionGroupLabel = (lang: Lang, group: ActivityActionGroup): string =>
  ({
    AUTH: P(lang, 'Xác thực', 'Authentication'),
    ACCOUNT: P(lang, 'Tài khoản', 'Account'),
    CONTENT: P(lang, 'Nội dung', 'Content'),
    BILLING: P(lang, 'Thanh toán', 'Billing'),
    ADMIN: P(lang, 'Quản trị', 'Admin'),
  })[group] ?? group;

/**
 * Tone badge theo nhóm — cùng bảng màu StatusBadge sẵn có, không thêm màu mới (rule.md).
 * Hành động thất bại được tô riêng ở cột Kết quả nên ở đây chỉ phân biệt nhóm nghiệp vụ.
 */
export const actionGroupTone = (group: ActivityActionGroup) =>
  group === 'ADMIN' ? 'warning' : group === 'BILLING' ? 'success' : group === 'AUTH' ? 'info' : 'neutral';
