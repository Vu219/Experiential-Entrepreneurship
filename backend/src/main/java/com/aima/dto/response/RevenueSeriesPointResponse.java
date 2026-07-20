package com.aima.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/** Một cột của chart "Doanh thu theo thời gian". Kỳ không có giao dịch vẫn xuất hiện với giá trị 0. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "RevenueSeriesPointResponse", description = "Một bucket thời gian của chart doanh thu.")
public class RevenueSeriesPointResponse {

    @Schema(description = "Nhãn trục X đã dựng sẵn theo chế độ lọc (vd '5' cho ngày, '03/2026' cho tháng, '2025' cho năm).")
    String label;

    @Schema(description = "Mốc đầu bucket (giờ VN) — FE dùng khi cần định dạng lại nhãn theo ngôn ngữ.")
    LocalDateTime bucket;

    @Schema(description = "Doanh thu NET của bucket (VND).")
    Long revenue;

    @Schema(description = "Tổng đã thu của bucket trước khi trừ hoàn tiền (VND).")
    Long gross;

    @Schema(description = "Hoàn tiền phát sinh trong bucket (VND).")
    Long refunded;

    @Schema(description = "Số giao dịch đã thu được tiền trong bucket.")
    Long transactions;
}
