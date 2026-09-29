package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Body lỗi 502 của AI service khi CẢ chuỗi model thất bại (ai/src/api/routes.py {@code _run}):
 * {@code {"detail": {"error_code", "message", "attempts"}}}. Lỗi khác có {@code detail} là chuỗi
 * → không parse được thành payload này (bỏ qua).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiErrorResponsePayload {

    Detail detail;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Detail {

        @JsonProperty("error_code")
        String errorCode;

        String message;

        List<LlmAttemptPayload> attempts;
    }
}
