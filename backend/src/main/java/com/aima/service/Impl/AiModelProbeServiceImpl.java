package com.aima.service.Impl;

import com.aima.dto.ai.LlmAttemptPayload;
import com.aima.dto.ai.LlmSpecPayload;
import com.aima.dto.ai.ProbeModelsPayload;
import com.aima.dto.ai.ProbeModelsResultPayload;
import com.aima.dto.response.AiModelProbeResponse;
import com.aima.entity.AiModel;
import com.aima.entity.AiTaskRouting;
import com.aima.mapper.AiConfigMapper;
import com.aima.repository.AiModelRepository;
import com.aima.repository.AiTaskRoutingRepository;
import com.aima.service.AiModelHealthService;
import com.aima.service.AiModelProbeService;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.AiServiceClient;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Không @Transactional: gọi AI service NGOÀI transaction (rule #24) — đọc routing bằng query fetch-join, ghi kết quả
 * bằng update 2 cột. Spec chứa key PLAINTEXT: KHÔNG log spec/payload, chỉ provider/model/outcome.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AiModelProbeServiceImpl implements AiModelProbeService {

    static final String OUTCOME_OK = "ok";

    AiTaskRoutingRepository routingRepository;
    AiModelRepository modelRepository;
    AiRuntimeConfigService runtimeConfigService;
    AiModelHealthService modelHealthService;
    AiServiceClient aiServiceClient;
    AiConfigMapper aiConfigMapper;

    @Override
    public List<AiModelProbeResponse> probeRoutedModels() {
        List<AiModel> models = routedModels();
        if (models.isEmpty()) {
            log.info("[AiModelProbe] Không có model nào đang được định tuyến để kiểm tra");
            return List.of();
        }
        List<LlmSpecPayload> specs = models.stream().map(this::probeSpec).toList();
        ProbeModelsResultPayload result = aiServiceClient.probeModels(ProbeModelsPayload.builder().specs(specs).build());
        List<LlmAttemptPayload> attempts = result == null || result.getResults() == null ? List.of() : result.getResults();

        modelHealthService.record(attempts); // 404 → UNAVAILABLE + báo admin; ok → hết nghỉ
        LocalDateTime now = LocalDateTime.now();
        List<AiModelProbeResponse> responses = new ArrayList<>();
        for (int i = 0; i < models.size() && i < attempts.size(); i++) {
            AiModel model = models.get(i);
            LlmAttemptPayload a = attempts.get(i);
            modelRepository.updateProbeResult(model.getId(), a.getOutcome(), now);
            if (!OUTCOME_OK.equals(a.getOutcome())) {
                log.warn("[AiModelProbe] {}/{} → {} (HTTP {})", a.getProvider(), a.getModel(), a.getOutcome(), a.getHttpStatus());
            }
            responses.add(aiConfigMapper.toModelProbeResponse(model, a));
        }
        long ok = responses.stream().filter(r -> OUTCOME_OK.equals(r.getOutcome())).count();
        log.info("[AiModelProbe] Đã kiểm tra {} model: {} OK, {} lỗi", responses.size(), ok, responses.size() - ok);
        return responses;
    }

    /** Model chính + chuỗi dự phòng của các route BẬT, chỉ model dùng được (cùng luật blockReason với runtime), không trùng. */
    private List<AiModel> routedModels() {
        Map<UUID, AiModel> models = new LinkedHashMap<>();
        for (AiTaskRouting routing : routingRepository.findAllWithModels()) {
            if (!Boolean.TRUE.equals(routing.getEnabled())) {
                continue;
            }
            List<AiModel> chain = new ArrayList<>();
            chain.add(routing.getPrimaryModel());
            chain.addAll(routing.fallbackChain());
            for (AiModel model : chain) {
                if (runtimeConfigService.blockReason(model) == null) {
                    models.putIfAbsent(model.getId(), model);
                }
            }
        }
        return List.copyOf(models.values());
    }

    /** Spec không kèm tham số routing — AI service tự ép max_tokens tối thiểu. */
    private LlmSpecPayload probeSpec(AiModel model) {
        LlmSpecPayload spec = aiConfigMapper.toLlmSpec(model, null);
        spec.setTemperature(null);
        spec.setMaxTokens(null);
        return spec;
    }
}
