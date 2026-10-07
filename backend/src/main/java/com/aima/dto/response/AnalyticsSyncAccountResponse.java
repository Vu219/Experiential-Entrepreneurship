package com.aima.dto.response;

import com.aima.enums.ConnectionStatus;
import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

/** Trạng thái đồng bộ số liệu của MỘT kênh đăng (Page / IG Business / Threads). Không mang token (SEC-03). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsSyncAccountResponse", description = "Trạng thái đồng bộ số liệu của một kênh đăng.")
public class AnalyticsSyncAccountResponse {

    @Schema(description = "Id kết nối (platform_accounts).")
    UUID accountId;

    @Schema(description = "Nền tảng.", example = "FACEBOOK")
    Platform platform;

    @Schema(description = "Tên Page / tài khoản.", example = "AIMA Fanpage")
    String accountName;

    @Schema(description = "Ảnh đại diện; có thể null.")
    String avatarUrl;

    @Schema(description = "Trạng thái kết nối — khác ACTIVE thì không đồng bộ được (cần kết nối lại).", example = "ACTIVE")
    ConnectionStatus status;

    @Schema(description = "Facebook: token có quyền read_insights (đọc lượt xem) hay không; nền tảng khác null.", example = "true")
    Boolean insightsPermission;

    @Schema(description = "Số bài đang được theo dõi số liệu.", example = "12")
    long trackedPosts;

    @Schema(description = "Số bài chưa đồng bộ lần nào (đang chờ lượt quét đầu tiên).", example = "3")
    long pendingPosts;

    @Schema(description = "Số bài đã ngừng theo dõi (xoá trên nền tảng / lỗi quá ngưỡng).", example = "0")
    long stoppedPosts;

    @Schema(description = "Số bài đang lỗi thiếu quyền.", example = "0")
    long permissionErrors;

    @Schema(description = "Lần đồng bộ thành công gần nhất; null khi chưa có.")
    Instant lastSyncedAt;

    @Schema(description = "Lần quét kênh gần nhất (danh sách bài tự đăng + insights Trang); null khi chưa quét / nền tảng "
            + "chưa hỗ trợ. FE dùng cùng lastSyncedAt để biết có số liệu mới mà tự tải lại trang.")
    Instant accountSyncedAt;
}
