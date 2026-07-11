package com.aima.repository;

import com.aima.entity.PlatformAccount;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.Platform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlatformAccountRepository extends JpaRepository<PlatformAccount, UUID> {

    List<PlatformAccount> findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    Optional<PlatformAccount> findByIdAndUser_IdAndDeletedAtIsNull(UUID id, UUID userId);

    // Chống trùng kết nối (kết hợp partial unique index trong PlatformDataInitializer).
    Optional<PlatformAccount> findByUser_IdAndPlatformNameAndPlatformAccountIdAndDeletedAtIsNull(
            UUID userId, Platform platformName, String platformAccountId);

    // Con (Page/IG) thuộc một kết nối gốc — dùng để cascade soft delete.
    List<PlatformAccount> findByParentConnection_IdAndDeletedAtIsNull(UUID parentId);

    long countByUser_IdAndDeletedAtIsNull(UUID userId);

    long countByUser_IdAndConnectionStatusAndDeletedAtIsNull(UUID userId, ConnectionStatus status);

    // TokenHealthCheckJob: token sắp hết hạn trong khoảng [now, threshold].
    List<PlatformAccount> findByConnectionStatusAndTokenExpiredAtBetweenAndDeletedAtIsNull(
            ConnectionStatus status, LocalDateTime from, LocalDateTime to);

    // TokenValidationJob: mẫu các kết nối đang ACTIVE để ping /me.
    List<PlatformAccount> findByConnectionStatusAndDeletedAtIsNull(ConnectionStatus status);

    // FR-81: tổng kết nối ACTIVE toàn hệ thống (trang System status của admin).
    long countByConnectionStatusAndDeletedAtIsNull(ConnectionStatus status);
}
