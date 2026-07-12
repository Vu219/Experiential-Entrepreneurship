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
@Schema(name = "PlanFeatureResponse", description = "Một dòng của bảng so sánh gói + giá trị theo từng gói.")
public class PlanFeatureResponse {

    UUID id;

    String groupVi;
    String groupEn;

    String nameVi;
    String nameEn;

    Integer displayOrder;

    List<PlanFeatureValueResponse> values;
}
