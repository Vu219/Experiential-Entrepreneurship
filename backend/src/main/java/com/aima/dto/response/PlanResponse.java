package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanResponse", description = "Một gói dịch vụ (đủ song ngữ — FE chọn theo ngôn ngữ đang bật).")
public class PlanResponse {

    UUID id;

    @Schema(example = "FREE")
    String code;

    String nameVi;
    String nameEn;

    @Schema(description = "Giá VND / chu kỳ. 0 = miễn phí.", example = "499000")
    Long price;

    @Schema(description = "Nhãn chu kỳ để HIỂN THỊ cạnh giá — không dùng để tính toán.")
    String billingCycleVi;
    String billingCycleEn;

    @Schema(description = "Chu kỳ thanh toán THẬT (tháng) — quy giá về doanh thu định kỳ tháng: "
            + "tháng = 1, quý = 3, năm = 12.", example = "1")
    Short billingIntervalMonths;

    @Schema(description = "Hạn mức token mô tả để hiển thị. null = không giới hạn.", example = "100")
    Long tokenQuota;

    @Schema(description = "Hạn mức token LLM THẬT mỗi tháng. null = không giới hạn.", example = "100000")
    Long monthlyTokenLimit;

    @Schema(description = "Lượt AI kiểm tra chính sách mỗi tháng. null = mặc định hệ thống, -1 = không giới hạn, "
            + "0 = tắt (chỉ bộ lọc tự động).", example = "30")
    Integer policyCheckAiMonthlyLimit;

    @Schema(description = "Số lần AI sửa bài tối đa mỗi bản nền tảng. null = mặc định hệ thống, -1 = không giới hạn, "
            + "0 = tắt.", example = "3")
    Integer aiFixMaxPerVersion;

    @Schema(description = "Giới hạn tính năng theo gói (giá trị thô).")
    PlanFeatureLimitsResponse featureLimits;

    String descriptionVi;
    String descriptionEn;

    List<String> featuresVi;
    List<String> featuresEn;

    List<String> teaserFeaturesVi;
    List<String> teaserFeaturesEn;

    String ctaVi;
    String ctaEn;

    Boolean highlight;
    Integer displayOrder;
    Boolean isActive;

    @Schema(description = "true với 3 gói lõi FREE/PLUS/PRO — không cho sửa code / xóa.")
    boolean core;
}
