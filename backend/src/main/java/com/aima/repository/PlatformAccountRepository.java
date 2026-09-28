package com.aima.repository;

import com.aima.entity.PlatformAccount;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlatformAccountRepository extends JpaRepository<PlatformAccount, UUID> {

    List<PlatformAccount> findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    Optional<PlatformAccount> findByIdAndUser_IdAndDeletedAtIsNull(UUID id, UUID userId);

    Optional<PlatformAccount> findByIdAndDeletedAtIsNull(UUID id);

    // Ngắt kết nối cần user (email cho activity log, owner cho notification) → fetch cùng lúc,
    // không dựa vào lazy proxy (open-in-view đang tắt).
    @Query("select a from PlatformAccount a join fetch a.user u "
            + "where a.id = :id and u.id = :userId and a.deletedAt is null")
    Optional<PlatformAccount> findWithUserByIdAndUserId(UUID id, UUID userId);

    // Chống trùng kết nối (kết hợp partial unique index trong PlatformDataInitializer).
    Optional<PlatformAccount> findByUser_IdAndPlatformNameAndPlatformAccountIdAndDeletedAtIsNull(
            UUID userId, Platform platformName, String platformAccountId);

    // Callback của Meta (deauthorize/data deletion) chỉ mang user_id → tìm kết nối gốc ở MỌI user AIMA.
    List<PlatformAccount> findByPlatformNameAndAccountTypeAndPlatformAccountIdAndDeletedAtIsNull(
            Platform platformName, PlatformAccountType accountType, String platformAccountId);

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
