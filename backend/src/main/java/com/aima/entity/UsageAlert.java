package com.aima.entity;

import com.aima.enums.UsageAlertRule;
import com.aima.enums.UsageAlertSeverity;
import com.aima.enums.UsageAlertStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một cảnh báo bất thường usage (pha 5A — alert-only). CHỐNG BÃO: cùng (rule, user) đang
 * OPEN thì lần vi phạm sau UPDATE dòng cũ ({@code occurrenceCount}++, {@code lastSeen})
 * thay vì insert; sau ACK có {@code cooldownUntil} — hết cooldown rule mới được bắn lại.
 * {@code userId}/{@code userEmail} là snapshot trần (không FK) — alert hệ thống (R5/R9)
 * để null; R8 gắn admin thực hiện. ACK ghi kèm cờ {@code falsePositive} để đo tỉ lệ báo
 * nhầm từng rule (điều kiện quyết định rule nào đủ chín sang 5B tự động chặn).
 */
@Entity
@Table(name = "usage_alerts", indexes = {
        @Index(name = "idx_usage_alerts_status", columnList = "status, last_seen"),
        @Index(name = "idx_usage_alerts_rule_user", columnList = "rule_code, user_id")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UsageAlert extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_code", nullable = false, length = 30)
    UsageAlertRule ruleCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 10)
    UsageAlertSeverity severity;

    /** null = alert cấp hệ thống (R5, R9). */
    @Column(name = "user_id")
    UUID userId;

    /** Snapshot email lúc bắn — sống sót cả khi user bị hard-delete (GDPR). */
    @Column(name = "user_email", length = 200)
    String userEmail;

    @Column(name = "message", nullable = false, length = 500)
    String message;

    /** Số liệu lúc phát hiện (JSON) — giữ ngữ cảnh để admin phán đoán báo nhầm. */
    @Column(name = "data", columnDefinition = "text")
    String data;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    @Builder.Default
    UsageAlertStatus status = UsageAlertStatus.OPEN;

    @Column(name = "occurrence_count", nullable = false)
    @Builder.Default
    Long occurrenceCount = 1L;

    @Column(name = "first_seen", nullable = false)
    LocalDateTime firstSeen;

    @Column(name = "last_seen", nullable = false)
    LocalDateTime lastSeen;

    /** Đặt lúc ACK (= ackedAt + cooldown giờ) — trước mốc này rule không bắn lại cùng đối tượng. */
    @Column(name = "cooldown_until")
    LocalDateTime cooldownUntil;

    /** Admin đánh dấu "báo nhầm" khi ACK — nguồn của báo cáo tỉ lệ FP theo rule. */
    @Column(name = "false_positive")
    Boolean falsePositive;

    @Column(name = "acked_by_email", length = 200)
    String ackedByEmail;

    @Column(name = "acked_at")
    LocalDateTime ackedAt;
}
