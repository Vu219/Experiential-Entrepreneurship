package com.aima.repository;

import com.aima.entity.User;
import com.aima.enums.UserStatus;
import com.aima.repository.projection.DailyCountProjection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;


import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    List<User> findAllByStatusAndDeletionDateLessThanEqual(UserStatus status, LocalDateTime now);

    // FR-80: admin tìm user theo tên/email + lọc trạng thái/vai trò/gói (tham số rỗng/null = bỏ qua —
    // native query + CAST cùng mẫu ContentItemRepository.search).
    @Query(value = """
            select u.* from users u
            join roles r on r.id = u.role_id
            where u.deleted_at is null
              and (CAST(:q as varchar) = '' or lower(u.full_name) like lower(concat('%', CAST(:q as varchar), '%'))
                   or lower(u.email) like lower(concat('%', CAST(:q as varchar), '%')))
              and (CAST(:status as varchar) is null or u.status = CAST(:status as varchar))
              and (CAST(:role as varchar) is null or r.role_name = CAST(:role as varchar))
              and (CAST(:plan as varchar) is null or u.plan = CAST(:plan as varchar))
            order by u.created_at desc
            """, nativeQuery = true)
    Page<User> search(@Param("q") String q, @Param("status") String status,
                      @Param("role") String role, @Param("plan") String plan, Pageable pageable);

    // FR-80: số liệu stat card cho trang Quản trị người dùng.
    long countByDeletedAtIsNull();
    long countByStatusAndDeletedAtIsNull(UserStatus status);
    long countByCreatedAtGreaterThanEqualAndDeletedAtIsNull(LocalDateTime from);

    // ===== Tổng quan quản trị (UI-10) =====

    /** Tổng user tích lũy tính tới một mốc — mẫu số % thay đổi "so với tuần trước". */
    long countByCreatedAtLessThanAndDeletedAtIsNull(LocalDateTime before);

    /** Số user MỚI mỗi ngày kể từ :from — dựng sparkline tích lũy 7 ngày. */
    @Query(value = """
            select to_char(created_at, 'YYYY-MM-DD') as day, count(*) as total
            from users
            where deleted_at is null and created_at >= :from
            group by 1
            """, nativeQuery = true)
    List<DailyCountProjection> countDailyNewUsers(@Param("from") LocalDateTime from);

    /** N user mới nhất cho bảng "Người dùng gần đây" (Pageable giới hạn số dòng). */
    List<User> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    // Cảnh báo "còn ≤ 7 ngày trước khi xóa": PENDING_DELETE, chưa gửi cảnh báo, hạn xóa trong (now, threshold].
    @Query("""
            select u from User u
            where u.status = :status
              and u.deletionWarningSentAt is null
              and u.deletionDate is not null
              and u.deletionDate > :now
              and u.deletionDate <= :threshold
            """)
    List<User> findUsersToWarnOfDeletion(@Param("status") UserStatus status,
                                         @Param("now") LocalDateTime now,
                                         @Param("threshold") LocalDateTime threshold);
}
