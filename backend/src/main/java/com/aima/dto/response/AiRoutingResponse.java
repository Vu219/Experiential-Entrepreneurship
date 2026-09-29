package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiRoutingResponse {

    UUID id;

    String taskCode;

    UUID primaryModelId;

    String primaryModelCode;

    String primaryProviderCode;

    /** LEGACY: = fallbacks[0] (client cũ đọc bộ ba fallbackModel*). */
    UUID fallbackModelId;

    String fallbackModelCode;

    String fallbackProviderCode;

    /** Chuỗi dự phòng theo thứ tự thử (rỗng = không dùng dự phòng). */
    List<AiRoutingFallbackResponse> fallbacks;

    Double temperature;

    Integer maxTokens;

    Boolean enabled;
}
