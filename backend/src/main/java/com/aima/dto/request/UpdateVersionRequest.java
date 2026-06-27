package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Payload admin cập nhật version API cho một nền tảng.
 * Format hợp lệ: "v" + số.số, vd v25.0, v1.0, v20.10.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "UpdateVersionRequest", description = "Cập nhật version API nền tảng.")
public class UpdateVersionRequest {

    @NotBlank(message = "VERSION_REQUIRED")
    @Pattern(regexp = "^v\\d+\\.\\d+$", message = "INVALID_VERSION_FORMAT")
    @Schema(description = "Version mới, vd v25.0", example = "v25.0", requiredMode = Schema.RequiredMode.REQUIRED)
    String newVersion;

    @Schema(description = "Ghi chú cho lần đổi version.", example = "Nâng cấp lên Graph API v25.0")
    String notes;
}
