package com.aima.enums;

import java.util.List;

import static com.aima.enums.PublishErrorAction.AI_FIX;
import static com.aima.enums.PublishErrorAction.CHANGE_ACCOUNT;
import static com.aima.enums.PublishErrorAction.CONTACT_SUPPORT;
import static com.aima.enums.PublishErrorAction.DISMISS;
import static com.aima.enums.PublishErrorAction.EDIT_CONTENT;
import static com.aima.enums.PublishErrorAction.OPEN_PLATFORM;
import static com.aima.enums.PublishErrorAction.RECONNECT_ACCOUNT;
import static com.aima.enums.PublishErrorAction.RETRY_NOW;

/**
 * Mã lỗi đăng bài CHUẨN của AIMA (catalog mặc định trong code). Mọi lỗi nền tảng / lỗi nội bộ khi đăng bài
 * được chuẩn hoá về một mã ở đây ({@code PublishErrorNormalizer}); FE dịch mã + tham số thành câu thân thiện
 * (vi/en) ở {@code frontend/src/api/publishErrorCatalog.ts} — thêm mã mới phải sửa CẢ hai nơi + migration
 * CHECK của {@code posting_jobs.error_code} / {@code publish_error_mappings.error_code}.
 *
 * <p>Metadata của mỗi mã quyết định hành vi, không chỉ hiển thị:</p>
 * <ul>
 *   <li>{@link #isAutoRetry()} — worker tự thử lại theo FR-56 (5/15/30 phút) hay dừng ngay.</li>
 *   <li>{@link #legacyType()} — phân loại thô {@link PublishErrorType} cũ (tab POLICY/TECHNICAL, FE cũ).</li>
 *   <li>{@link #isAccountLevel()} — lỗi chặn mọi bài của tài khoản: thông báo gộp theo tài khoản, FE gom nhóm.</li>
 *   <li>{@link #isRequiresContentChange()} — "Thử lại ngay" chỉ được phép khi nội dung đã được sửa.</li>
 * </ul>
 */
public enum PublishErrorCode {

    POLICY_VIOLATION(PublishErrorCategory.POLICY, PublishErrorSeverity.ERROR, PublishErrorOwner.USER,
            false, PublishErrorType.POLICY_VIOLATION, false, true,
            List.of(EDIT_CONTENT, AI_FIX, DISMISS)),
    /** Graph 368 — tài khoản bị TẠM CHẶN đăng bài do nghi vi phạm (không phải nội dung bài này). */
    POLICY_TEMPORARY_BLOCK(PublishErrorCategory.POLICY, PublishErrorSeverity.CRITICAL, PublishErrorOwner.USER,
            false, PublishErrorType.POLICY_VIOLATION, true, false,
            List.of(OPEN_PLATFORM, RECONNECT_ACCOUNT, RETRY_NOW, DISMISS)),

    AUTH_TOKEN_EXPIRED(PublishErrorCategory.AUTH, PublishErrorSeverity.CRITICAL, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, true, false,
            List.of(RECONNECT_ACCOUNT, RETRY_NOW, DISMISS)),
    AUTH_PASSWORD_CHANGED(PublishErrorCategory.AUTH, PublishErrorSeverity.CRITICAL, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, true, false,
            List.of(RECONNECT_ACCOUNT, RETRY_NOW, DISMISS)),
    AUTH_APP_REMOVED(PublishErrorCategory.AUTH, PublishErrorSeverity.CRITICAL, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, true, false,
            List.of(RECONNECT_ACCOUNT, RETRY_NOW, DISMISS)),
    AUTH_PERMISSION_MISSING(PublishErrorCategory.PERMISSION, PublishErrorSeverity.CRITICAL, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, true, false,
            List.of(RECONNECT_ACCOUNT, RETRY_NOW, DISMISS)),
    AUTH_PAGE_ROLE_MISSING(PublishErrorCategory.PERMISSION, PublishErrorSeverity.CRITICAL, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, true, false,
            List.of(OPEN_PLATFORM, RECONNECT_ACCOUNT, RETRY_NOW, DISMISS)),

