package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/** Lượt AI hỗ trợ chính sách theo gói của user (Cài đặt → Đăng bài). Giới hạn null = không giới hạn, 0 = gói không gồm. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiAssistUsageResponse {

    @Schema(description = "Mã gói đang áp giới hạn (null = chưa có gói → mặc định hệ thống).", example = "PLUS")
    String planCode;

    @Schema(description = "Lượt AI kiểm tra chính sách đã dùng trong tháng (job lỗi không tính).", example = "3")
    long policyCheckAiUsed;

    @Schema(description = "Lượt AI kiểm tra chính sách mỗi tháng. null = không giới hạn, 0 = gói không gồm.", example = "30")
    Long policyCheckAiLimit;

    @Schema(description = "Số lần AI sửa tối đa mỗi bản nền tảng. null = không giới hạn, 0 = gói không gồm.", example = "3")
    Long aiFixMaxPerVersion;

    @Schema(description = "Mốc lượt AI kiểm tra được làm mới (đầu tháng sau).")
    LocalDateTime resetAt;
}
