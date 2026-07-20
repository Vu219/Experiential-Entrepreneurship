package com.aima.config;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Index + comment cho sổ cái {@code payments} (trang admin "Quản lý doanh thu"). Idempotent
 * ({@code IF NOT EXISTS}), chạy raw SQL vì JPA không khai báo được partial unique index.
 * Dùng cách này thay Flyway/Liquibase vì dự án đang dùng {@code ddl-auto: update}
 * (cùng mẫu {@link UsageDataInitializer} / {@code PlatformDataInitializer}).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(8)
public class PaymentDataInitializer implements CommandLineRunner {

    JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        try {
            // Lối đi chính của MỌI query doanh thu: lọc status đã-thu-được-tiền + khoảng paid_at.
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_payments_status_paid_at "
                    + "ON payments (status, paid_at DESC)");
            // Phần TRỪ của công thức net: gộp refunded_amount theo kỳ phát sinh hoàn tiền.
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_payments_refunded_at "
                    + "ON payments (refunded_at) WHERE refunded_at IS NOT NULL");
            // Cơ cấu doanh thu theo gói.
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_payments_plan_paid_at "
                    + "ON payments (plan_id, paid_at DESC)");
            // Bảng giao dịch sắp/lọc theo mốc tạo đơn (đơn PENDING/FAILED chưa có paid_at).
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_payments_ordered_at "
                    + "ON payments (ordered_at DESC)");
            // KHOÁ IDEMPOTENCY cho webhook cổng thanh toán (payOS gửi lặp): một orderCode chỉ
            // sinh được MỘT dòng doanh thu. Partial vì bản ghi thủ công/seed không có mã cổng.
            jdbcTemplate.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_payments_gateway_txn "
                    + "ON payments (gateway_txn_id) "
                    + "WHERE gateway_txn_id IS NOT NULL AND deleted_at IS NULL");

            // Quy ước timezone + công thức doanh thu ghi thẳng vào schema — ai đọc DB cũng thấy.
            jdbcTemplate.execute("COMMENT ON COLUMN payments.paid_at IS "
                    + "'Moc thu duoc tien, GIO VIET NAM (LocalDateTime theo APP_TIMEZONE) — quy ky cho phan "
                    + "GOP cua doanh thu. APP_TIMEZONE la HANG SO sau khi co du lieu (xem TimezoneVerificationConfig)'");
            jdbcTemplate.execute("COMMENT ON COLUMN payments.refunded_at IS "
                    + "'Moc phat sinh hoan tien — quy ky cho phan TRU. Tach khoi paid_at de doanh thu ky da dong so "
                    + "KHONG bi thay doi khi hoan tien ve sau (cong thuc net, khong hoi to — chot 2026-07-20)'");
            jdbcTemplate.execute("COMMENT ON COLUMN payments.ordered_at IS "
                    + "'Moc TAO DON (thoi diem nghiep vu, GIO VIET NAM) — tach khoi created_at la cot audit. "
                    + "Dung de quy ky cho don PENDING/FAILED va de doi soat voi moc don cua cong thanh toan'");
            jdbcTemplate.execute("COMMENT ON COLUMN payments.gateway_txn_id IS "
                    + "'Ma giao dich phia cong (payOS: orderCode dang chuoi). Partial unique = khoa idempotency "
                    + "cho webhook bi gui lap'");
            log.info("[PaymentInit] Index + comment bảng payments đã sẵn sàng");
        } catch (Exception e) {
            // Không chặn app khởi động vì thiếu index — chỉ ảnh hưởng hiệu năng/chống trùng.
            log.error("[PaymentInit] Không tạo được index payments: {}", e.getMessage());
        }
    }
}
