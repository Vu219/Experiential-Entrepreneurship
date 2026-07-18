package com.aima.service.Impl;

import com.aima.dto.request.BillingRateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BillingRateResponse;
import com.aima.entity.BillingRate;
import com.aima.entity.User;
import com.aima.enums.AiTaskCode;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UsageMapper;
import com.aima.repository.BillingRateRepository;
import com.aima.repository.UserRepository;
import com.aima.service.BillingRateService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BillingRateServiceImpl implements BillingRateService {

    /** Cache dòng đang mở 60s — mỗi lần gọi AI một lần resolve, không cần query lặp. */
    static final Duration CACHE_TTL = Duration.ofSeconds(60);

    BillingRateRepository billingRateRepository;
    UserRepository userRepository;
    UsageMapper usageMapper;

    @NonFinal
    volatile List<BillingRate> cachedOpenRates;

    @NonFinal
    volatile Instant cachedAt;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<BillingRateResponse>> list() {
        List<BillingRateResponse> rates = usageMapper.toBillingRateResponseList(
                billingRateRepository.findByDeletedAtIsNullOrderByEffectiveFromDescCreatedAtDesc());
        return ApiResponse.success("Lấy hệ số quy đổi hạn mức thành công", rates);
    }

    @Override
    @Transactional
    public ApiResponse<BillingRateResponse> create(String actorEmail, BillingRateRequest request) {
        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime effectiveFrom = request.getEffectiveFrom() == null ? now : request.getEffectiveFrom();
        // Không sửa lịch sử: version mới không được lùi về quá khứ (nới 1 phút cho lệch đồng hồ).
        if (effectiveFrom.isBefore(now.minusMinutes(1))) {
            throw new AppException(ErrorCode.BILLING_RATE_EFFECTIVE_FROM_INVALID);
        }

        // Đóng version đang mở cùng scope (nếu có) tại đúng mốc hiệu lực của version mới.
        billingRateRepository.findByDeletedAtIsNullAndEffectiveToIsNull().stream()
                .filter(rate -> rate.getTaskCode() == request.getTaskCode()
                        && Objects.equals(rate.getModelCode(), request.getModelCode()))
                .forEach(rate -> {
                    if (!effectiveFrom.isAfter(rate.getEffectiveFrom())) {
                        throw new AppException(ErrorCode.BILLING_RATE_EFFECTIVE_FROM_INVALID);
                    }
                    rate.setEffectiveTo(effectiveFrom);
                    billingRateRepository.save(rate);
                });

        BillingRate rate = usageMapper.toBillingRate(request, effectiveFrom, actor);
        BillingRate saved = billingRateRepository.save(rate);
        invalidateCache();

        BillingRateResponse response = usageMapper.toBillingRateResponse(saved);
        return ApiResponse.success("Đã thêm version hệ số quy đổi mới", response);
    }

    @Override
    public long toBillableUnits(AiTaskCode taskCode, String modelCode, long totalTokens) {
        if (totalTokens <= 0) {
            return 0;
        }
        BillingRate rate = resolve(taskCode, modelCode);
        if (rate == null) {
            return totalTokens; // chưa cấu hình hệ số → 1 token = 1 đơn vị hạn mức
        }
        long billable = rate.getMultiplier()
                .multiply(BigDecimal.valueOf(totalTokens))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
        if (rate.getMinCharge() != null && billable < rate.getMinCharge()) {
            billable = rate.getMinCharge();
        }
        return billable;
    }

    /** Dòng đang hiệu lực khớp scope cụ thể nhất; null = không có dòng nào khớp. */
    private BillingRate resolve(AiTaskCode taskCode, String modelCode) {
        LocalDateTime now = LocalDateTime.now();
        return openRates().stream()
                .filter(rate -> !rate.getEffectiveFrom().isAfter(now))
                .filter(rate -> rate.getTaskCode() == null || rate.getTaskCode() == taskCode)
                .filter(rate -> rate.getModelCode() == null || rate.getModelCode().equals(modelCode))
                .max(Comparator.comparingInt(BillingRateServiceImpl::specificity))
                .orElse(null);
    }

    /** (task, model)=3 > (task, *)=2 > (*, model)=1 > (*, *)=0. */
    private static int specificity(BillingRate rate) {
        return (rate.getTaskCode() != null ? 2 : 0) + (rate.getModelCode() != null ? 1 : 0);
    }

    private List<BillingRate> openRates() {
        Instant readAt = cachedAt;
        List<BillingRate> rates = cachedOpenRates;
        if (rates != null && readAt != null && Instant.now().isBefore(readAt.plus(CACHE_TTL))) {
            return rates;
        }
        rates = billingRateRepository.findByDeletedAtIsNullAndEffectiveToIsNull();
        cachedOpenRates = rates;
        cachedAt = Instant.now();
        return rates;
    }

    private void invalidateCache() {
        cachedOpenRates = null;
        cachedAt = null;
    }
}
