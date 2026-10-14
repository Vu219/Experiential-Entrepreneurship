package com.aima.entity;

import com.aima.enums.EmailPromptStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Đồng ý nhận email lỗi đăng bài (opt-in, mặc định KHÔNG). Thiếu dòng = mặc định (user tạo sau V14 —
 * dòng được tạo khi lưu lần đầu). Email: chỉ {@code PublishFailureNotifierImpl} đọc để quyết định gửi; kênh trong app/toast: {@code NotificationServiceImpl}.
 */
@Entity
@Table(name = "user_notification_preferences")
@Getter
@Setter
@NoArgsConstructor
public class UserNotificationPreference {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "email_publish_errors", nullable = false)
    private boolean emailPublishErrors;

    @Enumerated(EnumType.STRING)
    @Column(name = "email_prompt_status", nullable = false, length = 20)
    private EmailPromptStatus emailPromptStatus = EmailPromptStatus.NOT_ASKED;

    /** Lúc người dùng đồng ý (null khi chưa/không còn đồng ý). */
    @Column(name = "consent_at")
    private Instant consentAt;

    /**
     * Kênh theo nhóm, JSON {@code {"PUBLISHING":{"inApp":true,"toast":false}}} — khoá thiếu = mặc định của
     * {@code NotificationCategory}; đọc/ghi qua {@code util/NotificationChannelPolicy}.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "channels", columnDefinition = "jsonb", nullable = false)
    private String channels = "{}";

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
