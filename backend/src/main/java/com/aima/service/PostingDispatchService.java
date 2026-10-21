package com.aima.service;

import com.aima.enums.HoldReason;

import java.util.UUID;

/**
 * Claim MỘT lịch để đăng: dùng chung cho dispatcher theo lịch (PostingDispatchJob) và "Đăng ngay" (HTTP) —
 * cùng khóa bài, cùng chốt chặn tạm giữ, cùng claim có điều kiện SCHEDULED → POSTING, cùng snapshot nội dung.
 * Chạy trong transaction của caller; caller giao worker SAU khi commit (rule #28).
 *
 * <p>⚠️ Claim dùng bulk update có {@code clearAutomatically} — entity caller đã nạp trong transaction bị
 * detach; nạp lại nếu cần dùng tiếp.
 */
public interface PostingDispatchService {

    /** @return jobId khi đã tạo job; heldFor khi lịch bị tạm giữ thay vì đăng; cả hai null = lịch không còn để claim. */
    record Outcome(UUID jobId, HoldReason heldFor) {
    }

    /** Dispatcher theo lịch: kiểm cả quyền "lên lịch" (SCHEDULING) của gói hiện tại. */
    default Outcome dispatch(UUID scheduleId) {
        return dispatch(scheduleId, false);
    }

    /**
     * @param immediate true = user bấm đăng ngay / thử lại — không cần chế độ lên lịch của gói (gói tắt SCHEDULING vẫn
     *                  "Đăng ngay" được); nền tảng khoá / không thuộc gói vẫn bị chặn.
     */
    Outcome dispatch(UUID scheduleId, boolean immediate);
}
