package com.aima.entity;

import com.aima.enums.ScheduleStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Schedule for publishing one {@link ContentVersion} to one {@link PlatformAccount}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "post_schedules")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PostSchedule extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "content_version_id", nullable = false, unique = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentVersion contentVersion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "platform_account_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PlatformAccount platformAccount;

    @Column(name = "scheduled_time", nullable = false)
    Instant scheduledTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    ScheduleStatus status;

    @OneToOne(mappedBy = "schedule", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Post post;

    /** Các lý do tạm giữ hiện hành (ScheduleHoldService là nơi duy nhất thêm/gỡ). */
    @OneToMany(mappedBy = "schedule", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<PostScheduleHold> holds = new ArrayList<>();
}
