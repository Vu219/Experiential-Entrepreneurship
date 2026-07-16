package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

/**
 * Tổng hợp usage AI một tháng (trang "Sử dụng & chi phí"). Chỉ gồm dữ liệu ghi khi
 * config DB hiệu lực; chi phí là ƯỚC TÍNH theo đơn giá trên ai_models.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiUsageSummaryResponse {

    /** "YYYY-MM". */
    String month;

    Long totalTokens;

    BigDecimal estimatedCost;

    List<AiUsageByTaskResponse> byTask;

    List<AiUsageByModelResponse> byModel;
}
