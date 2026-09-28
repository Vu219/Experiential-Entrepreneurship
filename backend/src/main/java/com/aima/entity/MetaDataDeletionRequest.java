package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Một yêu cầu xoá dữ liệu Meta gửi qua Data Deletion Callback. Chỉ giữ mã xác nhận + kết quả
 * để trang /data-deletion?code= tra cứu — CỐ Ý không lưu user_id của Meta (dữ liệu vừa được yêu
 * cầu xoá). Yêu cầu xử lý đồng bộ ngay trong callback nên bản ghi tạo ra đã hoàn tất;
 * {@code created_at} là thời điểm yêu cầu.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "meta_data_deletion_requests")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MetaDataDeletionRequest extends BaseEntity {

    @Column(name = "confirmation_code", nullable = false, unique = true, length = 40)
    String confirmationCode;

    // Số kết nối (Facebook user + Trang + Instagram con) đã bị xoá mềm + xoá token.
    @Column(name = "connections_removed", nullable = false)
    int connectionsRemoved;

    // Số lịch SCHEDULED chuyển sang ON_HOLD.
    @Column(name = "schedules_held", nullable = false)
    int schedulesHeld;

    @Column(name = "completed_at")
    LocalDateTime completedAt;
}
