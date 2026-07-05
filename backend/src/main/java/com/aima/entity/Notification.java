package com.aima.entity;

import com.aima.enums.NotificationType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

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
}
