package com.aima.dto.ai;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Mirrors ai/src/schemas.py LlmConfig — định tuyến model theo request từ bảng ai_task_routing.
 * Chỉ được gắn vào payload khi {@code ai-config.from-db=true} và routing/provider hiệu lực
 * (AiRuntimeConfigService); vắng mặt = AI service dùng env của nó (đường rollback).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LlmConfigPayload {

    LlmSpecPayload primary;

    /**
     * LEGACY: luôn = {@code fallbacks[0]} (hoặc null) — AI service bản cũ chỉ đọc trường này.
     * Dựng qua {@code AiConfigMapper.toLlmConfig(primary, fallbacks)} để hai trường không lệch.
     */
    LlmSpecPayload fallback;

    /** Chuỗi dự phòng theo thứ tự thử (đã bỏ model tắt/thiếu key/đang nghỉ). */
    List<LlmSpecPayload> fallbacks;
}
