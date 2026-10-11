package com.aima.enums;

/** Loại tác vụ AI hỗ trợ chính sách (bảng {@code ai_assist_jobs}). */
public enum AiAssistKind {
    /** AI gợi ý sửa caption/hashtag của bài vi phạm — người dùng xem diff rồi tự áp dụng. */
    POLICY_FIX,
    /** AI đánh giá rủi ro chính sách (tầng 2) — chỉ khi bộ luật miễn phí có nghi vấn. */
    POLICY_CHECK
}
