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

    String billingCycleVi;
    String billingCycleEn;

    @Schema(description = "Hạn mức token mô tả để hiển thị. null = không giới hạn.", example = "100")
    Long tokenQuota;

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
