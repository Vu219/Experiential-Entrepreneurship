package com.aima.service;

import com.aima.entity.User;
import com.aima.enums.AiTaskCode;

/**
 * Ghi bản ghi ai_usage chi tiết theo từng lần gọi AI (bổ sung cho TokenUsageService —
 * tổng quota theo tháng). CHỈ ghi khi config DB đang hiệu lực cho task (biết chắc
 * provider/model nào chạy); đường env không ghi vì backend không biết model phía AI service.
 */
public interface AiUsageService {

    /** Best-effort: lỗi chỉ log, không bao giờ ném ra (không phá worker AI). */
    void record(User user, AiTaskCode taskCode, Long totalTokens);
}
