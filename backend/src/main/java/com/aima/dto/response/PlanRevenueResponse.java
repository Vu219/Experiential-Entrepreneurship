package com.aima.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Một lát của donut "Cơ cấu gói dịch vụ". Danh sách gói lấy ĐỘNG từ bảng {@code plans}
 * (LEFT JOIN) nên gói mới admin thêm tự xuất hiện, gói chưa bán được vẫn hiện với số 0.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "PlanRevenueResponse", description = "Doanh thu và số giao dịch của một gói trong kỳ.")
public class PlanRevenueResponse {

    UUID planId;

    String planCode;

    String nameVi;

    String nameEn;

    @Schema(description = "Thứ tự hiển thị của gói — FE sinh màu donut theo thứ tự này.")
    Integer displayOrder;

    @Schema(description = "Doanh thu gộp của gói trong kỳ (VND).")
    Long revenue;

    @Schema(description = "Số giao dịch của gói trong kỳ — tâm donut hiển thị tổng của cột này.")
    Long transactions;

    @Schema(description = "Tỉ lệ % số giao dịch của gói trên tổng toàn kỳ. 0 khi kỳ chưa có giao dịch nào.")
    Double sharePct;
}
