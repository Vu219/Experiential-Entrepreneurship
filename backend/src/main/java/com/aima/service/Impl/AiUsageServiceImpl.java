package com.aima.service.Impl;

import com.aima.entity.AiUsage;
import com.aima.entity.User;
import com.aima.enums.AiTaskCode;
import com.aima.mapper.AiConfigMapper;
import com.aima.repository.AiUsageRepository;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.AiUsageService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AiUsageServiceImpl implements AiUsageService {

    static final BigDecimal ONE_MILLION = BigDecimal.valueOf(1_000_000);

    AiUsageRepository usageRepository;
    AiRuntimeConfigService runtimeConfigService;
    AiConfigMapper aiConfigMapper;

    @Override
    public void record(User user, AiTaskCode taskCode, Long totalTokens) {
        try {
            if (totalTokens == null || totalTokens <= 0) {
                return;
            }
            AiRuntimeConfigService.ActiveModel model = runtimeConfigService.getActiveModel(taskCode);
            if (model == null) {
                return; // đường env — không biết model thật sự chạy, không ghi.
            }
            BigDecimal cost = estimateCost(totalTokens, model);
            AiUsage usage = aiConfigMapper.toUsage(user, taskCode, model.providerCode(),
                    model.modelCode(), totalTokens, cost);
            usageRepository.save(usage);
        } catch (Exception e) {
            log.warn("[AiUsage] Không ghi được usage task {}: {}", taskCode, e.getMessage());
        }
    }

    /**
     * Ước tính thô: AI service chỉ trả TỔNG token (chưa tách input/output) nên lấy
     * trung bình đơn giá hai chiều; thiếu đơn giá nào dùng đơn giá còn lại; thiếu cả hai → null.
     */
    private BigDecimal estimateCost(long totalTokens, AiRuntimeConfigService.ActiveModel model) {
        BigDecimal input = model.inputPricePer1m();
        BigDecimal output = model.outputPricePer1m();
        BigDecimal pricePer1m;
        if (input != null && output != null) {
            pricePer1m = input.add(output).divide(BigDecimal.valueOf(2), 6, RoundingMode.HALF_UP);
        } else if (input != null) {
            pricePer1m = input;
        } else if (output != null) {
            pricePer1m = output;
        } else {
            return null;
        }
        return pricePer1m.multiply(BigDecimal.valueOf(totalTokens)).divide(ONE_MILLION, 6, RoundingMode.HALF_UP);
    }
}
