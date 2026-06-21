package com.aima.config;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.aima.enums.UserStatus;
import com.aima.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AccountDeletionScheduler {

    UserRepository userRepository;

    // Chạy lúc 00:00 mỗi ngày, dọn các tài khoản PENDING_DELETE đã quá hạn 30 ngày.
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void purgeExpiredAccounts() {
        List<com.aima.entity.User> expiredUsers = userRepository
                .findAllByStatusAndDeletionDateLessThanEqual(UserStatus.PENDING_DELETE, LocalDateTime.now());

        if (expiredUsers.isEmpty()) {
            log.info("[AccountDeletion] No expired accounts to purge.");
            return;
        }

        log.info("[AccountDeletion] Purging {} expired account(s)...", expiredUsers.size());

        // TODO: Add audit log before deletion (e.g. save to audit_logs table)
        userRepository.deleteAll(expiredUsers);

        log.info("[AccountDeletion] Successfully purged {} account(s).", expiredUsers.size());
    }
}
