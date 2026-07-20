package com.aima.repository;

import com.aima.entity.Payment;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Truy vấn sổ cái {@code payments} cho trang admin "Quản lý doanh thu".
 *
 * <p><b>Mọi phép gộp chạy ở tầng DB</b> ({@code GROUP BY date_trunc(...)}), không bao giờ load
 * hết bản ghi rồi cộng trong Java — bảng này lớn dần theo doanh số.
 *
 * <p><b>Công thức net, không hồi tố</b> (chốt 2026-07-20): phần GỘP quy kỳ theo {@code paid_at}
 * của đơn đã từng thu được tiền; phần TRỪ quy kỳ theo {@code refunded_at}. Hai vế gộp riêng rồi
 * cộng lại bằng {@code UNION ALL} trong MỘT lượt truy vấn.
 *
 * <p>Danh sách trạng thái tính doanh thu luôn bind qua {@code :paidStatuses}
 * ({@link PaymentStatus#revenueRecognizedNames()}) — không nhúng literal SQL rải rác.
 */
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    /**
     * Chuỗi doanh thu theo bucket thời gian. {@code unit} là đơn vị {@code date_trunc}
     * ('day'|'month'|'year') — bind qua {@code CAST(:unit AS text)} vì PostgreSQL cần biết kiểu.
     *
     * <p>Chỉ trả các bucket CÓ dữ liệu; việc điền kỳ trống bằng 0 (để chart không gãy) do
     * service làm, vì chỉ service mới biết bộ kỳ đầy đủ của granularity đang chọn.
     */
    @Query(value = """
            select bucket, sum(gross) as gross, sum(txn_count) as txnCount, sum(refunded) as refunded
            from (
                select date_trunc(CAST(:unit as text), paid_at) as bucket,
                       sum(amount)          as gross,
                       count(*)             as txn_count,
                       CAST(0 as bigint)    as refunded
                from payments
                where deleted_at is null
                  and status in (:paidStatuses)
                  and paid_at >= :from and paid_at < :to
                group by 1
                union all
                select date_trunc(CAST(:unit as text), refunded_at) as bucket,
                       CAST(0 as bigint)    as gross,
                       CAST(0 as bigint)    as txn_count,
                       sum(refunded_amount) as refunded
                from payments
                where deleted_at is null
                  and refunded_at is not null
                  and refunded_at >= :from and refunded_at < :to
                group by 1
            ) t
            group by bucket
            order by bucket
            """, nativeQuery = true)
    List<RevenueBucket> aggregateByBucket(@Param("unit") String unit,
                                          @Param("from") LocalDateTime from,
                                          @Param("to") LocalDateTime to,
                                          @Param("paidStatuses") Collection<String> paidStatuses);

    /**
     * Tổng của MỘT khoảng — dùng cho KPI kỳ hiện tại và kỳ trước (tính % thay đổi).
     * Bốn subquery độc lập, mỗi cái đi đúng một index, rẻ hơn một lượt quét kèm CASE WHEN.
     * {@code failedCount} quy kỳ theo {@code ordered_at} vì đơn hỏng không có {@code paid_at}.
     */
    @Query(value = """
            select
                (select coalesce(sum(amount), 0) from payments
                  where deleted_at is null and status in (:paidStatuses)
                    and paid_at >= :from and paid_at < :to)          as gross,
                (select count(*) from payments
                  where deleted_at is null and status in (:paidStatuses)
                    and paid_at >= :from and paid_at < :to)          as txnCount,
                (select coalesce(sum(refunded_amount), 0) from payments
                  where deleted_at is null and refunded_at is not null
                    and refunded_at >= :from and refunded_at < :to)  as refunded,
                (select count(*) from payments
                  where deleted_at is null and status = 'FAILED'
                    and ordered_at >= :from and ordered_at < :to)    as failedCount
            """, nativeQuery = true)
    RevenueTotals aggregateTotals(@Param("from") LocalDateTime from,
                                  @Param("to") LocalDateTime to,
                                  @Param("paidStatuses") Collection<String> paidStatuses);

    /**
     * Cơ cấu theo gói. {@code LEFT JOIN} từ {@code plans} nên gói chưa có giao dịch nào vẫn
     * xuất hiện (legend donut liệt kê đủ gói, số 0) và danh sách gói luôn ĐỘNG theo bảng plans
     * — không hardcode Free/Plus/Pro.
     */
    @Query(value = """
            select p.id as planId, p.code as planCode, p.name_vi as nameVi, p.name_en as nameEn,
                   p.display_order as displayOrder,
                   coalesce(sum(pay.amount), 0) as gross,
                   count(pay.id)                as txnCount
            from plans p
            left join payments pay
                   on pay.plan_id = p.id
                  and pay.deleted_at is null
                  and pay.status in (:paidStatuses)
                  and pay.paid_at >= :from and pay.paid_at < :to
            where p.deleted_at is null
            group by p.id, p.code, p.name_vi, p.name_en, p.display_order
            order by p.display_order, p.code
            """, nativeQuery = true)
    List<PlanRevenue> aggregateByPlan(@Param("from") LocalDateTime from,
                                      @Param("to") LocalDateTime to,
                                      @Param("paidStatuses") Collection<String> paidStatuses);

    /**
     * Bảng "Giao dịch gần đây" — projection PHẲNG (không lấy entity) để tránh N+1 và tránh
     * cảnh báo phân trang trong bộ nhớ của {@code join fetch}. Tham số null = bỏ qua điều kiện;
     * JPQL suy được kiểu từ metamodel nên KHÔNG cần {@code CAST} như native query.
     *
     * <p>Đơn chưa trả tiền chưa có {@code paidAt} → lọc theo {@code coalesce(paidAt, orderedAt)}
     * để giao dịch PENDING/FAILED không biến mất khỏi bảng (chúng không vào doanh thu nhưng
     * admin vẫn phải thấy).
     */
    @Query(value = """
            select p.id as id, p.invoiceNo as invoiceNo,
                   u.id as userId, u.fullName as userFullName, u.email as userEmail,
                   u.avatarUrl as userAvatarUrl,
                   pl.code as planCode, pl.nameVi as planNameVi, pl.nameEn as planNameEn,
                   p.amount as amount, p.currency as currency, p.status as status,
                   p.paidAt as paidAt, p.orderedAt as orderedAt,
                   p.refundedAmount as refundedAmount, p.refundedAt as refundedAt,
                   p.gateway as gateway, p.gatewayTxnId as gatewayTxnId
            from Payment p join p.user u join p.plan pl
            where p.deletedAt is null
              and (:status is null or p.status = :status)
              and (:planId is null or pl.id = :planId)
              and (cast(:from as LocalDateTime) is null or coalesce(p.paidAt, p.orderedAt) >= :from)
              and (cast(:to as LocalDateTime) is null or coalesce(p.paidAt, p.orderedAt) < :to)
            """,
            countQuery = """
            select count(p)
            from Payment p join p.user u join p.plan pl
            where p.deletedAt is null
              and (:status is null or p.status = :status)
              and (:planId is null or pl.id = :planId)
              and (cast(:from as LocalDateTime) is null or coalesce(p.paidAt, p.orderedAt) >= :from)
              and (cast(:to as LocalDateTime) is null or coalesce(p.paidAt, p.orderedAt) < :to)
            """)
    Page<TransactionRow> search(@Param("status") PaymentStatus status,
                                @Param("planId") UUID planId,
                                @Param("from") LocalDateTime from,
                                @Param("to") LocalDateTime to,
                                Pageable pageable);

    /**
     * Toàn bộ dòng khớp bộ lọc, KHÔNG phân trang — chỉ dùng cho Export (TXT/Excel) nên service
     * chặn trần số dòng trước khi gọi.
     */
    @Query(value = """
            select p.id as id, p.invoiceNo as invoiceNo,
                   u.id as userId, u.fullName as userFullName, u.email as userEmail,
                   u.avatarUrl as userAvatarUrl,
                   pl.code as planCode, pl.nameVi as planNameVi, pl.nameEn as planNameEn,
                   p.amount as amount, p.currency as currency, p.status as status,
                   p.paidAt as paidAt, p.orderedAt as orderedAt,
                   p.refundedAmount as refundedAmount, p.refundedAt as refundedAt,
                   p.gateway as gateway, p.gatewayTxnId as gatewayTxnId
            from Payment p join p.user u join p.plan pl
            where p.deletedAt is null
              and (:status is null or p.status = :status)
              and (:planId is null or pl.id = :planId)
              and (cast(:from as LocalDateTime) is null or coalesce(p.paidAt, p.orderedAt) >= :from)
              and (cast(:to as LocalDateTime) is null or coalesce(p.paidAt, p.orderedAt) < :to)
            order by coalesce(p.paidAt, p.orderedAt) desc
            """)
    List<TransactionRow> searchAll(@Param("status") PaymentStatus status,
                                   @Param("planId") UUID planId,
                                   @Param("from") LocalDateTime from,
                                   @Param("to") LocalDateTime to);

    /**
     * Tra cứu theo mã giao dịch của cổng — nền tảng cho UPSERT idempotent khi webhook payOS bị
     * gửi lặp. Đi kèm partial unique index {@code uk_payments_gateway_txn} (khoá cứng ở DB,
     * phòng hai webhook chạy song song cùng lọt qua bước kiểm tra này).
     */
    Optional<Payment> findByGatewayTxnIdAndDeletedAtIsNull(String gatewayTxnId);

    /** Đếm/dọn dữ liệu dev seeder — chỉ chạm đúng bản ghi do seeder sinh ra. */
    long countByGatewayAndNoteStartingWith(PaymentGateway gateway, String notePrefix);

    long deleteByGatewayAndNoteStartingWith(PaymentGateway gateway, String notePrefix);

    /** Một bucket thời gian của chart doanh thu. */
    interface RevenueBucket {
        LocalDateTime getBucket();

        Long getGross();

        Long getTxnCount();

        Long getRefunded();
    }

    /** Tổng của một khoảng — KPI kỳ hiện tại / kỳ trước. */
    interface RevenueTotals {
        Long getGross();

        Long getTxnCount();

        Long getRefunded();

        Long getFailedCount();
    }

    /** Một dòng cơ cấu gói (donut). */
    interface PlanRevenue {
        UUID getPlanId();

        String getPlanCode();

        String getNameVi();

        String getNameEn();

        Integer getDisplayOrder();

        Long getGross();

        Long getTxnCount();
    }

    /** Một dòng bảng "Giao dịch gần đây". */
    interface TransactionRow {
        UUID getId();

        String getInvoiceNo();

        UUID getUserId();

        String getUserFullName();

        String getUserEmail();

        String getUserAvatarUrl();

        String getPlanCode();

        String getPlanNameVi();

        String getPlanNameEn();

        Long getAmount();

        String getCurrency();

        PaymentStatus getStatus();

        LocalDateTime getPaidAt();

        LocalDateTime getOrderedAt();

        Long getRefundedAmount();

        LocalDateTime getRefundedAt();

        PaymentGateway getGateway();

        String getGatewayTxnId();
    }
}
