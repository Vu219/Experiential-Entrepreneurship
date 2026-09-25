package com.aima.config;

import com.aima.enums.ActivityAction;
import com.aima.enums.NotificationType;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Index + comment cho sổ cái {@code payments} và vòng đời gói trên {@code subscriptions}.
 * Idempotent ({@code IF NOT EXISTS}), chạy raw SQL vì JPA không khai báo được partial index.
 * Dùng cách này thay Flyway/Liquibase vì dự án đang dùng {@code ddl-auto: update}
 * (cùng mẫu {@link UsageDataInitializer} / {@code PlatformDataInitializer}).
 *
 * <p>Mỗi câu lệnh chạy trong try/catch RIÊNG: một index không tạo được (vd dữ liệu hiện có
 * vi phạm ràng buộc unique mới) không được phép làm các index còn lại bị bỏ qua.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(8)
public class PaymentDataInitializer implements CommandLineRunner {

    /**
     * Các cột enum ({@code @Enumerated(STRING)}) mà luồng thanh toán ghi vào. Hibernate sinh
     * CHECK constraint liệt kê CỨNG giá trị enum LÚC TẠO BẢNG, và {@code ddl-auto: update}
     * KHÔNG BAO GIỜ sửa lại constraint đó — thêm giá trị enum mới thì DB vẫn từ chối nó
     * (SQLState 23514). Dính 2026-09-25: {@code payments_gateway_check} thiếu {@code MOCK}.
     *
     * <p><b>Thêm cột enum mới vào Payment/Subscription, hoặc luồng thanh toán bắt đầu ghi một
     * cột enum khác → PHẢI thêm vào đây.</b> {@code PaymentEnumConstraintTest} soi reflection
     * hai entity đó và fail nếu thiếu.</p>
     */
    static final List<EnumColumn> ENUM_COLUMNS = List.of(
            new EnumColumn("payments", "status", PaymentStatus.class),
            new EnumColumn("payments", "gateway", PaymentGateway.class),
            new EnumColumn("subscriptions", "status", SubscriptionStatus.class),
            new EnumColumn("subscriptions", "plan_source", PlanSource.class),
            // Không thuộc hai bảng trên nhưng luồng thanh toán thêm giá trị mới và ghi vào:
            // PAYMENT_* / SUBSCRIPTION_ADJUSTED (audit), PAYMENT_SUCCEEDED / PLAN_EXPIRED /
            // PAYMENT_WEBHOOK_ALERT (chuông thông báo).
            new EnumColumn("activity_logs", "action", ActivityAction.class),
            new EnumColumn("notifications", "type", NotificationType.class));

    /** Mọi literal {@code 'X'} trong định nghĩa CHECK do {@code pg_get_constraintdef} trả về. */
    private static final Pattern QUOTED_LITERAL = Pattern.compile("'((?:[^']|'')*)'");

    /**
     * CHECK constraint một-cột đang gắn vào đúng cột — tra theo catalog chứ KHÔNG theo tên,
     * vì tên do Hibernate/PostgreSQL tự đặt và có thể khác giữa các môi trường.
     * {@code to_regclass} phân giải theo search_path → đúng schema app đang dùng; bảng chưa
     * tồn tại thì trả NULL → không dòng nào.
     */
    static final String FIND_COLUMN_CHECKS_SQL =
            "SELECT con.conname, pg_get_constraintdef(con.oid) AS def "
                    + "FROM pg_constraint con "
                    + "JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1] "
                    + "WHERE con.contype = 'c' AND con.conrelid = to_regclass(?) "
                    + "AND cardinality(con.conkey) = 1 AND att.attname = ?";

    JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        // ===== CHECK constraint của cột enum — chạy TRƯỚC mọi thứ khác =====
        // Xem ENUM_COLUMNS: ddl-auto: update không đồng bộ lại constraint khi enum có giá trị
        // mới. Idempotent: khớp rồi thì không chạy DDL nào.
        for (EnumColumn column : ENUM_COLUMNS) {
            syncEnumCheck(column);
        }

