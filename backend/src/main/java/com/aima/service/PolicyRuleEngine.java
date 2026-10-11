package com.aima.service;

import com.aima.enums.PolicyRiskLevel;

import java.util.List;

/**
 * Tầng 1 kiểm tra chính sách — bộ luật/từ khoá MIỄN PHÍ (không gọi AI) đọc từ file cấu hình
 * ({@code aima.ai-assist.policy-check.rules-location}, mặc định {@code classpath:policy/policy-check-rules.json}).
 * Chỉ tạo nghi vấn: kết quả dùng để cảnh báo và quyết định có cần gọi AI (tầng 2) hay không — không chặn đăng.
 */
public interface PolicyRuleEngine {

    /** Mọi luật khớp nội dung (mỗi luật tối đa một đoạn trích), giữ thứ tự trong file. */
    List<Hit> check(String text);

    /** Một nghi vấn: luật nào, nhóm nào, mức độ và đoạn văn gốc (giữ dấu) đã khớp. */
    record Hit(String ruleId, String category, PolicyRiskLevel severity, String excerpt) {
    }

    /** Mức cao nhất trong các nghi vấn; không có nghi vấn → NONE. */
    static PolicyRiskLevel maxSeverity(List<Hit> hits) {
        PolicyRiskLevel max = PolicyRiskLevel.NONE;
        for (Hit hit : hits) {
            if (hit.severity().ordinal() > max.ordinal()) {
                max = hit.severity();
            }
        }
        return max;
    }
}
