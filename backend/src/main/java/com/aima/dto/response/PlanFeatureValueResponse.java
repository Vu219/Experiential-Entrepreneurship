package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureValueResponse")
public class PlanFeatureValueResponse {

    @Schema(example = "FREE")
    String planCode;

    @Schema(description = "Ô dạng tick: true = ✓, false = —; null = dùng text.")
    Boolean boolValue;

    String textVi;
    String textEn;
}
