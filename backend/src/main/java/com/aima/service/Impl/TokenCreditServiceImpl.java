package com.aima.service.Impl;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.TokenCreditResponse;
import com.aima.entity.TokenCredit;
import com.aima.entity.User;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UsageMapper;
import com.aima.repository.TokenCreditRepository;
import com.aima.repository.UserRepository;
import com.aima.service.TokenCreditService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import com.aima.service.SystemLogService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TokenCreditServiceImpl implements TokenCreditService {

    TokenCreditRepository tokenCreditRepository;
    UserRepository userRepository;
    UsageMapper usageMapper;
    SystemLogService systemLogService;
    Environment environment;

    /** Cờ dev-only cho devSeed — mặc định TẮT, chỉ bật ở môi trường dev (.env). */
    @NonFinal
    @Value("${aima.dev.credit-seed-enabled:false}")
    boolean creditSeedEnabled;

    /**
     * Công tắc production ĐỘC LẬP với Spring profile (env AIMA_PRODUCTION_MODE=true trên môi
     * trường thật): chặn cứng mọi dev-tool mà không kéo theo side effect nào của việc bật
     * profile. Profile prod/production vẫn được kiểm tra thêm như lớp belt thứ hai.
     */
    @NonFinal
    @Value("${aima.production-mode:false}")
    boolean productionMode;

    @Override
    public long creditLeft(UUID userId) {
        return tokenCreditRepository.sumRemainingForUser(userId, LocalDateTime.now());
    }

    @Override
    public Consumption consume(UUID userId, long unitsNeeded) {
        if (unitsNeeded <= 0) {
            return Consumption.NONE;
        }
        LocalDateTime now = LocalDateTime.now();
        long remaining = unitsNeeded;
        // FIFO qua NHIỀU dòng; mỗi dòng trừ bằng UPDATE nguyên tử (điều kiện hết hạn/số dư
        // nằm TRONG update) — 0 row = dòng bị request song song lấy mất, chuyển dòng kế.
        for (TokenCredit credit : tokenCreditRepository.findConsumableFifo(userId, now)) {
            if (remaining <= 0) {
                break;
            }
            long available = credit.getTokensGranted() - credit.getTokensConsumed();
            long take = Math.min(remaining, available);
            if (take <= 0) {
                continue;
            }
            if (tokenCreditRepository.consumeAtomically(credit.getId(), take, now) > 0) {
                remaining -= take;
            }
        }
        long consumed = unitsNeeded - remaining;
        if (remaining > 0) {
            log.warn("[TokenCredit] User {} thiếu {} đơn vị credit cho event đã gọi AI xong — "
                    + "ghi shortfall, lần checkQuota sau sẽ chặn", userId, remaining);
        }
        return new Consumption(consumed, remaining);
    }

    @Override
    @Transactional
    public ApiResponse<List<TokenCreditResponse>> devSeed(String actorEmail, UUID userId, String scenario) {
        // Ba lớp khoá: cờ .env (mặc định tắt) VÀ chặn cứng khi AIMA_PRODUCTION_MODE=true
        // (biến độc lập, khuyến nghị cho môi trường thật) VÀ chặn theo profile prod (belt).
        if (!creditSeedEnabled || productionMode || isProductionProfile()) {
            throw new AppException(ErrorCode.DEV_TOOL_DISABLED);
        }
        User user = userRepository.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        LocalDateTime now = LocalDateTime.now();
        String kind = scenario == null ? "SIMPLE" : scenario.trim().toUpperCase(Locale.ROOT);
        List<TokenCredit> credits = switch (kind) {
            case "SIMPLE" -> List.of(
                    usageMapper.toCredit(user, 10_000L, null, "dev-seed SIMPLE: 10K không hạn"));
            case "FIFO" -> List.of(
                    usageMapper.toCredit(user, 1_000L, now.plusMinutes(10), "dev-seed FIFO #1: hết hạn sau 10'"),
                    usageMapper.toCredit(user, 2_000L, now.plusDays(1), "dev-seed FIFO #2: hết hạn sau 1 ngày"),
                    usageMapper.toCredit(user, 5_000L, null, "dev-seed FIFO #3: không hạn — tiêu CUỐI CÙNG"));
            case "EXPIRY" -> List.of(
                    usageMapper.toCredit(user, 1_000L, now.minusDays(1),
                            "dev-seed EXPIRY #1: ĐÃ hết hạn — không bao giờ được tiêu"),
                    usageMapper.toCredit(user, 1_000L, now.plusMinutes(5), "dev-seed EXPIRY #2: hết hạn sau 5'"));
            default -> throw new AppException(ErrorCode.DEV_SEED_SCENARIO_INVALID);
        };

        List<TokenCreditResponse> responses = usageMapper.toCreditResponseList(
                tokenCreditRepository.saveAll(credits));
        // Audit bắt buộc: endpoint tạo credit miễn phí — ai gọi, cho user nào, kịch bản gì.
        systemLogService.info("admin.devtools",
                "DEV seed token_credits: actor=" + actorEmail + ", targetUser=" + user.getEmail()
                        + " (" + userId + "), scenario=" + kind + ", rows=" + responses.size());
        log.info("[TokenCredit] DEV seed {} cho user {} bởi {}: {} dòng", kind, userId, actorEmail, responses.size());
        return ApiResponse.success("Đã seed token credit (dev) — kịch bản " + kind, responses);
    }

    /** Profile prod/production đang bật → mọi dev-tool bị chặn cứng bất kể cờ .env. */
    private boolean isProductionProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }
}
