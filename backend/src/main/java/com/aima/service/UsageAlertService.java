package com.aima.service;

import com.aima.dto.request.AckAlertRequest;
import com.aima.dto.response.AlertRuleStatResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.UsageAlertResponse;
import com.aima.enums.UsageAlertStatus;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cảnh báo bất thường usage — PHA 5A: CHỈ cảnh báo, không tự chặn (đo tỉ lệ báo nhầm từng
 * rule trước khi cân nhắc 5B). 9 rule chạy nền 5 phút ({@code UsageAlertJob} gọi
 * {@link #runDetection}); NGƯỠNG đọc từ bảng {@code system_config} (key prefix "alert.",
 * cache 60s, chỉnh qua API không cần deploy). Chống bão: cùng (rule, đối tượng) đang OPEN
 * → update occurrence_count; sau ACK có cooldown.
 */
public interface UsageAlertService {

    /** GET /admin/usage/alerts — R8 tự ẩn với CHÍNH admin bị giám sát ({@code viewerEmail}). */
    ApiResponse<List<UsageAlertResponse>> list(String viewerEmail, UsageAlertStatus status, UUID userId);

    /** POST /admin/usage/alerts/{id}/ack — đặt cooldown + cờ báo nhầm; ghi audit system_logs. */
    ApiResponse<UsageAlertResponse> ack(String actorEmail, UUID alertId, AckAlertRequest request);

    /** GET /admin/usage/alerts/stats — báo cáo đo báo nhầm theo rule (căn cứ lên 5B). */
    ApiResponse<List<AlertRuleStatResponse>> stats();

    /** GET /admin/usage/alert-config — ngưỡng hiện hành (default phủ bởi system_config). */
    ApiResponse<Map<String, String>> getConfig();

    /** PUT /admin/usage/alert-config — ghi đè ngưỡng vào system_config (chỉ key hợp lệ); audit. */
    ApiResponse<Map<String, String>> updateConfig(String actorEmail, Map<String, String> changes);

    /** Chạy cả 9 rule một lượt (scheduler gọi) — mỗi rule lỗi riêng chỉ log, không phá lượt quét. */
    void runDetection();
}
