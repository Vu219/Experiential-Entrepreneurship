package com.aima.service.Impl;

import com.aima.config.AiConfigProperties;
import com.aima.dto.ai.LlmConfigPayload;
import com.aima.dto.ai.LlmSpecPayload;
import com.aima.entity.AiModel;
import com.aima.entity.AiTaskRouting;
import com.aima.enums.AiModelBlockReason;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.mapper.AiConfigMapper;
import com.aima.repository.AiModelRepository;
import com.aima.repository.AiTaskRoutingRepository;
import com.aima.service.AiRuntimeConfigService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cache kết quả resolve theo task (kể cả kết quả "không hiệu lực" = null) trong 5 phút —
 * tránh mỗi job AI một lượt query routing/provider. Evict tường minh khi admin lưu.
 * Payload trong cache chứa key ĐÃ GIẢI MÃ (in-memory, tương đương entity sau converter) —
 * KHÔNG log payload/spec.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@EnableConfigurationProperties(AiConfigProperties.class)
public class AiRuntimeConfigServiceImpl implements AiRuntimeConfigService {

    static final Duration CACHE_TTL = Duration.ofMinutes(5);

    AiTaskRoutingRepository routingRepository;
    AiModelRepository modelRepository;
    AiConfigProperties properties;
    AiConfigMapper aiConfigMapper;

    final ConcurrentHashMap<AiTaskCode, CachedRouting> cache = new ConcurrentHashMap<>();
    /** "PROVIDER:model" → đơn giá (Optional.empty = model không có trong ai_models). Evict cùng cache routing. */
    final ConcurrentHashMap<String, CachedModel> modelCache = new ConcurrentHashMap<>();

    private record CachedModel(Optional<ActiveModel> model, LocalDateTime cachedAt) {
        boolean isFresh() {
            return Duration.between(cachedAt, LocalDateTime.now()).compareTo(CACHE_TTL) < 0;
        }
    }

    /** payload/activeModel null = task này không dùng config DB (đường env). */
    private record CachedRouting(LlmConfigPayload payload, ActiveModel activeModel, LocalDateTime cachedAt) {
        boolean isFresh() {
            return Duration.between(cachedAt, LocalDateTime.now()).compareTo(CACHE_TTL) < 0;
        }
    }

    @Override
    public LlmConfigPayload getLlmConfig(AiTaskCode taskCode) {
        return resolved(taskCode).payload();
    }

    @Override
    public ActiveModel getActiveModel(AiTaskCode taskCode) {
        return resolved(taskCode).activeModel();
    }

    @Override
    public ActiveModel resolveModel(String provider, String modelCode) {
        if (provider == null || modelCode == null) {
            return null;
        }
        AiProviderCode code;
        try {
            code = AiProviderCode.valueOf(provider.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
        String key = code + ":" + modelCode;
        CachedModel cached = modelCache.get(key);
        if (cached == null || !cached.isFresh()) {
            Optional<ActiveModel> found = modelRepository
                    .findFirstByProvider_CodeAndModelCodeAndDeletedAtIsNull(code, modelCode)
                    .map(m -> new ActiveModel(code, m.getModelCode(), m.getInputPricePer1m(), m.getOutputPricePer1m()));
            cached = new CachedModel(found, LocalDateTime.now());
            modelCache.put(key, cached);
        }
        return cached.model().orElseGet(() -> new ActiveModel(code, modelCode, null, null));
    }

    @Override
    public void evictCache() {
        cache.clear();
        modelCache.clear();
    }

    private CachedRouting resolved(AiTaskCode taskCode) {
        CachedRouting cached = cache.get(taskCode);
        if (cached != null && cached.isFresh()) {
            return cached;
        }
        CachedRouting fresh = resolve(taskCode);
        cache.put(taskCode, fresh);
        return fresh;
    }

    // Không @Transactional (self-invocation không qua proxy) — repo fetch-join đủ model/provider.
    private CachedRouting resolve(AiTaskCode taskCode) {
        if (!properties.fromDb()) {
            return inactive();
        }
        AiTaskRouting routing = routingRepository.findWithModelsByTaskCode(taskCode).orElse(null);
        if (routing == null || !Boolean.TRUE.equals(routing.getEnabled())) {
            return inactive();
        }
        AiModel primary = routing.getPrimaryModel();
        if (!usable(primary)) {
            log.warn("[AiRuntimeConfig] Task {} có routing nhưng model chính không hiệu lực "
                    + "(model/provider tắt hoặc thiếu key) — dùng cấu hình env.", taskCode);
            return inactive();
        }

        LlmSpecPayload primarySpec = aiConfigMapper.toLlmSpec(primary, routing);
        // Chuỗi dự phòng theo position: bỏ model không dùng được (tắt/xóa/provider tắt/thiếu key)
        // và model trùng (phòng dữ liệu tay) — mắt xích hỏng không làm hỏng cả chuỗi.
        List<LlmSpecPayload> fallbackSpecs = new ArrayList<>();
        Set<UUID> seen = new HashSet<>(Set.of(primary.getId()));
        for (AiModel fallback : routing.fallbackChain()) {
            if (usable(fallback) && seen.add(fallback.getId())) {
                fallbackSpecs.add(aiConfigMapper.toLlmSpec(fallback, routing));
            }
        }
        LlmConfigPayload payload = aiConfigMapper.toLlmConfig(primarySpec, fallbackSpecs);
        ActiveModel activeModel = new ActiveModel(primary.getProvider().getCode(), primary.getModelCode(),
                primary.getInputPricePer1m(), primary.getOutputPricePer1m());
        return new CachedRouting(payload, activeModel, LocalDateTime.now());
    }

    @Override
    public AiModelBlockReason blockReason(AiModel model) {
        if (model == null || model.getDeletedAt() != null) {
            return AiModelBlockReason.MODEL_DELETED;
        }
        if (!Boolean.TRUE.equals(model.getEnabled())) {
            return AiModelBlockReason.MODEL_DISABLED;
        }
        if (!Boolean.TRUE.equals(model.getProvider().getEnabled())) {
            return AiModelBlockReason.PROVIDER_DISABLED;
        }
        if (model.getProvider().getApiKey() == null || model.getProvider().getApiKey().isBlank()) {
            return AiModelBlockReason.PROVIDER_KEY_MISSING;
        }
        return null;
    }

    /** Luật "dùng được" tập trung ở {@link #blockReason(AiModel)} — một nguồn sự thật. */
    private boolean usable(AiModel model) {
        return blockReason(model) == null;
    }

    private CachedRouting inactive() {
        return new CachedRouting(null, null, LocalDateTime.now());
    }
}
