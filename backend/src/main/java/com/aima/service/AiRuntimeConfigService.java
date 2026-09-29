package com.aima.service;

import com.aima.dto.ai.LlmConfigPayload;
import com.aima.entity.AiModel;
import com.aima.enums.AiModelBlockReason;
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

    /** Model primary đang hiệu lực (routed_model_code của ai_usage); null khi config DB không hiệu lực. */
    ActiveModel getActiveModel(AiTaskCode taskCode);

    /**
     * Đơn giá của một model bất kỳ theo mã provider ("google"/"anthropic", không phân biệt hoa
     * thường) + model code — để tính chi phí theo model THỰC SỰ trả lời (llm_attempts "ok"),
     * kể cả model dự phòng hay model env. Model không có trong ai_models → ActiveModel với
     * đơn giá null (cost không ước tính được). Provider lạ → null.
     */
    ActiveModel resolveModel(String provider, String modelCode);

    /** Gọi sau MỌI mutation cấu hình AI để config mới áp dụng ngay. */
    void evictCache();

    /**
     * MỘT nguồn sự thật cho luật "model dùng được trong định tuyến": runtime resolve và
     * effective status trang admin (AiConfigService) đều đi qua đây. null = dùng được;
     * ngược lại là lý do hỏng đầu tiên theo thứ tự: xóa → model tắt → provider tắt →
     * provider thiếu key. Yêu cầu {@code model.getProvider()} đã fetch (dùng các query
     * fetch-join của {@code AiTaskRoutingRepository}).
     */
    AiModelBlockReason blockReason(AiModel model);

    /** Thông tin model đang hiệu lực + đơn giá ước tính (USD/1M token). */
    record ActiveModel(AiProviderCode providerCode, String modelCode,
                       BigDecimal inputPricePer1m, BigDecimal outputPricePer1m) {
    }
}
