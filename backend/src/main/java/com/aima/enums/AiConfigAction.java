package com.aima.enums;

/**
 * Loại thao tác ghi vào audit log cấu hình AI ({@code ai_config_audit}).
 * Bật/tắt hay đổi key đều là UPDATE — chi tiết nằm ở snapshot before/after (key luôn masked).
 */
public enum AiConfigAction {
    CREATE,
    UPDATE,
    DELETE,
    TEST_CONNECTION,
    SYNC_MODELS,
    /** Admin xoá trạng thái nghỉ (circuit breaker) của các model thuộc provider. */
    RESET_MODEL_HEALTH
}
