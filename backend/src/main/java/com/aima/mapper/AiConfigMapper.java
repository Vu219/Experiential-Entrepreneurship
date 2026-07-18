package com.aima.mapper;

import com.aima.dto.ai.CatalogModelPayload;
import com.aima.dto.ai.LlmConfigPayload;
import com.aima.dto.ai.LlmSpecPayload;
import com.aima.dto.ai.TokenAccountedPayload;
import com.aima.dto.request.AiModelCreateRequest;
import com.aima.dto.request.AiModelUpdateRequest;
import com.aima.dto.request.AiProviderUpdateRequest;
import com.aima.dto.request.AiRoutingUpdateRequest;
import com.aima.dto.response.AiCatalogModelResponse;
import com.aima.dto.response.AiConfigAuditResponse;
import com.aima.dto.response.AiEffectiveStatusResponse;
import com.aima.dto.response.AiModelResponse;
import com.aima.dto.response.AiProviderResponse;
import com.aima.dto.response.AiRouteStatusResponse;
import com.aima.dto.response.AiRoutingResponse;
import com.aima.dto.response.AiUsageByModelResponse;
import com.aima.dto.response.AiUsageByTaskResponse;
import com.aima.dto.response.AiUsageResponse;
import com.aima.dto.response.AiUsageSummaryResponse;
import com.aima.entity.AiConfigAudit;
import com.aima.entity.AiModel;
import com.aima.entity.AiProvider;
import com.aima.entity.AiTaskRouting;
import com.aima.entity.AiUsage;
import com.aima.entity.User;
import com.aima.enums.AiConfigAction;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.enums.AiUsageStatus;
import com.aima.repository.AiUsageRepository;
import com.aima.service.AiUsageService;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;
import org.mapstruct.NullValuePropertyMappingStrategy;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Mapper cho concern cấu hình AI (provider/model/routing/audit).
 * API key chỉ đi ra ngoài qua {@link #maskKey(String)} — không response DTO nào mang full key.
 */
@Mapper(componentModel = "spring")
public interface AiConfigMapper {

    // ===== Provider =====

    // modelCatalog (JSON String → List đã join giá gợi ý) + dependentTaskCount do service tính.
    @Mapping(target = "apiKeyMasked", source = "apiKey", qualifiedByName = "maskKey")
    @Mapping(target = "modelCatalog", ignore = true)
    @Mapping(target = "dependentTaskCount", ignore = true)
    AiProviderResponse toProviderResponse(AiProvider provider);

    List<AiProviderResponse> toProviderResponseList(List<AiProvider> providers);

    /** Catalog payload từ AI service → shape lưu JSONB/trả FE (giá gợi ý do service join sau). */
    AiCatalogModelResponse toCatalogModel(CatalogModelPayload payload);

    List<AiCatalogModelResponse> toCatalogModelList(List<CatalogModelPayload> payloads);

    // apiKey xử lý riêng ở service (write-only, blank = giữ nguyên) — mapper không đụng tới.
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "apiKey", ignore = true)
    void updateProvider(AiProviderUpdateRequest request, @MappingTarget AiProvider provider);

    // ===== Model =====

    // usedByTaskCodes do service tính từ bảng routing.
    @Mapping(target = "providerId", source = "provider.id")
    @Mapping(target = "providerCode", source = "provider.code")
    @Mapping(target = "usedByTaskCodes", ignore = true)
    AiModelResponse toModelResponse(AiModel model);

    List<AiModelResponse> toModelResponseList(List<AiModel> models);

    /** provider do service set sau khi lookup; enabled null được service mặc định = true. */
    AiModel toModel(AiModelCreateRequest request);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateModel(AiModelUpdateRequest request, @MappingTarget AiModel model);

    // ===== Routing =====

    @Mapping(target = "primaryModelId", source = "primaryModel.id")
    @Mapping(target = "primaryModelCode", source = "primaryModel.modelCode")
    @Mapping(target = "primaryProviderCode", source = "primaryModel.provider.code")
    @Mapping(target = "fallbackModelId", source = "fallbackModel.id")
    @Mapping(target = "fallbackModelCode", source = "fallbackModel.modelCode")
    @Mapping(target = "fallbackProviderCode", source = "fallbackModel.provider.code")
    AiRoutingResponse toRoutingResponse(AiTaskRouting routing);

    List<AiRoutingResponse> toRoutingResponseList(List<AiTaskRouting> routings);

    /**
     * PUT = thay toàn bộ tham số (temperature/maxTokens null là XÓA — không dùng IGNORE);
     * primaryModel/fallbackModel do service lookup và set.
     */
    void updateRouting(AiRoutingUpdateRequest request, @MappingTarget AiTaskRouting routing);

    // ===== Effective status (một nguồn sự thật — tính ở AiConfigServiceImpl) =====

    AiRouteStatusResponse toRouteStatus(UUID routingId, String taskCode, Boolean enabled, String health,
                                        String primaryBlockReason, String fallbackBlockReason,
                                        Boolean hasFallback);

    AiEffectiveStatusResponse toEffectiveStatus(Boolean fromDb, Integer degradedCount, Integer errorCount,
                                                List<AiRouteStatusResponse> routes);

    // ===== Audit =====

    @Mapping(target = "actorEmail", source = "actor.email")
    AiConfigAuditResponse toAuditResponse(AiConfigAudit audit);

    /**
     * Snapshot truyền vào đây là JSON của response DTO — tức là ĐÃ mask key từ trước.
     * MapStruct dựng qua Lombok builder của entity (không chứa id/audit field của BaseEntity
     * nên không cần ignore — id/createdAt do JPA sinh khi save).
     */
    AiConfigAudit toAudit(User actor, AiConfigAction action, String entityType, UUID entityId,
                          String beforeSnapshot, String afterSnapshot);

    // ===== Runtime payload (llm_config gửi AI service) =====

    /** Spec chứa API key PLAINTEXT — không log kết quả (chỉ dùng nội bộ AiRuntimeConfigService). */
    @Mapping(target = "provider", source = "model.provider.code", qualifiedByName = "providerLower")
    @Mapping(target = "model", source = "model.modelCode")
    @Mapping(target = "apiKey", source = "model.provider.apiKey")
    @Mapping(target = "temperature", source = "routing.temperature")
    @Mapping(target = "maxTokens", source = "routing.maxTokens")
    LlmSpecPayload toLlmSpec(AiModel model, AiTaskRouting routing);

    LlmConfigPayload toLlmConfig(LlmSpecPayload primary, LlmSpecPayload fallback);

    // ===== Usage (ai_usage) =====

    /**
     * Một event ai_usage từ ngữ cảnh cuộc gọi + payload kết quả. {@code result} null (event
     * ERROR/TIMEOUT) → input/output/cached giữ NULL ("không biết", khác 0).
     */
    @Mapping(target = "taskCode", source = "context.taskCode")
    @Mapping(target = "status", source = "status") // tường minh: tránh MapStruct nhầm sang user.status
    @Mapping(target = "planAtTime", source = "context.planCode")
    @Mapping(target = "requestId", source = "context.requestId")
    @Mapping(target = "clientIp", source = "context.clientIp")
    @Mapping(target = "userAgent", source = "context.userAgent")
    @Mapping(target = "inputTokens", source = "result.inputTokens")
    @Mapping(target = "outputTokens", source = "result.outputTokens")
    @Mapping(target = "cachedTokens", source = "result.cachedTokens")
    AiUsage toUsage(User user, AiUsageService.AiCallContext context, TokenAccountedPayload result,
                    AiProviderCode providerCode, String modelCode, Long totalTokens,
                    AiUsageStatus status, Long latencyMs, Long billableUnits,
                    Long creditUnits, Long creditShortfall,
                    BigDecimal estimatedCost, String billingPeriod, String idempotencyKey);

    @Mapping(target = "userEmail", source = "user.email")
    AiUsageResponse toUsageResponse(AiUsage usage);

    AiUsageByTaskResponse toByTaskResponse(AiUsageRepository.TaskUsageAgg agg);

    List<AiUsageByTaskResponse> toByTaskResponseList(List<AiUsageRepository.TaskUsageAgg> aggs);

    AiUsageByModelResponse toByModelResponse(AiUsageRepository.ModelUsageAgg agg);

    List<AiUsageByModelResponse> toByModelResponseList(List<AiUsageRepository.ModelUsageAgg> aggs);

    AiUsageSummaryResponse toUsageSummary(String month, Long totalTokens, BigDecimal estimatedCost,
                                          List<AiUsageByTaskResponse> byTask,
                                          List<AiUsageByModelResponse> byModel);

    /** Mã provider chữ thường khớp llm_provider phía AI service ("anthropic"/"google"). */
    @Named("providerLower")
    static String providerLower(AiProviderCode code) {
        return code == null ? null : code.name().toLowerCase();
    }

    /** Che API key: null/blank → null; ngắn hơn 8 ký tự → "••••"; còn lại "••••" + 4 ký tự cuối. */
    @Named("maskKey")
    static String maskKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            return null;
        }
        if (apiKey.length() < 8) {
            return "••••";
        }
        return "••••" + apiKey.substring(apiKey.length() - 4);
    }
}
