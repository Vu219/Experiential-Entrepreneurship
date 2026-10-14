package com.aima.dto.request;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.Map;

/**
 * Cập nhật cài đặt thông báo (PATCH ngữ nghĩa — trường null = giữ nguyên):
 * <ul>
 *   <li>{@code emailPublishErrors}: đồng ý nhận email lỗi đăng bài + tài khoản — từ banner trang Bài lỗi hoặc Cài đặt →
 *       Thông báo (cả hai đều tính là đã trả lời).</li>
 *   <li>{@code channels}: kênh theo nhóm, khoá = tên {@code NotificationCategory}.</li>
 * </ul>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NotificationPreferenceRequest {
    Boolean emailPublishErrors;

    @Valid
    Map<String, NotificationChannelRequest> channels;
}
