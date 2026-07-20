package com.aima.service.Impl;

import com.aima.config.AiConfigProperties;
import com.aima.dto.ai.ListModelsPayload;
import com.aima.dto.ai.ListModelsResultPayload;
import com.aima.dto.ai.TestConnectionPayload;
import com.aima.dto.ai.TestConnectionResultPayload;
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
import com.aima.dto.response.AiTestConnectionResponse;
import com.aima.dto.response.AiUsageByModelResponse;
import com.aima.dto.response.AiUsageByTaskResponse;
import com.aima.dto.response.AiUsageResponse;
import com.aima.dto.response.AiUsageSummaryResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.AiConfigAudit;
import com.aima.entity.AiModel;
import com.aima.entity.AiModelPriceCatalog;
import com.aima.entity.AiProvider;
import com.aima.entity.AiTaskRouting;
import com.aima.entity.AiUsage;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import com.aima.enums.AiConfigAction;
import com.aima.enums.AiModelBlockReason;
import com.aima.enums.AiRouteHealth;
import com.aima.enums.AiTestStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AiConfigMapper;
import com.aima.repository.AiConfigAuditRepository;
import com.aima.repository.AiModelPriceCatalogRepository;
import com.aima.repository.AiModelRepository;
import com.aima.repository.AiProviderRepository;
import com.aima.repository.AiTaskRoutingRepository;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.AiConfigService;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.AiServiceClient;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Ràng buộc bảo mật của cả class (SEC-03):
 * <ul>
 *   <li>Key chỉ ghi xuống DB qua {@code EncryptedStringConverter} (ciphertext at rest).</li>
 *   <li>Mọi response/audit snapshot đi qua response DTO đã mask — KHÔNG bao giờ chứa full key.</li>
 *   <li>KHÔNG log key hay request chứa key.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AiConfigServiceImpl implements AiConfigService {

    ActivityLogService activityLogService;

    static final int MAX_AUDIT_PAGE_SIZE = 50;

    static final String ENTITY_PROVIDER = "AiProvider";
    static final String ENTITY_MODEL = "AiModel";
    static final String ENTITY_ROUTING = "AiTaskRouting";

    AiProviderRepository providerRepository;
    AiModelRepository modelRepository;
    AiTaskRoutingRepository routingRepository;
    AiConfigAuditRepository auditRepository;
    AiUsageRepository usageRepository;
    AiModelPriceCatalogRepository priceCatalogRepository;
    UserRepository userRepository;
    AiConfigMapper aiConfigMapper;
    AiServiceClient aiServiceClient;
    AiRuntimeConfigService runtimeConfigService;
    AiConfigProperties aiConfigProperties;
    ObjectMapper objectMapper;

    // ===== Provider =====

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<AiProviderResponse>> listProviders() {
        List<AiTaskRouting> routings = routingRepository.findAllWithModels();
        List<AiProviderResponse> providers = providerRepository.findByDeletedAtIsNullOrderByCodeAsc().stream()
                .map(p -> enrichProvider(aiConfigMapper.toProviderResponse(p), p, routings))
                .toList();
        return ApiResponse.success("Lấy danh sách nhà cung cấp AI thành công", providers);
    }

    @Override
    @Transactional
    public ApiResponse<AiProviderResponse> updateProvider(UUID id, AiProviderUpdateRequest request) {
        AiProvider provider = providerRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.AI_PROVIDER_NOT_FOUND));

        String before = toJson(aiConfigMapper.toProviderResponse(provider));

        aiConfigMapper.updateProvider(request, provider);
        if (request.getApiKey() != null && !request.getApiKey().isBlank()) {
            provider.setApiKey(request.getApiKey().trim());
        }
        // Không cho bật provider khi chưa có key — routing bật lên sẽ gọi hỏng ngay.
        if (Boolean.TRUE.equals(provider.getEnabled())
                && (provider.getApiKey() == null || provider.getApiKey().isBlank())) {
            throw new AppException(ErrorCode.AI_PROVIDER_KEY_MISSING);
        }
        AiProvider saved = providerRepository.save(provider);

        AiProviderResponse response = aiConfigMapper.toProviderResponse(saved);
        // Audit snapshot dùng bản CHƯA enrich (không nhét cả catalog vào audit); enrich sau.
        audit(AiConfigAction.UPDATE, ENTITY_PROVIDER, saved.getId(), before, toJson(response));
        runtimeConfigService.evictCache(); // key/bật-tắt đổi → routing runtime áp dụng ngay
        enrichProvider(response, saved, routingRepository.findAllWithModels());
        return ApiResponse.success("Cập nhật nhà cung cấp AI thành công", response);
    }

    /**
     * KHÔNG mở transaction: có HTTP call sang AI service (rule #24). Hai lần save (kết quả test
     * + audit) là các transaction ngắn riêng — chấp nhận không atomic cho thao tác chẩn đoán.
     */
    @Override
    public ApiResponse<AiTestConnectionResponse> testConnection(UUID id) {
        AiProvider provider = providerRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.AI_PROVIDER_NOT_FOUND));
        if (provider.getApiKey() == null || provider.getApiKey().isBlank()) {
            throw new AppException(ErrorCode.AI_PROVIDER_KEY_MISSING);
        }
        AiModel model = modelRepository
                .findFirstByProviderAndEnabledTrueAndDeletedAtIsNullOrderByCreatedAtAsc(provider)
                .orElseThrow(() -> new AppException(ErrorCode.AI_MODEL_NOT_FOUND));

        TestConnectionPayload payload = TestConnectionPayload.builder()
                .provider(provider.getCode().name().toLowerCase())
                .model(model.getModelCode())
                .apiKey(provider.getApiKey())
                .build();

        AiTestStatus status;
        String message = null;
        Long latencyMs = null;
        try {
            TestConnectionResultPayload result = aiServiceClient.testConnection(payload);
            status = result.isSuccess() ? AiTestStatus.SUCCESS : AiTestStatus.FAILED;
            message = result.getMessage();
            latencyMs = result.getLatencyMs();
        } catch (AppException e) {
            // AI service không chạy / lỗi HTTP → kết quả FAILED, không ném 502 cho thao tác chẩn đoán.
            status = AiTestStatus.FAILED;
            message = e.getMessage();
        }

        if (status == AiTestStatus.SUCCESS) {
            // Key vừa xác nhận OK → làm mới catalog model luôn (best-effort, lỗi không phá kết quả test).
            try {
                syncCatalog(provider);
            } catch (Exception e) {
                log.warn("[AiConfig] Đồng bộ catalog sau test kết nối thất bại (bỏ qua): {}", e.getMessage());
            }
        }

        provider.setLastTestedAt(LocalDateTime.now());
        provider.setLastTestStatus(status);
        providerRepository.save(provider);

        AiTestConnectionResponse response = AiTestConnectionResponse.builder()
                .status(status.name())
                .message(message)
                .latencyMs(latencyMs)
                .testedAt(provider.getLastTestedAt())
                .build();
        audit(AiConfigAction.TEST_CONNECTION, ENTITY_PROVIDER, provider.getId(), null, toJson(response));
        return ApiResponse.success("Đã kiểm tra kết nối", response);
    }

    /**
     * KHÔNG mở transaction: có HTTP call sang AI service (rule #24) — cùng lý do testConnection.
     */
    @Override
    public ApiResponse<AiProviderResponse> syncProviderModels(UUID id) {
        AiProvider provider = providerRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.AI_PROVIDER_NOT_FOUND));
        if (provider.getApiKey() == null || provider.getApiKey().isBlank()) {
            throw new AppException(ErrorCode.AI_PROVIDER_KEY_MISSING);
        }

        String auditSummary = syncCatalog(provider); // AI service/provider lỗi → AI_SERVICE_ERROR (502) từ client
        AiProvider saved = providerRepository.save(provider);

        // Ghi audit SAU khi catalog đã lưu (method này KHÔNG mở transaction): lỗi ghi audit
        // KHÔNG được làm hỏng kết quả sync đã persist — chỉ log lại, không ném ra ngoài.
        try {
            audit(AiConfigAction.SYNC_MODELS, ENTITY_PROVIDER, saved.getId(), null, auditSummary);
        } catch (Exception e) {
            log.error("[AiConfig] Ghi audit SYNC_MODELS lỗi (catalog vẫn lưu thành công): {}", e.getMessage());
        }

        AiProviderResponse response = aiConfigMapper.toProviderResponse(saved);
        enrichProvider(response, saved, routingRepository.findAllWithModels());
        return ApiResponse.success("Đã đồng bộ danh sách model từ nhà cung cấp", response);
    }

    /**
     * Gọi AI service lấy catalog rồi set cache JSONB + timestamp vào entity — KHÔNG save và
     * KHÔNG ghi audit (caller lưu provider trước, rồi ghi audit tách biệt để lỗi audit không
     * làm hỏng việc lưu catalog). Catalog lưu KHÔNG kèm giá (giá gợi ý join từ
     * ai_model_price_catalog lúc đọc). Trả JSON snapshot gọn để caller ghi audit.
     */
    private String syncCatalog(AiProvider provider) {
        ListModelsPayload payload = ListModelsPayload.builder()
                .provider(provider.getCode().name().toLowerCase())
                .apiKey(provider.getApiKey())
                .build();
        ListModelsResultPayload result = aiServiceClient.listModels(payload);

        List<AiCatalogModelResponse> catalog = aiConfigMapper.toCatalogModelList(result.getModels());
        provider.setModelCatalog(toJson(catalog));
        provider.setModelCatalogSyncedAt(LocalDateTime.now());

        // Snapshot audit gọn: số model + thời điểm (catalog đầy đủ đã nằm trên provider).
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("count", catalog.size());
        summary.put("syncedAt", provider.getModelCatalogSyncedAt().toString());
        return toJson(summary);
    }

    // ===== Model =====

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<AiModelResponse>> listModels() {
        List<AiTaskRouting> routings = routingRepository.findAllWithModels();
        List<AiModelResponse> models = modelRepository.findByDeletedAtIsNullOrderByModelCodeAsc().stream()
                .map(m -> enrichModel(aiConfigMapper.toModelResponse(m), routings))
                .toList();
        return ApiResponse.success("Lấy danh sách model AI thành công", models);
    }

    @Override
    @Transactional
    public ApiResponse<AiModelResponse> createModel(AiModelCreateRequest request) {
        AiProvider provider = providerRepository.findByIdAndDeletedAtIsNull(request.getProviderId())
                .orElseThrow(() -> new AppException(ErrorCode.AI_PROVIDER_NOT_FOUND));
        if (modelRepository.findByProviderAndModelCodeAndDeletedAtIsNull(provider, request.getModelCode()).isPresent()) {
            throw new AppException(ErrorCode.AI_MODEL_EXISTED);
        }

        AiModel model = aiConfigMapper.toModel(request);
        model.setProvider(provider);
        if (model.getEnabled() == null) {
            model.setEnabled(true);
        }
        AiModel saved = modelRepository.save(model);

        AiModelResponse response = aiConfigMapper.toModelResponse(saved);
        audit(AiConfigAction.CREATE, ENTITY_MODEL, saved.getId(), null, toJson(response));
        runtimeConfigService.evictCache();
        enrichModel(response, routingRepository.findAllWithModels());
        return ApiResponse.success("Tạo model AI thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<AiModelResponse> updateModel(UUID id, AiModelUpdateRequest request) {
        AiModel model = modelRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.AI_MODEL_NOT_FOUND));

        String before = toJson(aiConfigMapper.toModelResponse(model));
        aiConfigMapper.updateModel(request, model);
        AiModel saved = modelRepository.save(model);

        AiModelResponse response = aiConfigMapper.toModelResponse(saved);
        audit(AiConfigAction.UPDATE, ENTITY_MODEL, saved.getId(), before, toJson(response));
        runtimeConfigService.evictCache();
        enrichModel(response, routingRepository.findAllWithModels());
        return ApiResponse.success("Cập nhật model AI thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<AiModelResponse> deleteModel(UUID id) {
        AiModel model = modelRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.AI_MODEL_NOT_FOUND));
        if (routingRepository.existsByPrimaryModelAndDeletedAtIsNull(model)
                || routingRepository.existsByFallbackModelAndDeletedAtIsNull(model)) {
            throw new AppException(ErrorCode.AI_MODEL_IN_USE);
        }

        String before = toJson(aiConfigMapper.toModelResponse(model));
        model.setDeletedAt(LocalDateTime.now());
        AiModel saved = modelRepository.save(model);

        AiModelResponse response = aiConfigMapper.toModelResponse(saved);
        audit(AiConfigAction.DELETE, ENTITY_MODEL, saved.getId(), before, null);
        runtimeConfigService.evictCache();
        return ApiResponse.success("Đã xóa model AI", response);
    }

    // ===== Routing =====

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<AiRoutingResponse>> listRouting() {
        List<AiRoutingResponse> routing =
                aiConfigMapper.toRoutingResponseList(routingRepository.findByDeletedAtIsNullOrderByTaskCodeAsc());
        return ApiResponse.success("Lấy định tuyến AI thành công", routing);
    }

    @Override
    @Transactional
    public ApiResponse<AiRoutingResponse> updateRouting(UUID id, AiRoutingUpdateRequest request) {
        AiTaskRouting routing = routingRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.AI_ROUTING_NOT_FOUND));

        String before = toJson(aiConfigMapper.toRoutingResponse(routing));

        AiModel primaryModel = modelRepository.findByIdAndDeletedAtIsNull(request.getPrimaryModelId())
                .orElseThrow(() -> new AppException(ErrorCode.AI_MODEL_NOT_FOUND));
        AiModel fallbackModel = request.getFallbackModelId() == null ? null
                : modelRepository.findByIdAndDeletedAtIsNull(request.getFallbackModelId())
                        .orElseThrow(() -> new AppException(ErrorCode.AI_MODEL_NOT_FOUND));

        aiConfigMapper.updateRouting(request, routing);
        routing.setPrimaryModel(primaryModel);
        routing.setFallbackModel(fallbackModel);
        AiTaskRouting saved = routingRepository.save(routing);

        AiRoutingResponse response = aiConfigMapper.toRoutingResponse(saved);
        audit(AiConfigAction.UPDATE, ENTITY_ROUTING, saved.getId(), before, toJson(response));
        runtimeConfigService.evictCache();
        return ApiResponse.success("Cập nhật định tuyến AI thành công", response);
    }

    // ===== Effective status (một nguồn sự thật — cùng luật blockReason với runtime) =====

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<AiEffectiveStatusResponse> getEffectiveStatus() {
        List<AiRouteStatusResponse> routes = routingRepository.findAllWithModels().stream()
                .map(this::toRouteStatus)
                .toList();
        int degraded = 0;
        int error = 0;
        for (AiRouteStatusResponse route : routes) {
            if (AiRouteHealth.DEGRADED.name().equals(route.getHealth())) {
                degraded++;
            } else if (AiRouteHealth.ERROR.name().equals(route.getHealth())) {
                error++;
            }
        }
        AiEffectiveStatusResponse status = aiConfigMapper.toEffectiveStatus(
                aiConfigProperties.fromDb(), degraded, error, routes);
        return ApiResponse.success("Lấy trạng thái hiệu lực cấu hình AI thành công", status);
    }

    /** Route tắt (dùng env) → health = null, không tính vào counts; route bật → OK/DEGRADED/ERROR. */
    private AiRouteStatusResponse toRouteStatus(AiTaskRouting routing) {
        AiModelBlockReason primaryReason = runtimeConfigService.blockReason(routing.getPrimaryModel());
        boolean hasFallback = routing.getFallbackModel() != null;
        AiModelBlockReason fallbackReason = hasFallback
                ? runtimeConfigService.blockReason(routing.getFallbackModel())
                : null;

        String health = null;
        if (Boolean.TRUE.equals(routing.getEnabled())) {
            AiRouteHealth resolved = primaryReason == null ? AiRouteHealth.OK
                    : hasFallback && fallbackReason == null ? AiRouteHealth.DEGRADED
                    : AiRouteHealth.ERROR;
            health = resolved.name();
        }
        return aiConfigMapper.toRouteStatus(routing.getId(), routing.getTaskCode().name(),
                routing.getEnabled(), health,
                primaryReason == null ? null : primaryReason.name(),
                fallbackReason == null ? null : fallbackReason.name(),
                hasFallback);
    }

    // ===== Audit =====

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<AiConfigAuditResponse>> listAudit(int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_AUDIT_PAGE_SIZE));
        Page<AiConfigAudit> entries = auditRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable);
        List<AiConfigAuditResponse> content = entries.getContent().stream()
                .map(aiConfigMapper::toAuditResponse)
                .toList();
        PageResponse<AiConfigAuditResponse> result = PageResponse.from(entries, content);
        return ApiResponse.success("Lấy audit log cấu hình AI thành công", result);
    }

    // ===== Usage (trang "Sử dụng & chi phí") =====

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<AiUsageResponse>> listUsage(int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_AUDIT_PAGE_SIZE));
        Page<AiUsage> entries = usageRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable);
        List<AiUsageResponse> content = entries.getContent().stream()
                .map(aiConfigMapper::toUsageResponse)
                .toList();
        PageResponse<AiUsageResponse> result = PageResponse.from(entries, content);
        return ApiResponse.success("Lấy usage AI thành công", result);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<AiUsageSummaryResponse> getUsageSummary(String month) {
        YearMonth yearMonth = parseMonth(month);
        LocalDateTime from = yearMonth.atDay(1).atStartOfDay();
        LocalDateTime to = yearMonth.plusMonths(1).atDay(1).atStartOfDay();

        List<AiUsageByTaskResponse> byTask =
                aiConfigMapper.toByTaskResponseList(usageRepository.aggregateByTask(from, to));
        List<AiUsageByModelResponse> byModel =
                aiConfigMapper.toByModelResponseList(usageRepository.aggregateByModel(from, to));

        long totalTokens = byTask.stream()
                .mapToLong(t -> t.getTotalTokens() == null ? 0L : t.getTotalTokens())
                .sum();
        BigDecimal totalCost = byTask.stream()
                .map(AiUsageByTaskResponse::getEstimatedCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        AiUsageSummaryResponse summary = aiConfigMapper.toUsageSummary(
                yearMonth.toString(), totalTokens, totalCost, byTask, byModel);
        return ApiResponse.success("Tổng hợp usage AI thành công", summary);
    }

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(month.trim());
        } catch (DateTimeParseException e) {
            throw new AppException(ErrorCode.AI_USAGE_MONTH_INVALID);
        }
    }

    // ===== Helpers =====

    /** Parse catalog JSONB (+ join giá gợi ý) + đếm nghiệp vụ phụ thuộc — sau khi map response. */
    private AiProviderResponse enrichProvider(AiProviderResponse response, AiProvider provider,
                                              List<AiTaskRouting> routings) {
        response.setModelCatalog(readCatalog(provider));
        response.setDependentTaskCount((int) routings.stream()
                .filter(r -> usesProvider(r, provider.getId()))
                .count());
        return response;
    }

    /** Catalog đã lưu → list response, gắn giá GỢI Ý từ bảng giá tự bảo trì. null = chưa đồng bộ. */
    private List<AiCatalogModelResponse> readCatalog(AiProvider provider) {
        if (provider.getModelCatalog() == null || provider.getModelCatalog().isBlank()) {
            return null;
        }
        List<AiCatalogModelResponse> catalog;
        try {
            catalog = objectMapper.readValue(provider.getModelCatalog(), new TypeReference<>() {
            });
        } catch (JacksonException e) {
            log.error("[AiConfig] Không đọc được catalog model của provider {}: {}",
                    provider.getCode(), e.getMessage());
            return null;
        }
        Map<String, AiModelPriceCatalog> prices = priceCatalogRepository
                .findByProviderCodeAndDeletedAtIsNull(provider.getCode()).stream()
                .collect(Collectors.toMap(AiModelPriceCatalog::getModelCode, Function.identity(), (a, b) -> a));
        for (AiCatalogModelResponse item : catalog) {
            AiModelPriceCatalog price = prices.get(item.getId());
            if (price != null) {
                item.setSuggestedInputPricePer1m(price.getInputPricePer1m());
                item.setSuggestedOutputPricePer1m(price.getOutputPricePer1m());
            }
        }
        return catalog;
    }

    /** Gắn danh sách nghiệp vụ đang dùng model (chính/dự phòng) — cảnh báo tắt/xóa phía FE. */
    private AiModelResponse enrichModel(AiModelResponse response, List<AiTaskRouting> routings) {
        List<String> usedBy = routings.stream()
                .filter(r -> usesModel(r, response.getId()))
                .map(r -> r.getTaskCode().name())
                .toList();
        response.setUsedByTaskCodes(usedBy);
        return response;
    }

    private boolean usesProvider(AiTaskRouting routing, UUID providerId) {
        if (providerId.equals(routing.getPrimaryModel().getProvider().getId())) {
            return true;
        }
        return routing.getFallbackModel() != null
                && providerId.equals(routing.getFallbackModel().getProvider().getId());
    }

    private boolean usesModel(AiTaskRouting routing, UUID modelId) {
        if (modelId.equals(routing.getPrimaryModel().getId())) {
            return true;
        }
        return routing.getFallbackModel() != null && modelId.equals(routing.getFallbackModel().getId());
    }

    /** Snapshot truyền vào là JSON của response DTO (đã mask key) — KHÔNG serialize entity. */
    private void audit(AiConfigAction action, String entityType, UUID entityId, String before, String after) {
        User actor = currentUser();
        AiConfigAudit entry = aiConfigMapper.toAudit(actor, action, entityType, entityId, before, after);
        auditRepository.save(entry);
        // ai_config_audit là audit CHI TIẾT (có snapshot trước/sau) và vẫn giữ nguyên; dòng dưới chỉ
        // để thao tác này cũng hiện trong tab "Log hoạt động người dùng" chung với mọi hành động khác.
        activityLogService.record(new ActivityLogService.Entry(
                ActivityAction.AI_CONFIG_UPDATED,
                actor == null ? null : actor.getId(),
                actor == null ? null : actor.getEmail(),
                entityType, entityId == null ? null : entityId.toString(),
                ActivityResult.SUCCESS, Map.of("action", action.name())));
    }

    private User currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        return userRepository.findByEmail(authentication.getName()).orElse(null);
    }

    // Mapper Jackson 3 (tools.jackson) của framework — mapper Jackson 2 (bean cũ) không có
    // module java-time ngoài test scope nên serialize LocalDateTime (updatedAt...) sẽ fail.
    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JacksonException e) {
            // DTO chỉ gồm kiểu cơ bản nên thực tế không xảy ra; audit vẫn ghi row với snapshot null.
            log.error("[AiConfig] Không serialize được audit snapshot: {}", e.getMessage());
            return null;
        }
    }
}
