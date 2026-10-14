package com.aima.dto.realtime;

import com.aima.dto.response.NotificationResponse;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Payload SSE {@code notification.created} (live hoặc phát bù khi nối lại). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NotificationCreatedEvent {

    NotificationResponse notification;

    /** Số chưa đọc sau khi tạo (đếm trong cùng transaction) — badge chuông lấy luôn, không cần gọi API. */
    long unreadCount;

    /** Cài đặt của user cho nhóm này có bật toast không (FE còn kiểm tra tab đang hiển thị). Phát bù = false. */
    boolean toast;
}
