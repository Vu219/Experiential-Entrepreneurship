package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanCreateRequest", description = "Tạo gói dịch vụ mới (ngoài 3 gói lõi FREE/PLUS/PRO).")
public class PlanCreateRequest {

    @NotBlank(message = "PLAN_CODE_REQUIRED")
    @Schema(description = "Mã gói — duy nhất, viết hoa, không đổi được sau khi tạo.", example = "TEAM")
    String code;

    @NotBlank(message = "PLAN_NAME_REQUIRED")
    @Schema(description = "Tên gói (tiếng Việt).", example = "Team")
    String nameVi;

    @NotBlank(message = "PLAN_NAME_REQUIRED")
    @Schema(description = "Tên gói (tiếng Anh).", example = "Team")
    String nameEn;

    @NotNull(message = "PLAN_PRICE_INVALID")
    @Min(value = 0, message = "PLAN_PRICE_INVALID")
    @Schema(description = "Giá VND / chu kỳ. 0 = miễn phí.", example = "999000")
    Long price;

    @Schema(description = "Nhãn chu kỳ (vi), vd \"/tháng\" hoặc \"trọn đời\".", example = "/tháng")
    String billingCycleVi;

    @Schema(description = "Nhãn chu kỳ (en).", example = "/month")
    String billingCycleEn;

    @Schema(description = "Hạn mức token mô tả để hiển thị (chưa phải số dư thật). null = không giới hạn.", example = "500")
    Long tokenQuota;

    String descriptionVi;
    String descriptionEn;

    @Schema(description = "Bullet list trên card gói (vi) — mỗi phần tử một dòng.")
    List<String> featuresVi;
    List<String> featuresEn;

    @Schema(description = "2–3 dòng rút gọn cho teaser ở landing (vi).")
    List<String> teaserFeaturesVi;
    List<String> teaserFeaturesEn;

    @Schema(description = "Nhãn nút CTA (vi).", example = "Chọn Team")
    String ctaVi;
    String ctaEn;

    @Schema(description = "Gói nổi bật (badge + viền gradient).", example = "false")
    Boolean highlight;

    Integer displayOrder;

    @Schema(description = "Hiển thị công khai trên landing.", example = "true")
    Boolean isActive;
}
