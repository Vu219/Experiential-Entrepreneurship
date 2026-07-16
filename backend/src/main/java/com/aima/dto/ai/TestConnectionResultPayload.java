package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py TestConnectionResult — kết quả POST {ai-service}/test-connection.
 * Key sai/hết hạn là KẾT QUẢ (success=false + message), không phải lỗi HTTP.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TestConnectionResultPayload {

    boolean success;

    /** Thông điệp lỗi rút gọn từ provider (đã được phía AI service redact — không chứa key). */
    String message;

    @JsonProperty("latency_ms")
    Long latencyMs;
}
