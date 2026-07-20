package com.aima.repository;

import com.aima.entity.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {

    /**
     * Điều kiện lọc dùng chung của tab "Log hoạt động người dùng" (mọi tham số null = bỏ qua).
     * Native + {@code CAST(:param AS ...)} vì PostgreSQL không suy được kiểu của bind null trong
     * {@code ? IS NULL} (SQLState 42P18) — cùng lý do đã ghi ở
     * {@link AiUsageRepository#EVENT_FILTER}. Enum bind dạng String để so khớp cột lưu STRING.
     *
     * <p>{@code q} tìm theo email snapshot HOẶC tên người dùng — tên không nằm trên bảng log
     * (chỉ snapshot email, xem {@code ActivityLog}) nên phải dò qua subquery {@code users}.
     * User đã bị xoá thì chỉ còn khớp được theo email snapshot, đúng như thiết kế.
     */
    String ACTIVITY_FILTER = """
            deleted_at is null
            and (CAST(:from as timestamp) is null or created_at >= CAST(:from as timestamp))
            and (CAST(:to as timestamp) is null or created_at < CAST(:to as timestamp))
            and (CAST(:userId as uuid) is null or user_id = CAST(:userId as uuid))
            and (CAST(:action as varchar) is null or action = CAST(:action as varchar))
            and (CAST(:result as varchar) is null or result = CAST(:result as varchar))
            and (CAST(:q as varchar) is null
                 or user_email_snapshot ILIKE '%' || CAST(:q as varchar) || '%'
                 or user_id in (select u.id from users u
                                where u.full_name ILIKE '%' || CAST(:q as varchar) || '%'))
            """;

    @Query(value = "select * from activity_logs where " + ACTIVITY_FILTER
            + " order by created_at desc, id desc",
            countQuery = "select count(*) from activity_logs where " + ACTIVITY_FILTER,
            nativeQuery = true)
    Page<ActivityLog> search(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                             @Param("userId") UUID userId, @Param("action") String action,
                             @Param("result") String result, @Param("q") String q,
                             Pageable pageable);

    /** Export CSV: cùng filter, không offset — lấy theo lô để không nạp cả tập vào bộ nhớ. */
    @Query(value = "select * from activity_logs where " + ACTIVITY_FILTER
            + " order by created_at desc, id desc", nativeQuery = true)
    List<ActivityLog> searchForExport(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                                      @Param("userId") UUID userId, @Param("action") String action,
                                      @Param("result") String result, @Param("q") String q,
                                      Pageable pageable);

    @Query(value = "select count(*) from activity_logs where " + ACTIVITY_FILTER, nativeQuery = true)
    long countMatching(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                       @Param("userId") UUID userId, @Param("action") String action,
                       @Param("result") String result, @Param("q") String q);

    /**
     * Chống spam: đã có bản ghi CÙNG (userId, action, targetId) trong cửa sổ dedup chưa.
     * {@code targetId} null được coi là khớp với null (hành động không gắn đối tượng, vd LOGIN)
     * — {@code is not distinct from} xử lý đúng NULL, khác hẳn {@code =}.
     * Dùng index {@code idx_activity_logs_user_created}.
     */
    @Query(value = """
            select exists(select 1 from activity_logs
                          where user_id = :userId
                            and action = CAST(:action as varchar)
                            and target_id is not distinct from CAST(:targetId as varchar)
                            and created_at >= :since)
            """, nativeQuery = true)
    boolean existsRecentDuplicate(@Param("userId") UUID userId, @Param("action") String action,
                                  @Param("targetId") String targetId, @Param("since") LocalDateTime since);

    /**
     * Đếm số dòng CÙNG action từ CÙNG một IP trong cửa sổ thời gian — chống phình cho các action
     * được miễn dedup ({@code ActivityAction.DEDUP_EXEMPT}), điển hình là LOGIN_FAILED bị dội từ
     * một nguồn. Dùng index {@code idx_activity_logs_action_created}.
     */
    @Query(value = """
            select count(*) from activity_logs
            where action = CAST(:action as varchar)
              and ip = CAST(:ip as varchar)
              and created_at >= :since
            """, nativeQuery = true)
    long countByActionAndIpSince(@Param("action") String action, @Param("ip") String ip,
                                 @Param("since") LocalDateTime since);
}
