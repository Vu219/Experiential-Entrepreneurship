package com.aima.dto.response;

import com.aima.enums.UsageAlertRule;
import com.aima.enums.UsageAlertSeverity;
import com.aima.enums.UsageAlertStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/** Một cảnh báo bất thường usage (tab Tổng quan + banner trang chi tiết user). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UsageAlertResponse {

    UUID id;

    UsageAlertRule ruleCode;

    UsageAlertSeverity severity;

    /** null = alert cấp hệ thống (R5/R9). */
    UUID userId;

    String userEmail;

    String message;

    /** JSON số liệu lúc phát hiện — ngữ cảnh để admin phán đoán báo nhầm. */
    String data;

    UsageAlertStatus status;

    Long occurrenceCount;

    LocalDateTime firstSeen;

    LocalDateTime lastSeen;

    Boolean falsePositive;

    String ackedByEmail;

    LocalDateTime ackedAt;
}
