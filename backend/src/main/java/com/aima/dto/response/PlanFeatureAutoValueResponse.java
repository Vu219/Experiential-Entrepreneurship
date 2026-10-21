package com.aima.dto.response;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Ô tự động của một dòng bảng so sánh liên kết giới hạn — giá trị CÓ CẤU TRÚC, FE dựng chữ theo ngôn ngữ (đơn vị theo
 * khoá giới hạn).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureAutoValueResponse")
public class PlanFeatureAutoValueResponse {

    public enum Kind { NUMBER, UNLIMITED, OFF, ON, PLATFORMS }

    @Schema(example = "PLUS")
    String planCode;

    @Schema(description = "NUMBER (value) / UNLIMITED / OFF / ON / PLATFORMS (platforms).", example = "NUMBER")
    Kind kind;

    @Schema(example = "3")
    Long value;

    @Schema(description = "PLATFORMS: nền tảng gói cho phép; comingSoon = đang khoá toàn hệ thống (FE hiện \"Sắp ra mắt\").")
    List<PlatformCell> platforms;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "PlanFeaturePlatformCell")
    public static class PlatformCell {
        Platform platform;
        boolean comingSoon;
    }
}
