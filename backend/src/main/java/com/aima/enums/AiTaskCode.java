package com.aima.enums;

/**
 * Các nghiệp vụ gọi AI service — mỗi task một dòng định tuyến model trong {@code ai_task_routing}.
 * Khớp các agent hiện có phía {@code ai/src/agents/} + golden hours ({@code /golden-hours}).
 */
public enum AiTaskCode {
    CONTENT_GENERATION,
    PLATFORM_FORMATTING,
    TREND_RESEARCH,
    GOLDEN_HOURS,
    STRATEGY_OPTIMIZATION,
    CONTENT_REGENERATION,
    /** AI sửa bài vi phạm chính sách / nội dung bị từ chối (đợt 2 — A1). */
    POLICY_FIX,
    /** AI kiểm tra chính sách trước khi đăng — chỉ khi bộ luật miễn phí có nghi vấn (A2). */
    POLICY_CHECK
}
