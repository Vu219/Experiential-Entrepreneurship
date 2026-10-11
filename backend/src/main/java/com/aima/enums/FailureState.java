package com.aima.enums;

/**
 * Vòng đời của MỘT lần đăng lỗi — chiều SUY RA khi đọc, KHÔNG phải trạng thái bài/lịch
 * (state machine của bài giữ nguyên, root CLAUDE.md §6).
 * <ul>
 *   <li>{@code AUTO_RETRYING}: lịch còn POSTING, job RETRYING chờ chạy lại theo FR-56.</li>
 *   <li>{@code NEEDS_ACTION}: lịch FAILED, lỗi cuối chưa được xử lý.</li>
 *   <li>{@code DISMISSED}: lịch FAILED, người dùng đã bỏ qua lỗi cuối.</li>
 *   <li>{@code RESOLVED}: lịch đã rời FAILED (thử lại, huỷ, đăng thành công).</li>
 * </ul>
 */
public enum FailureState {
    AUTO_RETRYING,
    NEEDS_ACTION,
    DISMISSED,
    RESOLVED
}
