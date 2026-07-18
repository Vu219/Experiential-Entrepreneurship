package com.aima.service.Impl;

import com.aima.dto.ai.TokenAccountedPayload;
import com.aima.entity.AiUsage;
import com.aima.entity.User;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiUsageStatus;
import com.aima.mapper.AiConfigMapper;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.AiUsageService;
import com.aima.service.BillingRateService;
import com.aima.service.TokenCreditService;
import com.aima.service.TokenUsageService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AiUsageServiceImpl implements AiUsageService {

    static final BigDecimal ONE_MILLION = BigDecimal.valueOf(1_000_000);

    /** Đường env (config DB không hiệu lực) — backend không biết model thật sự chạy. */
    static final String UNKNOWN_MODEL_CODE = "UNKNOWN";

    AiUsageRepository usageRepository;
    UserRepository userRepository;
    AiRuntimeConfigService runtimeConfigService;
    BillingRateService billingRateService;
    TokenCreditService tokenCreditService;
    TokenUsageService tokenUsageService;
    AiConfigMapper aiConfigMapper;
    TransactionTemplate transactionTemplate;

    @Override
    public <T extends TokenAccountedPayload> T recordCall(AiCallContext context, Supplier<T> call) {
        long startNanos = System.nanoTime();
        T result;
        try {
            result = call.get();
        } catch (RuntimeException e) {
            // Ghi event lỗi rồi NÉM LẠI nguyên exception — không được nuốt/đổi luồng lỗi gốc.
            saveEvent(context, null, classify(e), elapsedMs(startNanos));
            throw e;
        }
        saveEvent(context, result, AiUsageStatus.SUCCESS, elapsedMs(startNanos));
        return result;
    }

    /** Best-effort: chạy NGOÀI transaction của worker; mọi lỗi ghi log chỉ warn, không ném. */
    private void saveEvent(AiCallContext context, TokenAccountedPayload result,
                           AiUsageStatus status, long latencyMs) {
        try {
            Long totalTokens = result == null ? null : result.getTokensUsed();
            if (status == AiUsageStatus.SUCCESS && (totalTokens == null || totalTokens <= 0)) {
                return; // cuộc gọi không tiêu token (endpoint không chạm LLM) — không có gì để ghi
            }

            AiRuntimeConfigService.ActiveModel model = runtimeConfigService.getActiveModel(context.taskCode());
            AiProviderCode providerCode = model == null ? AiProviderCode.UNKNOWN : model.providerCode();
            String modelCode = model == null ? UNKNOWN_MODEL_CODE : model.modelCode();

            long total;
            long billable;
            BigDecimal cost;
            String idempotencyKey;
            if (status == AiUsageStatus.SUCCESS) {
                total = totalTokens;
                billable = billingRateService.toBillableUnits(context.taskCode(), modelCode, total);
                cost = model == null ? null : estimateCost(total, model);
                idempotencyKey = idempotencyKey(context);
            } else {
                // Request lỗi: input/output giữ NULL ("không biết", khác 0) qua result = null;
                // total_tokens = 0 (cột NOT NULL) và KHÔNG trừ hạn mức (billable = 0).
                total = 0;
                billable = 0;
                cost = null;
                idempotencyKey = null; // mỗi lần thử lỗi là một event riêng
            }

            long totalFinal = total;
            long billableFinal = billable;
            BigDecimal costFinal = cost;
            String keyFinal = idempotencyKey;
            // recordCall chạy NGOÀI transaction của worker (quanh HTTP call) → tự mở tx ngắn để ghi.
            // Trùng idempotency → cả event + tiêu credit + cache cùng rollback (không double-debit).
            transactionTemplate.executeWithoutResult(tx -> {
                User user = context.userId() == null ? null : userRepository.findById(context.userId()).orElse(null);

                long creditUnits = 0;
                long creditShortfall = 0;
                if (status == AiUsageStatus.SUCCESS && user != null && billableFinal > 0) {
                    // Trừ hạn mức GÓI trước; phần vượt mới tiêu token mua thêm (FIFO). Đo quota
                    // TRƯỚC khi lưu event này nên allowance chưa gồm chính nó.
                    TokenUsageService.QuotaState quota = tokenUsageService.state(user);
                    if (quota.limit() != null) {
                        long allowance = Math.max(0, quota.limit() - quota.used());
                        long overflow = Math.max(0, billableFinal - allowance);
                        if (overflow > 0) {
                            TokenCreditService.Consumption consumption =
                                    tokenCreditService.consume(user.getId(), overflow);
                            creditUnits = consumption.consumed();
                            creditShortfall = consumption.shortfall();
                        }
                    }
                    // Nuôi cache users.tokens_used bằng ĐƠN VỊ TRỪ HẠN MỨC GÓI (billable − credit)
                    // — không còn nuôi ở worker, hết lệch khi hệ số quy đổi ≠ 1.
                    tokenUsageService.record(user, billableFinal - creditUnits);
                }

                AiUsage usage = aiConfigMapper.toUsage(user, context, result, providerCode, modelCode,
                        totalFinal, status, latencyMs, billableFinal, creditUnits, creditShortfall,
                        costFinal, YearMonth.now().toString(), keyFinal);
                usageRepository.save(usage);
            });
        } catch (DataIntegrityViolationException e) {
            // Job được xử lý lại (crash rescue) — event SUCCESS đã ghi trước đó, bỏ qua để không double-count.
            log.info("[AiUsage] Trùng idempotency key task {} request {} — bỏ qua event lặp",
                    context.taskCode(), context.requestId());
        } catch (Exception e) {
            log.warn("[AiUsage] Không ghi được usage task {}: {}", context.taskCode(), e.getMessage());
        }
    }

    private static String idempotencyKey(AiCallContext context) {
        if (context.requestId() == null) {
            return null;
        }
        String key = context.requestId() + ":" + context.taskCode();
        return context.callLabel() == null ? key : key + ":" + context.callLabel();
    }

    /** Timeout (WebClient/reactor) tách khỏi lỗi thường — soi hạ tầng/model chậm. */
    private static AiUsageStatus classify(Throwable e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (cause instanceof TimeoutException
                    || cause.getClass().getName().equals("io.netty.handler.timeout.ReadTimeoutException")) {
                return AiUsageStatus.TIMEOUT;
            }
            if (cause == cause.getCause()) {
                break;
            }
        }
        return AiUsageStatus.ERROR;
    }

    private static long elapsedMs(long startNanos) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
    }

    /**
     * Ước tính chi phí USD theo đơn giá ai_models: có breakdown input/output thì tính chính xác
     * từng chiều; chỉ có tổng thì lấy trung bình đơn giá hai chiều như trước.
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
