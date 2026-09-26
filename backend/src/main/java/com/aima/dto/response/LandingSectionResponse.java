package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.Map;

/** Một section Landing Page cho trang admin: bản nháp + bản đang hiển thị + cờ chưa xuất bản. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "LandingSectionResponse")
public class LandingSectionResponse {

    @Schema(example = "hero")
    String key;

    Map<String, Object> draft;

    Map<String, Object> published;

    @Schema(description = "Bản nháp khác bản đang hiển thị trên landing.")
    boolean hasUnpublishedChanges;

    Long version;

    LocalDateTime updatedAt;

    String updatedBy;

    LocalDateTime publishedAt;

    String publishedBy;
}