    ACCOUNT_CHECKPOINT(PublishErrorCategory.ACCOUNT, PublishErrorSeverity.CRITICAL, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, true, false,
            List.of(OPEN_PLATFORM, RECONNECT_ACCOUNT, RETRY_NOW, DISMISS)),
    ACCOUNT_RESTRICTED(PublishErrorCategory.ACCOUNT, PublishErrorSeverity.CRITICAL, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, true, false,
            List.of(OPEN_PLATFORM, RECONNECT_ACCOUNT, RETRY_NOW, DISMISS)),
    /** Kết nối đã bị ngắt / không còn ACTIVE lúc worker nhận job — lịch được tạm giữ, không gọi nền tảng. */
    ACCOUNT_DISCONNECTED(PublishErrorCategory.ACCOUNT, PublishErrorSeverity.ERROR, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, true, false,
            List.of(RECONNECT_ACCOUNT, DISMISS)),
    /** Facebook chỉ cho đăng lên Trang — kênh cá nhân (USER) không đăng được. */
    ACCOUNT_TYPE_UNSUPPORTED(PublishErrorCategory.ACCOUNT, PublishErrorSeverity.ERROR, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, false, false,
            List.of(CHANGE_ACCOUNT, DISMISS)),

    RATE_LIMITED(PublishErrorCategory.RATE_LIMIT, PublishErrorSeverity.WARNING, PublishErrorOwner.SYSTEM,
            true, PublishErrorType.TEMPORARY, false, false,
            List.of(RETRY_NOW, DISMISS)),
    QUOTA_EXCEEDED(PublishErrorCategory.QUOTA, PublishErrorSeverity.WARNING, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, false, false,
            List.of(RETRY_NOW, DISMISS)),

    CONTENT_TOO_LONG(PublishErrorCategory.CONTENT, PublishErrorSeverity.ERROR, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, false, true,
            List.of(EDIT_CONTENT, AI_FIX, DISMISS)),
    /** Graph 506 — đăng trùng nội dung bài liền trước. */
    CONTENT_DUPLICATE(PublishErrorCategory.CONTENT, PublishErrorSeverity.ERROR, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, false, true,
            List.of(EDIT_CONTENT, AI_FIX, DISMISS)),
    CONTENT_INVALID(PublishErrorCategory.CONTENT, PublishErrorSeverity.ERROR, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, false, true,
            List.of(EDIT_CONTENT, AI_FIX, DISMISS)),

    /** Nền tảng bắt buộc ảnh/video (Instagram) — MVP chỉ đăng chữ (FR-29). */
    MEDIA_REQUIRED(PublishErrorCategory.MEDIA, PublishErrorSeverity.ERROR, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, false, false,
            List.of(CHANGE_ACCOUNT, DISMISS)),
    MEDIA_INVALID(PublishErrorCategory.MEDIA, PublishErrorSeverity.ERROR, PublishErrorOwner.USER,
            false, PublishErrorType.PERMANENT, false, true,
            List.of(EDIT_CONTENT, DISMISS)),

    PLATFORM_TEMPORARY(PublishErrorCategory.PLATFORM, PublishErrorSeverity.WARNING, PublishErrorOwner.SYSTEM,
            true, PublishErrorType.TEMPORARY, false, false,
            List.of(RETRY_NOW, DISMISS)),
    /** Lỗi tạm thời xảy ra khi nền tảng đang có sự cố diện rộng (PlatformIncidentService) — retry bị hoãn. */
    PLATFORM_OUTAGE(PublishErrorCategory.PLATFORM, PublishErrorSeverity.WARNING, PublishErrorOwner.SYSTEM,
            true, PublishErrorType.TEMPORARY, false, false,
            List.of(RETRY_NOW, DISMISS)),
    NETWORK_TIMEOUT(PublishErrorCategory.NETWORK, PublishErrorSeverity.WARNING, PublishErrorOwner.SYSTEM,
            true, PublishErrorType.TEMPORARY, false, false,
            List.of(RETRY_NOW, DISMISS)),
    /** Job kẹt RUNNING (máy chủ khởi động lại giữa lúc đăng) — được vớt rồi thử lại. */
    PUBLISH_INTERRUPTED(PublishErrorCategory.NETWORK, PublishErrorSeverity.WARNING, PublishErrorOwner.SYSTEM,
            true, PublishErrorType.TEMPORARY, false, false,
            List.of(RETRY_NOW, DISMISS)),

