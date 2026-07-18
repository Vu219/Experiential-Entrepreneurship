package com.aima.dto.response;

import com.aima.enums.AiTaskCode;
import com.aima.enums.BillingUnitType;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Một version hệ số quy đổi hạn mức (tab "Hệ số quy đổi" trang admin Token & hạn mức). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BillingRateResponse {

    UUID id;

    /** null = mọi nghiệp vụ. */
    AiTaskCode taskCode;

    /** null = mọi model. */
    String modelCode;

    BillingUnitType unitType;

    BigDecimal multiplier;

    Long minCharge;

    LocalDateTime effectiveFrom;

    /** null = đang hiệu lực. */
    LocalDateTime effectiveTo;

    String createdByEmail;

    LocalDateTime createdAt;
}
