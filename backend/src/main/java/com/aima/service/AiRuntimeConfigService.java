package com.aima.service;

import com.aima.dto.ai.LlmConfigPayload;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;

import java.math.BigDecimal;

/**
 * Resolve cấu hình LLM theo DB cho runtime (cache in-process 5 phút, evict khi admin lưu —
 * cùng mẫu {@code PlatformVersionService}). Trả null khi config DB KHÔNG hiệu lực cho task
 * (flag {@code ai-config.from-db} tắt / routing tắt / provider tắt / thiếu key) —
 * caller bỏ qua và AI service chạy bằng env của nó (đường rollback).
 */
public interface AiRuntimeConfigService {

    /** Payload llm_config gắn vào request AI cho task; null = dùng env. */
    LlmConfigPayload getLlmConfig(AiTaskCode taskCode);

    /** Model primary đang hiệu lực (để ghi ai_usage); null khi config DB không hiệu lực. */
    ActiveModel getActiveModel(AiTaskCode taskCode);

    /** Gọi sau MỌI mutation cấu hình AI để config mới áp dụng ngay. */
    void evictCache();

    /** Thông tin model đang hiệu lực + đơn giá ước tính (USD/1M token). */
    record ActiveModel(AiProviderCode providerCode, String modelCode,
                       BigDecimal inputPricePer1m, BigDecimal outputPricePer1m) {
    }
}
