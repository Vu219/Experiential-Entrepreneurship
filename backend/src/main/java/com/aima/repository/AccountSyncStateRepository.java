package com.aima.repository;

import com.aima.entity.AccountSyncState;
import com.aima.enums.Platform;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountSyncStateRepository extends JpaRepository<AccountSyncState, UUID> {

    Optional<AccountSyncState> findByPlatformAccount_IdAndDeletedAtIsNull(UUID platformAccountId);

    List<AccountSyncState> findByPlatformAccount_IdInAndDeletedAtIsNull(Collection<UUID> platformAccountIds);

    /**
     * Kênh đăng đến hạn đồng bộ cấp tài khoản: ACTIVE, thuộc nền tảng đã hỗ trợ, và chưa có trạng thái (lần đầu)
     * hoặc {@code nextSyncAt} đã tới. {@code nextSyncAt} null = không tự đồng bộ (kết nối mẫu dev-seed).
     */
    @Query("select a.id from PlatformAccount a where a.deletedAt is null "
            + "and a.connectionStatus = com.aima.enums.ConnectionStatus.ACTIVE "
            + "and a.accountType <> com.aima.enums.PlatformAccountType.USER "
            + "and a.platformName in :platforms "
            + "and not exists (select s from AccountSyncState s where s.platformAccount = a and s.deletedAt is null "
            + "    and (s.nextSyncAt is null or s.nextSyncAt > :now)) "
            + "order by a.id")
    List<UUID> findDueAccounts(@Param("platforms") Collection<Platform> platforms, @Param("now") Instant now,
                               Pageable pageable);

    /**
     * Nút "Làm mới": đưa kênh đăng của user về hạn ngay (quét bài mới + insights ở lượt kế tiếp). Bỏ qua kênh vừa
     * đồng bộ trong {@code minLastSync}, kênh đang lỗi (giữ backoff) và kênh không tự đồng bộ.
     */
    @Modifying
    @Query("update AccountSyncState s set s.nextSyncAt = :now "
            + "where s.deletedAt is null and s.nextSyncAt is not null and s.consecutiveFailures = 0 "
            + "and (s.lastSyncedAt is null or s.lastSyncedAt < :minLastSync) "
            + "and s.platformAccount.id in (select a.id from PlatformAccount a where a.user.id = :userId and a.deletedAt is null)")
    int markDueNow(@Param("userId") UUID userId, @Param("now") Instant now, @Param("minLastSync") Instant minLastSync);

    /** Lần quét kênh gần nhất của user — cùng "phiên bản dữ liệu" trong khoá cache của trang Phân tích. */
    @Query("select max(s.lastSyncedAt) from AccountSyncState s where s.platformAccount.user.id = :userId")
    Instant findLatestSyncForUser(@Param("userId") UUID userId);

    /** Dev-seed clear: xoá cứng trạng thái của tài khoản MẪU (trước khi xoá kết nối). */
    @Modifying
    @Query("delete from AccountSyncState s where s.platformAccount.id in :accountIds")
    int deleteForAccounts(@Param("accountIds") Collection<UUID> accountIds);
}
