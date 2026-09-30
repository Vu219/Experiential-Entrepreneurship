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

    Outcome dispatch(UUID scheduleId);
}