        // ===== payments — báo cáo doanh thu =====
        // Lối đi chính của MỌI query doanh thu: lọc status đã-thu-được-tiền + khoảng paid_at.
        exec("CREATE INDEX IF NOT EXISTS idx_payments_status_paid_at "
                + "ON payments (status, paid_at DESC)");
        // Phần TRỪ của công thức net: gộp refunded_amount theo kỳ phát sinh hoàn tiền.
        exec("CREATE INDEX IF NOT EXISTS idx_payments_refunded_at "
                + "ON payments (refunded_at) WHERE refunded_at IS NOT NULL");
        // Cơ cấu doanh thu theo gói.
        exec("CREATE INDEX IF NOT EXISTS idx_payments_plan_paid_at "
                + "ON payments (plan_id, paid_at DESC)");
        // Bảng giao dịch sắp/lọc theo mốc tạo đơn (đơn chưa trả tiền chưa có paid_at).
        exec("CREATE INDEX IF NOT EXISTS idx_payments_ordered_at "
                + "ON payments (ordered_at DESC)");
        // KHOÁ IDEMPOTENCY cho webhook cổng thanh toán (payOS gửi lặp): một orderCode chỉ
        // sinh được MỘT dòng doanh thu. Partial vì bản ghi thủ công/seed không có mã cổng.
        exec("CREATE UNIQUE INDEX IF NOT EXISTS uk_payments_gateway_txn "
                + "ON payments (gateway_txn_id) "
                + "WHERE gateway_txn_id IS NOT NULL AND deleted_at IS NULL");

        // ===== payments — luồng thanh toán (checkout / hết hạn) =====
        // Lịch sử giao dịch của MỘT user ở trang Billing.
        exec("CREATE INDEX IF NOT EXISTS idx_payments_user_ordered "
                + "ON payments (user_id, ordered_at DESC)");
        // Job quét đơn quá hạn mỗi phút — chỉ đụng đúng các đơn còn đang chờ.
        exec("CREATE INDEX IF NOT EXISTS idx_payments_pending_expiry "
                + "ON payments (expires_at) WHERE status = 'PENDING' AND deleted_at IS NULL");
        // CHỐT CHẶN "tối đa 1 đơn chờ / user" ở tầng DB. Kiểm tra trong service (SELECT rồi
        // INSERT) KHÔNG chặn được hai request checkout song song của cùng một user — chưa có
        // row nào để khoá. Đây mới là thứ chặn thật khi user bấm đúp hoặc mở hai tab.
        //   gateway <> 'MANUAL': ràng buộc chỉ áp cho ĐƠN CHECKOUT (payOS/mock). Bản ghi ghi
        //   tay và dữ liệu dev-seed mang gateway MANUAL, có thể có nhiều dòng PENDING cùng
        //   user một cách hợp lệ — gộp chúng vào sẽ khiến index không tạo được trên DB đã seed.
        exec("CREATE UNIQUE INDEX IF NOT EXISTS uk_payments_one_pending_per_user "
                + "ON payments (user_id) "
                + "WHERE status = 'PENDING' AND deleted_at IS NULL AND gateway <> 'MANUAL'");

        // ===== Backfill cột NOT NULL mới trên bảng ĐÃ CÓ dữ liệu =====
        // Lớp phòng thứ hai sau `columnDefinition ... DEFAULT` trên entity: nếu cột đã từng
        // được tạo ở dạng nullable (lần chạy trước, hoặc DB dựng bằng đường khác) thì các dòng
        // cũ mang NULL — đọc ra Integer/Boolean null rồi cộng/so sánh là NPE. Idempotent:
        // lần chạy sau không còn dòng nào khớp WHERE.
        exec("UPDATE payments SET expiry_grace_count = 0 WHERE expiry_grace_count IS NULL");
        exec("UPDATE payments SET reconcile_required = false WHERE reconcile_required IS NULL");
        exec("UPDATE subscriptions SET plan_source = 'FREE' WHERE plan_source IS NULL");

