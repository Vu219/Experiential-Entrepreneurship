package com.aima.config;

import com.aima.entity.User;
import com.aima.enums.UserStatus;
import com.aima.repository.UserRepository;
import com.aima.service.EmailService;
import com.aima.service.AccountPurgeService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AccountDeletionScheduler {

    UserRepository userRepository;
    EmailService emailService;
    AccountPurgeService accountPurgeService;
    TransactionTemplate transactionTemplate;

    // Chạy lúc 00:00 mỗi ngày, dọn các tài khoản PENDING_DELETE đã quá hạn 30 ngày.
    // MỖI user một transaction: user bị chặn (còn đơn PENDING) hoặc lỗi chỉ bị bỏ qua và thử lại
    // đêm sau, không kéo cả lô rollback.
    @Scheduled(cron = "0 0 0 * * *")
    @SchedulerLock(name = "account-deletion-purge", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void purgeExpiredAccounts() {
        List<User> expiredUsers = userRepository
                .findAllByStatusAndDeletionDateLessThanEqual(UserStatus.PENDING_DELETE, LocalDateTime.now());

        if (expiredUsers.isEmpty()) {
            log.info("[AccountDeletion] No expired accounts to purge.");
            return;
        }

        log.info("[AccountDeletion] Purging {} expired account(s)...", expiredUsers.size());
        int purged = 0;
        for (User expired : expiredUsers) {
            try {
                transactionTemplate.executeWithoutResult(tx -> {
                    // Ẩn danh payments, dọn FK không cascade, hẹn revoke token Meta sau commit.
                    accountPurgeService.prepareForHardDelete(expired.getId());
                    // Xóa CỨNG + cascade (brand/content/post/kết nối/thông báo/job async/subscription).
                    userRepository.findById(expired.getId()).ifPresent(userRepository::delete);
                });
                purged++;
            } catch (Exception e) {
                log.warn("[AccountDeletion] Bỏ qua tài khoản {} lần này (thử lại đêm sau): {}",
                        expired.getId(), e.getMessage());
            }
        }
        log.info("[AccountDeletion] Successfully purged {}/{} account(s).", purged, expiredUsers.size());
    }

    // Chạy 09:00 mỗi ngày: cảnh báo qua email các tài khoản còn ≤ 7 ngày trước khi bị xóa (gửi 1 lần).
    @Scheduled(cron = "0 0 9 * * *")
    @SchedulerLock(name = "account-deletion-warning", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    @Transactional
    public void warnUpcomingDeletions() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime threshold = now.plusDays(7);
        List<User> users = userRepository.findUsersToWarnOfDeletion(UserStatus.PENDING_DELETE, now, threshold);

        if (users.isEmpty()) {
            return;
        }

        log.info("[AccountDeletion] Sending 7-day deletion warning to {} account(s)...", users.size());
        for (User user : users) {
            long daysRemaining = Math.max(1, (ChronoUnit.HOURS.between(now, user.getDeletionDate()) + 23) / 24);
            try {
                emailService.sendAccountDeletionWarningEmail(
                        user.getEmail(), user.getFullName(), user.getDeletionDate(), daysRemaining);
                user.setDeletionWarningSentAt(now);
                userRepository.save(user);
            } catch (Exception e) {
                // Resilient: lỗi gửi mail cho 1 user không làm hỏng cả job — thử lại ở lần chạy sau.
                log.warn("[AccountDeletion] Không gửi được email cảnh báo xóa cho {}: {}", user.getEmail(), e.getMessage());
            }
        }
    }
}
