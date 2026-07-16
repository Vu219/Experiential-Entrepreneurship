package com.aima.dto.ai;

/**
 * Payload AI có thể nhận llm_config (định tuyến model theo DB). Các payload request
 * implement interface này (Lombok @Data tự sinh getter/setter thoả interface);
 * AiServiceClientImpl gắn config qua đây ngay trước khi gửi — worker không phải sửa.
 */
public interface LlmRoutedPayload {

    LlmConfigPayload getLlmConfig();

    void setLlmConfig(LlmConfigPayload llmConfig);
}
