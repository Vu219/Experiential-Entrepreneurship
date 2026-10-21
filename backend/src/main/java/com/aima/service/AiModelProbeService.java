package com.aima.service;

import com.aima.dto.response.AiModelProbeResponse;

import java.util.List;

/**
 * "Kiểm tra model": gọi generateContent TỐI THIỂU (qua AI service /probe-models) cho mọi model đang được định tuyến
 * (chính + dự phòng của các route bật, đang dùng được). Chỉ liệt kê model là KHÔNG đủ — Google vẫn liệt kê model đã
 * bị chặn (gemini-2.5-*) trong khi generateContent trả 404.
 *
 * <p>Kết quả: lưu {@code ai_models.last_probe_status/last_probed_at} (trang admin) và đưa vào circuit breaker
 * ({@link AiModelHealthService#record}) — 404 → model nghỉ UNAVAILABLE + báo admin; "ok" → xoá dấu nghỉ.
 * Chạy khi backend khởi động ({@code ai-config.probe-on-startup}) và khi admin bấm "Kiểm tra model".</p>
 */
public interface AiModelProbeService {

    /** Kiểm tra mọi model đang được định tuyến; danh sách rỗng = không có model nào để kiểm tra. AI service lỗi → AppException. */
    List<AiModelProbeResponse> probeRoutedModels();
}
