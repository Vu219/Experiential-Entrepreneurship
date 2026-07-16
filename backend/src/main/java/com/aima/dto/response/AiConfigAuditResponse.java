package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/** Một dòng audit cấu hình AI. Snapshot là JSON đã mask key từ lúc ghi — an toàn trả thẳng cho FE. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiConfigAuditResponse {

    UUID id;

    /** Email admin thao tác; null = hệ thống. */
    String actorEmail;

    String action;

    String entityType;

    UUID entityId;

    String beforeSnapshot;

    String afterSnapshot;

    LocalDateTime createdAt;
}
