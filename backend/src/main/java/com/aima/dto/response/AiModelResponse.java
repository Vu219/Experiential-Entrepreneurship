package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiModelResponse {

    UUID id;

    UUID providerId;

    String providerCode;

    String modelCode;

    String displayName;

    Boolean enabled;

    BigDecimal inputPricePer1m;

    BigDecimal outputPricePer1m;

    /** Trần max_tokens tham khảo của model (null = không rõ) — chỉ để FE gợi ý/cảnh báo. */
    Integer maxTokens;
    /** Kết quả "Kiểm tra model" gần nhất: "ok" / loại lỗi của AI service; null = chưa kiểm tra. */
    String lastProbeStatus;
    LocalDateTime lastProbedAt;

    /** Các nghiệp vụ (AiTaskCode) đang dùng model này làm chính/dự phòng — cảnh báo tắt/xóa. */
    List<String> usedByTaskCodes;
}
