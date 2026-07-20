package com.aima.enums;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.Set;

/**
 * Enum ĐÓNG các hành động được ghi vào {@code activity_logs}.
 *
 * <p><b>Quy tắc bắt buộc khi thêm giá trị mới:</b> chỉ ghi hành động có ý nghĩa NGHIỆP VỤ
 * (tạo/sửa/xoá/đổi trạng thái/thanh toán/thao tác admin). TUYỆT ĐỐI KHÔNG thêm action cho
 * request GET thường, xem trang, polling job hay health check — đó là thứ làm phình bảng
 * mà không ai đọc lại.
 *
 * <p><b>Ngoại lệ CÓ CHỦ Ý cho quy tắc trên</b> — {@link #USAGE_META_VIEWED} và
 * {@link #USER_SESSIONS_VIEWED} là hành động ĐỌC nhưng vẫn được ghi, vì đó là admin xem
 * DỮ LIỆU CÁ NHÂN của user khác (IP, User-Agent, phiên đăng nhập). Dấu vết "ai đã xem PII
 * của ai, lúc nào" là yêu cầu audit, không phải log thao tác thường. ĐỪNG XOÁ hai giá trị
 * này khi dọn dẹp enum.
 */
@Getter
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public enum ActivityAction {

    // ===== AUTH =====
    LOGIN(ActivityActionGroup.AUTH),
    LOGIN_FAILED(ActivityActionGroup.AUTH),
    LOGOUT(ActivityActionGroup.AUTH),
    PASSWORD_CHANGED(ActivityActionGroup.AUTH),
    PASSWORD_RESET(ActivityActionGroup.AUTH),

    // ===== ACCOUNT (user tự thao tác trên tài khoản mình) =====
    ACCOUNT_REGISTERED(ActivityActionGroup.ACCOUNT),
    PROFILE_UPDATED(ActivityActionGroup.ACCOUNT),
    ACCOUNT_DELETE_REQUESTED(ActivityActionGroup.ACCOUNT),
    ACCOUNT_RESTORED(ActivityActionGroup.ACCOUNT),
    SOCIAL_CONNECTED(ActivityActionGroup.ACCOUNT),
    SOCIAL_DISCONNECTED(ActivityActionGroup.ACCOUNT),

    // ===== CONTENT =====
    CONTENT_CREATED(ActivityActionGroup.CONTENT),
    CONTENT_UPDATED(ActivityActionGroup.CONTENT),
    CONTENT_DELETED(ActivityActionGroup.CONTENT),
    CONTENT_STATUS_CHANGED(ActivityActionGroup.CONTENT),
    SCHEDULE_CREATED(ActivityActionGroup.CONTENT),
    SCHEDULE_UPDATED(ActivityActionGroup.CONTENT),
    SCHEDULE_CANCELLED(ActivityActionGroup.CONTENT),
    POST_PUBLISHED(ActivityActionGroup.CONTENT),
    POST_FAILED(ActivityActionGroup.CONTENT),

    // ===== BILLING =====
    // Chưa có điểm ghi: payment controller thuộc task doanh thu (PaymentGateway/PaymentStatus
    // đã khai trước). Giá trị khai sẵn để khi tích hợp không phải đổi kiểu cột.
    PLAN_CHANGED(ActivityActionGroup.BILLING),
    PAYMENT_SUCCEEDED(ActivityActionGroup.BILLING),
    PAYMENT_FAILED(ActivityActionGroup.BILLING),

    // ===== ADMIN =====
    USER_CREATED(ActivityActionGroup.ADMIN),
    USER_UPDATED(ActivityActionGroup.ADMIN),
    USER_STATUS_CHANGED(ActivityActionGroup.ADMIN),
    USER_DELETED(ActivityActionGroup.ADMIN),
    USER_PASSWORD_RESET(ActivityActionGroup.ADMIN),
    PLAN_CONFIG_UPDATED(ActivityActionGroup.ADMIN),
    AI_CONFIG_UPDATED(ActivityActionGroup.ADMIN),
    API_VERSION_UPDATED(ActivityActionGroup.ADMIN),
    TOKENS_GRANTED(ActivityActionGroup.ADMIN),
    USAGE_RESET(ActivityActionGroup.ADMIN),
    BILLING_RATE_CREATED(ActivityActionGroup.ADMIN),
    ALERT_ACKED(ActivityActionGroup.ADMIN),
    ALERT_CONFIG_UPDATED(ActivityActionGroup.ADMIN),

    /** NGOẠI LỆ CÓ CHỦ Ý (xem javadoc lớp): admin xem IP/User-Agent của user khác. */
    USAGE_META_VIEWED(ActivityActionGroup.ADMIN),

    /** NGOẠI LỆ CÓ CHỦ Ý (xem javadoc lớp): admin xem phiên & thiết bị của user khác. */
    USER_SESSIONS_VIEWED(ActivityActionGroup.ADMIN),

    /** Cấp credit bằng dev-tool (không qua thanh toán) — cấp token miễn phí thì càng phải có vết. */
    DEV_CREDIT_GRANTED(ActivityActionGroup.ADMIN),

    DATA_EXPORTED(ActivityActionGroup.ADMIN);

    ActivityActionGroup group;

    /**
     * Action ĐƯỢC MIỄN quy tắc chống trùng 60 giây.
     *
     * <p>Chống trùng tồn tại để một thao tác lặp vô nghĩa không làm phình bảng. Nhưng với
     * {@link #LOGIN_FAILED} thì "lặp nhiều lần trong thời gian ngắn" CHÍNH LÀ thông tin cần
     * ghi: gộp 50 lần thử mật khẩu trong một phút thành 1 dòng khiến log bảo mật mất hết giá
     * trị điều tra brute-force. Chống phình cho riêng nhóm này dùng cơ chế KHÁC — trần số dòng
     * theo IP mỗi giờ, xem {@code ActivityLogWriterImpl}.
     *
     * <p>ĐỪNG thêm action thường vào đây chỉ vì "muốn ghi đủ": chỉ những action mà TẦN SUẤT
     * là dữ liệu bảo mật mới thuộc danh sách này.
     */
    public static final Set<ActivityAction> DEDUP_EXEMPT = Set.of(LOGIN_FAILED);
}
