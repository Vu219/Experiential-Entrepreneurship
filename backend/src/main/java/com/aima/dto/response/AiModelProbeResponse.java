package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Kết quả "Kiểm tra model" của MỘT model đang được định tuyến (trang admin "Model & định tuyến"). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiModelProbeResponse {
    UUID modelId;
    String providerCode;
    String modelCode;
    /** "ok" hoặc loại lỗi của AI service: model_not_found / provider_overloaded / rate_limited / invalid_key… */
    String outcome;
    Integer httpStatus;
    Long latencyMs;
}
