package com.aima.repository;

import com.aima.entity.SystemLog;
import com.aima.enums.LogLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface SystemLogRepository extends JpaRepository<SystemLog, UUID> {

    // FR-81: các lỗi mới nhất làm alert nhanh trên trang System status.
    List<SystemLog> findTop5ByLevelAndDeletedAtIsNullOrderByCreatedAtDesc(LogLevel level);

    /**
     * FR-84 trang Logs (tab "Log lỗi hệ thống"): lọc mức + khoảng ngày + tìm kiếm (message/module),
     * phân trang server-side. Mọi tham số optional (null = bỏ qua). Native + {@code CAST(:param AS ...)}
     * vì PostgreSQL không suy được kiểu của bind null trong biểu thức {@code ? IS NULL}.
     * {@code level} bind dạng String.
     *
     * <p><b>{@code module NOT LIKE 'admin.%'}</b> — các dòng {@code admin.usage.*} / {@code admin.devtools}
     * là DẤU VẾT NGHIỆP VỤ (ai xem IP của ai, ai export…) chứ không phải lỗi hệ thống; chúng lọt vào
     * bảng này vì trước đây chưa có nơi khác để ghi. Nay đã có {@code activity_logs} nên tab lỗi loại
     * chúng ra. CỐ Ý không migrate dữ liệu cũ: {@code message} là chuỗi tự do, parse ngược ra
     * userId/targetId chắc chắn sai — số cũ sẽ tự hết khi retention 180 ngày quét qua
     * (xem docs/ROADMAP_FUTURE.md).
     */
    @Query(value = """
            SELECT * FROM system_logs
            WHERE deleted_at IS NULL
              AND module NOT LIKE 'admin.%'
              AND (CAST(:level AS varchar) IS NULL OR level = CAST(:level AS varchar))
              AND (CAST(:from AS timestamp) IS NULL OR created_at >= CAST(:from AS timestamp))
              AND (CAST(:to AS timestamp) IS NULL OR created_at <= CAST(:to AS timestamp))
              AND (CAST(:q AS varchar) IS NULL OR message ILIKE '%' || CAST(:q AS varchar) || '%'
                   OR module ILIKE '%' || CAST(:q AS varchar) || '%')
            ORDER BY created_at DESC
            """,
            countQuery = """
                    SELECT COUNT(*) FROM system_logs
                    WHERE deleted_at IS NULL
                      AND (CAST(:level AS varchar) IS NULL OR level = CAST(:level AS varchar))
                      AND (CAST(:from AS timestamp) IS NULL OR created_at >= CAST(:from AS timestamp))
                      AND (CAST(:to AS timestamp) IS NULL OR created_at <= CAST(:to AS timestamp))
                      AND (CAST(:q AS varchar) IS NULL OR message ILIKE '%' || CAST(:q AS varchar) || '%'
                           OR module ILIKE '%' || CAST(:q AS varchar) || '%')
                    """,
            nativeQuery = true)
    Page<SystemLog> search(@Param("level") String level,
                           @Param("from") LocalDateTime from,
                           @Param("to") LocalDateTime to,
                           @Param("q") String q,
                           Pageable pageable);

    /**
     * Gom nhóm log trùng (level+module+message) thành 1 dòng: số đếm + thời điểm mới nhất.
     * Cùng cách CAST tham số như {@link #search}. Cột trả:
     * [0] sample id, [1] level, [2] module, [3] message, [4] count, [5] last_at.
     */
    @Query(value = """
            SELECT MIN(CAST(id AS text)) AS id, level, module, message,
                   COUNT(*) AS cnt, MAX(created_at) AS last_at
            FROM system_logs
            WHERE deleted_at IS NULL
              AND module NOT LIKE 'admin.%'
              AND (CAST(:level AS varchar) IS NULL OR level = CAST(:level AS varchar))
              AND (CAST(:from AS timestamp) IS NULL OR created_at >= CAST(:from AS timestamp))
              AND (CAST(:to AS timestamp) IS NULL OR created_at <= CAST(:to AS timestamp))
              AND (CAST(:q AS varchar) IS NULL OR message ILIKE '%' || CAST(:q AS varchar) || '%'
                   OR module ILIKE '%' || CAST(:q AS varchar) || '%')
            GROUP BY level, module, message
            ORDER BY last_at DESC
            """,
            countQuery = """
                    SELECT COUNT(*) FROM (
                      SELECT 1 FROM system_logs
                      WHERE deleted_at IS NULL
                        AND (CAST(:level AS varchar) IS NULL OR level = CAST(:level AS varchar))
                        AND (CAST(:from AS timestamp) IS NULL OR created_at >= CAST(:from AS timestamp))
                        AND (CAST(:to AS timestamp) IS NULL OR created_at <= CAST(:to AS timestamp))
                        AND (CAST(:q AS varchar) IS NULL OR message ILIKE '%' || CAST(:q AS varchar) || '%'
                             OR module ILIKE '%' || CAST(:q AS varchar) || '%')
                      GROUP BY level, module, message
                    ) g
                    """,
            nativeQuery = true)
    Page<Object[]> searchGrouped(@Param("level") String level,
                                 @Param("from") LocalDateTime from,
                                 @Param("to") LocalDateTime to,
                                 @Param("q") String q,
                                 Pageable pageable);
}