    PLATFORM_UNSUPPORTED(PublishErrorCategory.INTERNAL, PublishErrorSeverity.ERROR, PublishErrorOwner.SYSTEM,
            false, PublishErrorType.PERMANENT, false, false,
            List.of(CONTACT_SUPPORT, DISMISS)),
    INTERNAL_ERROR(PublishErrorCategory.INTERNAL, PublishErrorSeverity.ERROR, PublishErrorOwner.SYSTEM,
            false, PublishErrorType.INTERNAL, false, false,
            List.of(RETRY_NOW, CONTACT_SUPPORT, DISMISS)),
    /** Không khớp luật nào và chưa có ánh xạ của admin — vào hàng đợi "chưa phân loại". */
    UNKNOWN(PublishErrorCategory.UNKNOWN, PublishErrorSeverity.ERROR, PublishErrorOwner.SYSTEM,
            false, PublishErrorType.PERMANENT, false, false,
            List.of(RETRY_NOW, CONTACT_SUPPORT, DISMISS));

    private final PublishErrorCategory category;
    private final PublishErrorSeverity severity;
    private final PublishErrorOwner owner;
    private final boolean autoRetry;
    private final PublishErrorType legacyType;
    private final boolean accountLevel;
    private final boolean requiresContentChange;
    private final List<PublishErrorAction> actions;

    PublishErrorCode(PublishErrorCategory category, PublishErrorSeverity severity, PublishErrorOwner owner,
                     boolean autoRetry, PublishErrorType legacyType, boolean accountLevel,
                     boolean requiresContentChange, List<PublishErrorAction> actions) {
        this.category = category;
        this.severity = severity;
        this.owner = owner;
        this.autoRetry = autoRetry;
        this.legacyType = legacyType;
        this.accountLevel = accountLevel;
        this.requiresContentChange = requiresContentChange;
        this.actions = actions;
    }

    public PublishErrorCategory category() {
        return category;
    }

    public PublishErrorSeverity severity() {
        return severity;
    }

    public PublishErrorOwner owner() {
        return owner;
    }

    /** Worker tự thử lại theo FR-56 (chỉ lỗi tạm thời). */
    public boolean isAutoRetry() {
        return autoRetry;
    }

    /** Phân loại thô cũ — giữ cho cột {@code posting_jobs.error_type}, tab POLICY/TECHNICAL và FE cũ. */
    public PublishErrorType legacyType() {
        return legacyType;
    }

    /** Lỗi chặn mọi bài của tài khoản (token, quyền, tài khoản bị khoá) — xử lý một lần cho cả nhóm. */
    public boolean isAccountLevel() {
        return accountLevel;
    }

    /** "Thử lại ngay" chỉ hợp lệ sau khi nội dung bản nền tảng đã được sửa (đăng y nguyên sẽ lỗi lại). */
    public boolean isRequiresContentChange() {
        return requiresContentChange;
    }

    /** Thử lại thủ công không bao giờ thành công (nền tảng/loại tài khoản không hỗ trợ). */
    public boolean isManualRetryBlocked() {
        return this == MEDIA_REQUIRED || this == ACCOUNT_TYPE_UNSUPPORTED || this == PLATFORM_UNSUPPORTED;
    }

    /** AI sửa bài (FR đợt 2 — A1): chỉ lỗi do NỘI DUNG (vi phạm chính sách, nhóm CONTENT). */
    public boolean isAiFixable() {
        return this == POLICY_VIOLATION || category == PublishErrorCategory.CONTENT;
    }

    public List<PublishErrorAction> actions() {
        return actions;
    }

    /** Đọc tên mã đã lưu; giá trị lạ / null → null (để caller chuẩn hoá lại thay vì nổ). */
    public static PublishErrorCode parse(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        try {
            return valueOf(name.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
