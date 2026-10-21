package com.aima.dto.response;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/** Trạng thái mở/khoá một nền tảng (admin) kèm mức ảnh hưởng nếu khoá. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlatformAvailabilityResponse", description = "Trạng thái liên kết nền tảng toàn hệ thống (admin).")
public class PlatformAvailabilityResponse {
    Platform platform;
    boolean connectionEnabled;
    String reasonVi;
    String reasonEn;
    String updatedByEmail;
    LocalDateTime statusChangedAt;

    @Schema(description = "Số kênh đăng (không tính kết nối USER gốc) đang kết nối trên nền tảng.", example = "12")
    long connectedAccounts;

    @Schema(description = "Số lịch chưa đăng (SCHEDULED/ON_HOLD) của các kênh trên nền tảng.", example = "30")
    long pendingSchedules;

    @Schema(description = "Số lịch vừa chuyển sang Tạm giữ (chỉ có trong response của lần khoá).", example = "18")
    Integer heldSchedules;
}
