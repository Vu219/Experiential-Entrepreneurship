package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Một model đang bị circuit breaker cho nghỉ (trang admin providers) — vd
 * "gemini-3.5-flash: hết quota ngày, reset lúc 14:00". Model không có trong danh sách = khả dụng.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiModelHealthResponse {

    /** "google" / "anthropic" (chữ thường, như llm_config). */
    String provider;

    String model;

    /** COOLDOWN (quá tải / rate limit — nghỉ ngắn) | EXHAUSTED (hết quota ngày). */
    String state;

    /** Loại lỗi gốc từ AI service: daily_quota_exhausted / rate_limited / provider_overloaded. */
    String reason;

    /** Hết nghỉ lúc (giờ ứng dụng). */
    LocalDateTime until;

    /** Lỗi 429 báo quota FreeTier của Google. */
    boolean freeTier;

    LocalDateTime updatedAt;
}
