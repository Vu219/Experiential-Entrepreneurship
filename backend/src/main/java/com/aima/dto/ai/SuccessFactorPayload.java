package com.aima.dto.ai;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Mirrors ai/src/schemas.py SuccessFactor — yếu tố tạo hiệu quả kèm bằng chứng (FR-63). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SuccessFactorPayload {

    /** hook | caption | hashtags | cta | media | timing | platform. */
    String factor;

    String finding;

    String confidence;
}
