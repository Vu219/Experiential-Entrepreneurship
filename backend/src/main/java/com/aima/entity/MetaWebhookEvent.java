package com.aima.entity;

import com.aima.enums.WebhookEventStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Một thay đổi ({@code entry[].changes[]}) của webhook Meta (Flyway V9). Lưu trước rồi mới xử lý bất đồng bộ để
 * endpoint trả 200 ngay; {@code dedupeKey} unique chặn xử lý trùng khi Meta gửi lại cùng payload.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "meta_webhook_events")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MetaWebhookEvent extends BaseEntity {

    @Column(name = "dedupe_key", nullable = false, length = 64, unique = true)
    String dedupeKey;

    /** entry.id — với object "page" là id Trang. */
    @Column(name = "page_id", length = 100)
    String pageId;

    /** changes[].field, ví dụ "feed". */
    @Column(name = "field", length = 50)
    String field;

    /** value.item: status/post/photo/video/comment/reaction/share/like... */
    @Column(name = "item", length = 30)
    String item;

    /** value.verb: add/edited/remove/hide/unhide... */
    @Column(name = "verb", length = 20)
    String verb;

    /** value.post_id dạng "{pageId}_{postId}". */
    @Column(name = "platform_post_id", length = 255)
    String platformPostId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb")
    String payload;

    @Column(name = "event_time")
    Instant eventTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    WebhookEventStatus status = WebhookEventStatus.PENDING;

    @Column(name = "attempts", nullable = false)
    int attempts;

    @Column(name = "last_error", length = 500)
    String lastError;

    @Column(name = "processed_at")
    Instant processedAt;
}