        // ===== subscriptions — vòng đời gói trả tiền =====
        // Job hạ gói về Free quét cột này hằng ngày.
        exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_expires "
                + "ON subscriptions (plan_expires_at) WHERE plan_expires_at IS NOT NULL");

        // ===== Quy ước ghi thẳng vào schema — ai đọc DB cũng thấy =====
        exec("COMMENT ON COLUMN payments.paid_at IS "
                + "'Moc thu duoc tien, GIO VIET NAM (LocalDateTime theo APP_TIMEZONE) — quy ky cho phan "
                + "GOP cua doanh thu. APP_TIMEZONE la HANG SO sau khi co du lieu (xem TimezoneVerificationConfig)'");
        exec("COMMENT ON COLUMN payments.refunded_at IS "
                + "'Moc phat sinh hoan tien — quy ky cho phan TRU. Tach khoi paid_at de doanh thu ky da dong so "
                + "KHONG bi thay doi khi hoan tien ve sau (cong thuc net, khong hoi to — chot 2026-07-20)'");
        exec("COMMENT ON COLUMN payments.ordered_at IS "
                + "'Moc TAO DON (thoi diem nghiep vu, GIO VIET NAM) — tach khoi created_at la cot audit. "
                + "Dung de quy ky cho don PENDING/FAILED va de doi soat voi moc don cua cong thanh toan'");
        exec("COMMENT ON COLUMN payments.gateway_txn_id IS "
                + "'Ma giao dich phia cong (payOS: orderCode dang chuoi). Partial unique = khoa idempotency "
                + "cho webhook bi gui lap'");
        exec("COMMENT ON COLUMN payments.expires_at IS "
                + "'Han chot thanh toan. MOT moc duy nhat cho ca dem nguoc hien cho user LAN expiredAt (Unix giay) "
                + "gui cho payOS luc tao link — tinh mot lan luc tao don roi dung lai cho ca hai'");
        exec("COMMENT ON COLUMN payments.reconcile_required IS "
                + "'Can DOI SOAT TAY: tien ve sau khi don da het han/huy, so tien lech (payOS UNDERPAID van gui "
                + "webhook code=00), cong tra trang thai la, hoac khong xac nhan duoc trang thai that cua link'");
        exec("COMMENT ON COLUMN subscriptions.plan_expires_at IS "
                + "'Moc het han GOI TRA TIEN — NULL = khong het han (goi Free/admin cap vinh vien), KHONG phai "
                + "het han ngay. Khac han current_period_end la moc reset HAN MUC TOKEN theo thang lich'");
        exec("COMMENT ON COLUMN subscriptions.plan_source IS "
                + "'Vi sao user dang o goi nay: FREE | PAYMENT (co dong payments da PAID) | ADMIN (cap tay, "
                + "luon kem ly do trong activity_logs). Goi ADMIN khong co doanh thu tuong ung'");

        verifyCriticalIndexes();
        verifyEnumChecks();
        log.info("[PaymentInit] Index + comment payments/subscriptions đã sẵn sàng");
    }

    /**
     * Các index mang tính ĐÚNG ĐẮN NGHIỆP VỤ (không phải tối ưu hiệu năng) — thiếu chúng là
     * mất hẳn một lớp bảo vệ, không phải chỉ chạy chậm hơn:
     * <ul>
     *   <li>{@code uk_payments_gateway_txn} — webhook cổng bị gửi lặp sẽ sinh HAI dòng doanh thu.</li>
     *   <li>{@code uk_payments_one_pending_per_user} — user bấm đúp / mở hai tab sẽ tạo HAI đơn
     *       chờ thanh toán, và nếu trả cả hai thì cộng dồn gói hai lần.</li>
     * </ul>
     *
     * <p>{@link #exec} nuốt lỗi DDL để một câu hỏng không chặn app khởi động — nhưng với hai
     * index này việc "hỏng im lặng" là không chấp nhận được: nó chỉ lộ ra khi có khách thật
     * mất tiền. Vì vậy sau khi chạy xong phải ĐỌC LẠI catalog để xác nhận chúng tồn tại thật,
     * và log ERROR kèm tên index nếu thiếu. Cố tình KHÔNG ném exception: chặn app khởi động
     * vì thiếu index còn tệ hơn, nhưng dòng ERROR này phải được xử lý ngay.
     */
    private void verifyCriticalIndexes() {
        List<String> required = List.of("uk_payments_gateway_txn", "uk_payments_one_pending_per_user");
        for (String indexName : required) {
            try {
                Integer found = jdbcTemplate.queryForObject(
                        "SELECT count(*) FROM pg_indexes WHERE schemaname = current_schema() "
                                + "AND tablename = 'payments' AND indexname = ?",
                        Integer.class, indexName);
                if (found == null || found == 0) {
                    log.error("[PaymentInit] ⚠️ THIẾU INDEX BẢO VỆ NGHIỆP VỤ '{}' trên bảng payments. "
                            + "Chống trùng ở tầng DB KHÔNG hoạt động — nguy cơ tạo hai đơn chờ cho "
                            + "cùng một user hoặc hai dòng doanh thu cho cùng một giao dịch. "
                            + "Nguyên nhân thường gặp: dữ liệu hiện có vi phạm ràng buộc unique. "
                            + "Kiểm tra log DDL phía trên, dọn dữ liệu rồi khởi động lại.", indexName);
                }
            } catch (Exception e) {
                log.error("[PaymentInit] Không kiểm tra được index '{}': {}", indexName, e.getMessage());
            }
        }
    }

    /**
     * Đưa CHECK constraint của một cột enum về ĐÚNG tập giá trị enum hiện tại trong Java.
     *
     * <p>Idempotent: đã khớp (một constraint, đủ và không thừa giá trị) thì không chạy DDL —
     * tránh mỗi lần khởi động lại khoá ACCESS EXCLUSIVE + quét toàn bảng để validate. Lệch thì
     * DROP mọi CHECK một-cột đang gắn vào cột (dù tên là gì) và ADD bản mới trong CÙNG MỘT câu
     * {@code ALTER TABLE} — PostgreSQL chạy nguyên tử, nên nếu ADD thất bại (vd còn dòng mang
     * giá trị đã bị xoá khỏi enum) thì constraint cũ vẫn nguyên, cột không bao giờ bị bỏ trần.</p>
     */
    void syncEnumCheck(EnumColumn column) {
        List<Map<String, Object>> existing;
        try {
            existing = jdbcTemplate.queryForList(FIND_COLUMN_CHECKS_SQL, column.table(), column.column());
        } catch (Exception e) {
            log.error("[PaymentInit] Không đọc được CHECK constraint của {}: {}", column, e.getMessage());
            return;
        }
        Set<String> expected = new TreeSet<>(column.javaValues());
        Set<String> allowed = allowedValues(existing);
        if (existing.size() == 1 && expected.equals(allowed)) {
            return;
        }
        log.warn("[PaymentInit] CHECK constraint của {} lệch enum Java — DB cho phép {}, Java có {}. "
                + "Tạo lại constraint.", column, allowed, expected);
        List<String> names = existing.stream().map(row -> (String) row.get("conname")).toList();
        exec(buildResyncSql(column, names));
    }

    /**
     * Kiểm tra SAU khi đồng bộ — cùng cơ chế với {@link #verifyCriticalIndexes}: {@link #exec}
     * nuốt lỗi DDL, nên phải đọc lại catalog mới biết constraint có thật sự đúng. Giá trị enum
     * Java mà DB không cho phép = mọi INSERT/UPDATE mang giá trị đó nổ 23514 lúc chạy.
     */
    void verifyEnumChecks() {
        for (EnumColumn column : ENUM_COLUMNS) {
            try {
                List<Map<String, Object>> rows =
                        jdbcTemplate.queryForList(FIND_COLUMN_CHECKS_SQL, column.table(), column.column());
                if (rows.isEmpty()) {
                    log.warn("[PaymentInit] {} không có CHECK constraint nào — DB không chặn giá trị lạ", column);
                    continue;
                }
                Set<String> allowed = allowedValues(rows);
                Set<String> missing = new TreeSet<>(column.javaValues());
                missing.removeAll(allowed);
                if (!missing.isEmpty()) {
                    log.error("[PaymentInit] ⚠️ CHECK CONSTRAINT LỆCH ENUM: cột {} THIẾU giá trị {} — mọi "
                            + "INSERT/UPDATE mang giá trị này sẽ bị DB từ chối (SQLState 23514). Kiểm tra log "
                            + "DDL phía trên (thường do còn dòng mang giá trị không còn trong enum).",
                            column, missing);
                }
                Set<String> extra = new TreeSet<>(allowed);
                extra.removeAll(column.javaValues());
                if (!extra.isEmpty()) {
                    log.warn("[PaymentInit] Cột {} còn cho phép giá trị không có trong enum Java: {}", column, extra);
                }
            } catch (Exception e) {
                log.error("[PaymentInit] Không kiểm tra được CHECK constraint của {}: {}", column, e.getMessage());
            }
        }
    }

    /** Hợp mọi literal của các constraint trên cột — cột không có constraint → tập rỗng. */
    static Set<String> allowedValues(List<Map<String, Object>> constraintRows) {
        Set<String> values = new TreeSet<>();
        for (Map<String, Object> row : constraintRows) {
            Matcher m = QUOTED_LITERAL.matcher(String.valueOf(row.get("def")));
            while (m.find()) {
                values.add(m.group(1).replace("''", "'"));
            }
        }
        return values;
    }

    /**
     * Một câu ALTER duy nhất: DROP các constraint cũ (tên tra từ catalog) rồi ADD bản mới, đặt
     * tên theo quy ước mặc định của PostgreSQL {@code <bảng>_<cột>_check}. Bảng/cột lấy từ hằng
     * {@link #ENUM_COLUMNS}, giá trị là tên hằng enum — không có input ngoài.
     */
    static String buildResyncSql(EnumColumn column, List<String> existingConstraintNames) {
        StringBuilder sql = new StringBuilder("ALTER TABLE ").append(column.table()).append(' ');
        for (String name : existingConstraintNames) {
            sql.append("DROP CONSTRAINT IF EXISTS \"").append(name.replace("\"", "\"\"")).append("\", ");
        }
        String values = column.javaValues().stream()
                .map(v -> "'" + v + "'")
                .collect(Collectors.joining(", "));
        return sql.append("ADD CONSTRAINT ").append(column.table()).append('_').append(column.column())
                .append("_check CHECK (").append(column.column()).append(" IN (").append(values).append("))")
                .toString();
    }

    /** Một cột enum lưu dạng chuỗi ({@code EnumType.STRING}) và enum Java tương ứng. */
    record EnumColumn(String table, String column, Class<? extends Enum<?>> type) {

        Set<String> javaValues() {
            return Arrays.stream(type.getEnumConstants())
                    .map(Enum::name)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }

        @Override
        public String toString() {
            return table + "." + column;
        }
    }

    /**
     * Chạy một câu DDL, nuốt lỗi và chỉ log. Không chặn app khởi động vì thiếu index — mất
     * index chỉ ảnh hưởng hiệu năng, riêng mất unique index thì mất một lớp chống trùng
     * (service vẫn còn lớp kiểm tra của nó), nên log ở mức ERROR để không trôi qua im lặng.
     */
    private void exec(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception e) {
            log.error("[PaymentInit] Không chạy được DDL [{}]: {}", sql, e.getMessage());
        }
    }
}
