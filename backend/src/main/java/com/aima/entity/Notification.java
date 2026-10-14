package com.aima.entity;

import com.aima.enums.NotificationRefType;
import com.aima.enums.NotificationType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * In-app notification for a user (FR-75..FR-79). Not in DATA_MODEL.md's entity list —
 * added for section 14; keeps only what the notification list UI needs.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notifications")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Notification extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    NotificationType type;

    @Column(name = "title", nullable = false, length = 255)
    String title;

    @Column(name = "message", columnDefinition = "text")
    String message;

    // Id của đối tượng liên quan (post/content item/platform account...) để FE điều hướng.
    @Column(name = "ref_id")
    UUID refId;

    @Column(name = "read_at")
    LocalDateTime readAt;

    /** Đối tượng mà {@link #refId} trỏ tới (deep link). Null với bản ghi trước V17. */
    @Enumerated(EnumType.STRING)
    @Column(name = "ref_type", length = 30)
    NotificationRefType refType;

    /** Tham số dựng câu theo ngôn ngữ ở FE (khoá {@code ntf_<TYPE>_*}), JSON object. Null = chỉ có title/message. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "params", columnDefinition = "jsonb")
    String params;

    /** Khóa chống gửi lặp (unique khi khác null) — vd nhắc lịch tạm giữ đã quá giờ chỉ gửi một lần. */
    @Column(name = "dedupe_key", length = 200)
    String dedupeKey;
}
