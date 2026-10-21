package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Admin mở/khoá liên kết một nền tảng toàn hệ thống. Khoá bắt buộc có lý do VI + EN (hiển thị cho người dùng). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlatformAvailabilityRequest", description = "Mở/khoá liên kết nền tảng toàn hệ thống.")
public class PlatformAvailabilityRequest {

    @NotNull(message = "PLATFORM_AVAILABILITY_ENABLED_REQUIRED")
    @Schema(description = "true = mở, false = khoá", example = "false", requiredMode = Schema.RequiredMode.REQUIRED)
    Boolean enabled;

    @Size(max = 300, message = "PLATFORM_LOCK_REASON_TOO_LONG")
    @Schema(description = "Lý do hiển thị cho người dùng (tiếng Việt) — bắt buộc khi khoá.", example = "Đang hoàn thiện tích hợp")
    String reasonVi;

    @Size(max = 300, message = "PLATFORM_LOCK_REASON_TOO_LONG")
    @Schema(description = "Lý do hiển thị cho người dùng (tiếng Anh) — bắt buộc khi khoá.", example = "Integration in progress")
    String reasonEn;
}
