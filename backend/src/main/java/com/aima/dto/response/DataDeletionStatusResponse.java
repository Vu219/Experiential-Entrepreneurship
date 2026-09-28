package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Trạng thái một yêu cầu xoá dữ liệu Meta — trang công khai /data-deletion?code= hiển thị.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "DataDeletionStatusResponse", description = "Trạng thái yêu cầu xoá dữ liệu Meta.")
public class DataDeletionStatusResponse {
    @Schema(description = "Mã xác nhận Meta đã hiển thị cho người dùng.")
    String confirmationCode;

    @Schema(description = "Luôn COMPLETED — yêu cầu được xử lý đồng bộ ngay khi Meta gọi callback.")
    String status;

    LocalDateTime requestedAt;
    LocalDateTime completedAt;

    @Schema(description = "Số kết nối (Facebook, Trang, Instagram) đã xoá.")
    int connectionsRemoved;

    @Schema(description = "Số bài đã lên lịch chuyển sang ON_HOLD.")
    int schedulesHeld;
}
