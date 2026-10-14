package com.aima.exception;

import com.aima.dto.ai.TokenAccountedPayload;
import lombok.Getter;

/**
 * Luồng AI bị dừng giữa chừng vì user bấm Dừng ({@code AiServiceClient.generateContentStream}). Mang usage một phần để
 * {@code AiUsageService.recordCall} ghi {@code ai_usage.status = CANCELLED} (input thật + output ước lượng — D4).
 * Chỉ dùng trong worker, không lọt ra luồng HTTP.
 */
@Getter
public class AiStreamCancelledException extends RuntimeException {

    private final transient TokenAccountedPayload partialUsage;

    public AiStreamCancelledException(TokenAccountedPayload partialUsage) {
        super("AI stream cancelled by user");
        this.partialUsage = partialUsage;
    }
}
