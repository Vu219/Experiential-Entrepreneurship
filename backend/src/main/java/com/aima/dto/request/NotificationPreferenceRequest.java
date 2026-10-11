package com.aima.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Bật/tắt email lỗi đăng bài — từ banner hỏi ở trang Bài lỗi hoặc Cài đặt → Thông báo (cả hai đều tính là đã trả lời). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NotificationPreferenceRequest {
    @NotNull(message = "INVALID_REQUEST")
    Boolean emailPublishErrors;
}
