package com.aima.service;

import com.aima.dto.request.AiModelCreateRequest;
import com.aima.dto.request.AiModelUpdateRequest;
import com.aima.dto.request.AiProviderUpdateRequest;
import com.aima.dto.request.AiRoutingUpdateRequest;
import com.aima.dto.response.AiConfigAuditResponse;
import com.aima.dto.response.AiEffectiveStatusResponse;
import com.aima.dto.response.AiModelResponse;
import com.aima.dto.response.AiModelHealthResponse;
import com.aima.dto.response.AiProviderResponse;
import com.aima.dto.response.AiRoutingResponse;
import com.aima.dto.response.AiTestConnectionResponse;
import com.aima.dto.response.AiUsageResponse;
import com.aima.dto.response.AiUsageSummaryResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;

import java.util.List;
import java.util.UUID;

/**
 * Quản trị cấu hình AI (trang "Cấu hình AI" của admin): provider + API key (mã hóa at rest,
 * response chỉ trả masked), model, định tuyến theo nghiệp vụ, audit log mọi thay đổi.
 */
public interface AiConfigService {

    ApiResponse<List<AiProviderResponse>> listProviders();

    ApiResponse<AiProviderResponse> updateProvider(UUID id, AiProviderUpdateRequest request);

    /** "Kiểm tra kết nối": gọi AI service thực hiện 1 call model tối thiểu bằng key của provider. */
    ApiResponse<AiTestConnectionResponse> testConnection(UUID id);

    /**
     * Đồng bộ catalog model từ API provider (qua AI service /list-models) — cần key;
     * lưu cache JSONB + timestamp trên provider, ghi audit SYNC_MODELS.
     */
    ApiResponse<AiProviderResponse> syncProviderModels(UUID id);

    /** Các model đang bị circuit breaker cho nghỉ (cooldown / hết quota ngày) — đọc Redis. */
    ApiResponse<List<AiModelHealthResponse>> listModelHealth();

    /** "Reset trạng thái model": xoá cooldown/exhausted mọi model của provider (vd sau khi bật billing). */
    ApiResponse<Integer> resetModelHealth(UUID providerId);

    /**
     * Effective status 3 mức (OK / chỉ dự phòng chạy / lỗi cả hai) cho 6 nghiệp vụ + cờ
     * AI_CONFIG_FROM_DB — MỘT nguồn sự thật cho cả 3 trang admin, cùng luật với runtime.
     */
    ApiResponse<AiEffectiveStatusResponse> getEffectiveStatus();

    ApiResponse<List<AiModelResponse>> listModels();

    ApiResponse<AiModelResponse> createModel(AiModelCreateRequest request);

    ApiResponse<AiModelResponse> updateModel(UUID id, AiModelUpdateRequest request);

    ApiResponse<AiModelResponse> deleteModel(UUID id);

    ApiResponse<List<AiRoutingResponse>> listRouting();

    ApiResponse<AiRoutingResponse> updateRouting(UUID id, AiRoutingUpdateRequest request);

    ApiResponse<PageResponse<AiConfigAuditResponse>> listAudit(int page, int size);

    ApiResponse<PageResponse<AiUsageResponse>> listUsage(int page, int size);

    /** Tổng hợp usage theo tháng ("YYYY-MM"; null/blank = tháng hiện tại). */
    ApiResponse<AiUsageSummaryResponse> getUsageSummary(String month);
}
