package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.PlanLimitKey;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Một giới hạn của gói user đang dùng: hạn mức hiệu lực + số đã dùng (chỉ QUOTA đếm được ở cấp tài khoản). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureUsageItemResponse")
public class PlanFeatureUsageItemResponse {

    PlanLimitKey key;

    @Schema(description = "QUOTA (đếm) / CAP (trần một giá trị) / FLAG (bật-tắt) / SET (tập nền tảng).", example = "QUOTA")
    PlanLimitKey.Type type;

    @Schema(description = "null = không giới hạn (QUOTA/CAP) hoặc đang bật (FLAG); 0 = tắt.", example = "3")
    Long limit;

    @Schema(description = "Số đã dùng — null nếu không đếm được ở cấp tài khoản (CAP, FLAG, theo từng thương hiệu).",
            example = "1")
    Long used;

    @Schema(description = "Tính năng có trong gói.", example = "true")
    boolean included;

    @Schema(description = "SET (ALLOWED_PLATFORMS): các nền tảng gói cho phép.")
    List<Platform> platforms;

    @Schema(description = "Số đã dùng theo từng phạm vi (STRATEGIES_PER_BRAND: theo thương hiệu).")
    List<PlanFeatureScopeUsageResponse> scopes;
}
