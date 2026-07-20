package com.aima.entity;

import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Một hành động NGHIỆP VỤ của người dùng/admin — nguồn cho tab "Log hoạt động người dùng"
 * (/admin/logs?tab=activity). Bảng RIÊNG, KHÔNG dùng chung {@code system_logs}: log lỗi là
 * sự cố kỹ thuật, còn bảng này là dấu vết nghiệp vụ; trộn chung thì cả hai đều khó đọc và
 * không đặt được retention khác nhau.
 *
 * <p><b>Append-only + HARD DELETE theo retention</b> (LogRetentionJob) — cùng ngoại lệ đã chốt
 * với {@code ai_usage}: dữ liệu vết, không phải dữ liệu nghiệp vụ cần khôi phục. Cột
 * {@code deleted_at} thừa hưởng từ {@link BaseEntity} không được dùng.
 *
 * <p><b>{@code userId} cố tình KHÔNG phải quan hệ JPA/khoá ngoại</b> tới {@code users}: xoá tài
 * khoản theo GDPR là hard delete, FK sẽ chặn hoặc kéo mất luôn dòng log. Lưu UUID trần +
 * {@code userEmailSnapshot} để log vẫn đọc được sau khi user biến mất.
 */
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "activity_logs", indexes = {
        @Index(name = "idx_activity_logs_created_at", columnList = "created_at DESC"),
        @Index(name = "idx_activity_logs_user_created", columnList = "user_id, created_at DESC"),
        @Index(name = "idx_activity_logs_action_created", columnList = "action, created_at DESC")
})
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ActivityLog extends BaseEntity {

    /** Chủ thể thực hiện hành động. null = hành động hệ thống (job nền). Không phải FK — xem javadoc lớp. */
    @Column(name = "user_id")
    UUID userId;

    /** Email chốt tại thời điểm ghi — log vẫn đọc được sau khi user bị xoá. */
    @Column(name = "user_email_snapshot", length = 255)
    String userEmailSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 40)
    ActivityAction action;

    /** Loại đối tượng bị tác động, vd "ContentItem", "User", "Plan". null = hành động không có đối tượng. */
    @Column(name = "target_type", length = 60)
    String targetType;

    /**
     * Định danh đối tượng bị tác động. Kiểu chuỗi (không phải UUID) vì có đối tượng định danh
     * bằng mã nghiệp vụ chứ không phải id — vd planCode "PRO", platform "FACEBOOK".
     */
    @Column(name = "target_id", length = 100)
    String targetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "result", nullable = false, length = 10)
    ActivityResult result;

    @Column(name = "ip", length = 45)
    String ip;

    @Column(name = "user_agent", length = 300)
    String userAgent;

    /**
     * Ngữ cảnh bổ sung dạng JSON (request id, giá trị trước/sau khi đổi, lý do thất bại…).
     * Bị CẮT ở {@code ActivityLogServiceImpl.MAX_METADATA_LENGTH} — không để một payload
     * bất thường thổi phồng bảng.
     */
    @Column(name = "metadata", columnDefinition = "text")
    String metadata;
}
