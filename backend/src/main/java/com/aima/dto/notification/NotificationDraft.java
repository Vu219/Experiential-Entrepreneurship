package com.aima.dto.notification;

import com.aima.enums.NotificationRefType;
import com.aima.enums.NotificationType;
import lombok.Builder;

import java.util.Map;
import java.util.UUID;

/**
 * Một thông báo sắp phát (API nội bộ {@code NotificationService.send}). {@code title}/{@code message} là câu tiếng Việt
 * dự phòng (bản ghi cũ, email, FE cũ); FE mới dựng câu từ {@code type} + {@code params} theo ngôn ngữ người dùng (D5).
 *
 * @param dedupeKey không null → tối đa MỘT bản ghi cho khoá này (unique index); với {@code sendToAdmins} khoá được thêm
 *                  hậu tố id admin
 */
@Builder
public record NotificationDraft(
        NotificationType type,
        String title,
        String message,
        NotificationRefType refType,
        UUID refId,
        Map<String, Object> params,
        String dedupeKey
) {
}
