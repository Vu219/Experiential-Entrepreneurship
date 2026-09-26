package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Map;

/** Lưu nháp một section Landing Page. Nội dung validate theo schema của section (LandingContent). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "LandingSectionUpdateRequest", description = "Nội dung nháp mới của section + version đang sửa.")
public class LandingSectionUpdateRequest {

    @NotNull(message = "LANDING_CONTENT_INVALID")
    @Schema(description = "Nội dung section theo schema LandingContent (chữ song ngữ {vi, en}).")
    Map<String, Object> content;

    @NotNull(message = "LANDING_CONTENT_INVALID")
    @Schema(description = "Version admin đã tải về — lệch với DB → 2102 (người khác vừa sửa).", example = "3")
    Long version;
}
