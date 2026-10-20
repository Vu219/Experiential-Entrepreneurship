package com.aima.dto.response;

import com.aima.enums.PlanLimitKey;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** {@code result} của lỗi PLAN_LIMIT_REACHED / PLAN_FEATURE_NOT_INCLUDED — giới hạn nào, hạn mức và số đã dùng. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanLimitViolationResponse", description = "Chi tiết giới hạn gói bị vượt.")
public class PlanLimitViolationResponse {

    PlanLimitKey limitKey;

    @Schema(description = "Hạn mức hiệu lực (0 = tính năng không có trong gói).", example = "3")
    Long limit;

    @Schema(description = "Số đã dùng (QUOTA) hoặc giá trị bị từ chối (CAP); null với FLAG.", example = "3")
    Long used;

    @Schema(description = "Mã gói hiện tại.", example = "FREE")
    String planCode;
}
