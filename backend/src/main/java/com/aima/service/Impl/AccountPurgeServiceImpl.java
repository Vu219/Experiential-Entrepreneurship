package com.aima.service.Impl;

import com.aima.enums.PaymentStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.AiConfigAuditRepository;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.BillingRateRepository;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PlatformApiVersionHistoryRepository;
import com.aima.repository.PlatformApiVersionRepository;
import com.aima.repository.TokenCreditRepository;
import com.aima.repository.UsageAdjustmentRepository;
import com.aima.service.AccountPurgeService;
import com.aima.service.MetaOAuthService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AccountPurgeServiceImpl implements AccountPurgeService {

    PaymentRepository paymentRepository;
    TokenCreditRepository tokenCreditRepository;
    AiUsageRepository aiUsageRepository;
    AiConfigAuditRepository aiConfigAuditRepository;
    BillingRateRepository billingRateRepository;
    PlatformApiVersionRepository platformApiVersionRepository;
    PlatformApiVersionHistoryRepository platformApiVersionHistoryRepository;
    UsageAdjustmentRepository usageAdjustmentRepository;
    MetaOAuthService metaOAuthService;

    // MANDATORY: các UPDATE hàng loạt ở đây chỉ an toàn khi cùng transaction với lệnh DELETE user —
    // tách ra thì ẩn danh xong mà xoá hỏng sẽ để lại đơn mồ côi.
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void prepareForHardDelete(UUID userId) {
        if (paymentRepository.existsByUser_IdAndStatusAndDeletedAtIsNull(userId, PaymentStatus.PENDING)) {
            throw new AppException(ErrorCode.USER_HAS_PENDING_PAYMENT);
        }
        int payments = paymentRepository.anonymizeByUserId(userId);
        int credits = tokenCreditRepository.deleteByUserId(userId);
        int usageEvents = aiUsageRepository.detachUser(userId);
        aiConfigAuditRepository.clearActor(userId);
        billingRateRepository.clearCreatedBy(userId);
        platformApiVersionRepository.clearUpdatedBy(userId);
        platformApiVersionHistoryRepository.clearChangedBy(userId);
        usageAdjustmentRepository.clearActor(userId);
        metaOAuthService.revokeAllForUserAfterCommit(userId);
        log.info("[AccountPurge] User {}: ẩn danh {} đơn, xoá {} credit, tách {} event AI", userId, payments, credits, usageEvents);
    }
}
