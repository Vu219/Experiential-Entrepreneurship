package com.aima.entity;

import com.aima.enums.HoldReason;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

/**
 * Một lý do tạm giữ của một lịch (unique theo lịch + lý do). Xoá cứng khi được gỡ — đây là trạng thái
 * vận hành, không phải dữ liệu người dùng cần giữ lịch sử.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "post_schedule_holds", uniqueConstraints = @UniqueConstraint(
        name = "uk_post_schedule_holds_schedule_reason", columnNames = {"schedule_id", "reason"}))
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PostScheduleHold {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PostSchedule schedule;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 30)
    HoldReason reason;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;
}
