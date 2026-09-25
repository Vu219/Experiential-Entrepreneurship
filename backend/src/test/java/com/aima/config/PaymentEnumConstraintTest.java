package com.aima.config;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.aima.config.PaymentDataInitializer.EnumColumn;
import com.aima.entity.Payment;
import com.aima.entity.Subscription;
import com.aima.enums.PaymentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Enumerated;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Hồi quy 2026-09-25: {@code ddl-auto: update} không sửa CHECK constraint đã có, nên
 * {@code payments_gateway_check} vẫn chỉ cho {@code MANUAL/PAYOS} sau khi enum có thêm
 * {@code MOCK} → INSERT nổ 23514. Test neo ba điều: registry phủ đủ cột enum, đồng bộ đúng và
 * idempotent, và kiểm tra khởi động log ERROR nêu đích danh cột + giá trị thiếu.
 */
class PaymentEnumConstraintTest {

    /** Định nghĩa THẬT đọc từ catalog Supabase trước khi sửa (pg_get_constraintdef). */
    private static final String STALE_GATEWAY_DEF = "CHECK (((gateway)::text = ANY ((ARRAY['MANUAL'::character "
            + "varying, 'PAYOS'::character varying])::text[])))";

    private static final EnumColumn GATEWAY = column("payments", "gateway");
    private static final EnumColumn STATUS = column("payments", "status");

    private JdbcTemplate jdbc;
    private PaymentDataInitializer initializer;
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        initializer = new PaymentDataInitializer(jdbc);
        logs = new ListAppender<>();
        logs.start();
        ((Logger) LoggerFactory.getLogger(PaymentDataInitializer.class)).addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        ((Logger) LoggerFactory.getLogger(PaymentDataInitializer.class)).detachAppender(logs);
    }

    // ============================================================ registry phủ đủ

    /** Thêm cột enum vào Payment/Subscription mà quên đăng ký → constraint của nó sẽ lại mục. */
    @Test
    void registry_coversEveryEnumColumnOfPaymentAndSubscription() {
        for (Class<?> entity : List.of(Payment.class, Subscription.class)) {
            String table = entity.getAnnotation(jakarta.persistence.Table.class).name();
            for (Field f : entity.getDeclaredFields()) {
                if (!f.isAnnotationPresent(Enumerated.class)) {
                    continue;
                }
                String col = f.getAnnotation(Column.class).name();
                EnumColumn registered = PaymentDataInitializer.ENUM_COLUMNS.stream()
                        .filter(c -> c.table().equals(table) && c.column().equals(col))
                        .findFirst()
                        .orElseThrow(() -> new AssertionError(table + "." + col
                                + " chưa có trong PaymentDataInitializer.ENUM_COLUMNS"));
                assertEquals(f.getType(), registered.type(), table + "." + col + " đăng ký sai enum");
            }
        }
    }

    // ============================================================ đồng bộ

    @Test
    void sync_staleConstraint_isRecreatedWithEveryCurrentEnumValue() {
        givenConstraints(GATEWAY, row("payments_gateway_check", STALE_GATEWAY_DEF));

        initializer.syncEnumCheck(GATEWAY);

        verify(jdbc).execute("ALTER TABLE payments DROP CONSTRAINT IF EXISTS \"payments_gateway_check\", "
                + "ADD CONSTRAINT payments_gateway_check CHECK (gateway IN ('MANUAL', 'PAYOS', 'MOCK'))");
    }

    /** Tên do Hibernate/PG tự đặt có thể khác giữa môi trường — phải drop theo tên tra từ catalog. */
    @Test
    void sync_dropsConstraintByCatalogNameWhateverItIs() {
        givenConstraints(STATUS,
                row("payments_status_check1", "CHECK (((status)::text = ANY (ARRAY['PENDING'::text, 'PAID'::text])))"),
                row("legacy_status_ck", "CHECK (((status)::text = 'PENDING'::text))"));

        initializer.syncEnumCheck(STATUS);

        String expectedValues = Arrays.stream(PaymentStatus.values())
                .map(v -> "'" + v.name() + "'").collect(Collectors.joining(", "));
        verify(jdbc).execute("ALTER TABLE payments DROP CONSTRAINT IF EXISTS \"payments_status_check1\", "
                + "DROP CONSTRAINT IF EXISTS \"legacy_status_ck\", "
                + "ADD CONSTRAINT payments_status_check CHECK (status IN (" + expectedValues + "))");
    }

    @Test
    void sync_alreadyInSync_runsNoDdl() {
        givenConstraints(GATEWAY, row("payments_gateway_check", "CHECK (((gateway)::text = ANY ((ARRAY["
                + "'MANUAL'::character varying, 'PAYOS'::character varying, 'MOCK'::character varying])::text[])))"));

        initializer.syncEnumCheck(GATEWAY);

        verify(jdbc, never()).execute(anyString());
    }

    @Test
    void sync_columnWithoutConstraint_getsOne() {
        givenConstraints(GATEWAY);

        initializer.syncEnumCheck(GATEWAY);

        verify(jdbc).execute("ALTER TABLE payments ADD CONSTRAINT payments_gateway_check "
                + "CHECK (gateway IN ('MANUAL', 'PAYOS', 'MOCK'))");
    }

    /** exec() nuốt lỗi DDL — một cột hỏng không được chặn các cột sau. */
    @Test
    void sync_ddlFailure_isLoggedAndDoesNotThrow() {
        givenConstraints(GATEWAY, row("payments_gateway_check", STALE_GATEWAY_DEF));
        doThrow(new RuntimeException("check constraint is violated by some row")).when(jdbc).execute(anyString());

        assertDoesNotThrow(() -> initializer.syncEnumCheck(GATEWAY));
        assertTrue(errors().stream().anyMatch(m -> m.contains("is violated by some row")));
    }

    // ============================================================ kiểm tra khởi động

    @Test
    void verify_missingValue_logsErrorNamingColumnAndValue() {
        when(jdbc.queryForList(eq(PaymentDataInitializer.FIND_COLUMN_CHECKS_SQL), anyString(), anyString()))
                .thenAnswer(inv -> "gateway".equals(inv.getArgument(2))
                        ? List.of(row("payments_gateway_check", STALE_GATEWAY_DEF))
                        : List.of(row("ok", inSync(inv.getArgument(1), inv.getArgument(2)))));

        initializer.verifyEnumChecks();

        List<String> errors = errors();
        assertEquals(1, errors.size(), "Chỉ cột lệch mới được báo: " + errors);
        assertTrue(errors.get(0).contains("payments.gateway"), errors.get(0));
        assertTrue(errors.get(0).contains("[MOCK]"), errors.get(0));
    }

    @Test
    void verify_everythingInSync_logsNoError() {
        when(jdbc.queryForList(eq(PaymentDataInitializer.FIND_COLUMN_CHECKS_SQL), anyString(), anyString()))
                .thenAnswer(inv -> List.of(row("ok", inSync(inv.getArgument(1), inv.getArgument(2)))));

        initializer.verifyEnumChecks();

        assertTrue(errors().isEmpty(), errors().toString());
    }

    @Test
    void allowedValues_parsesPostgresNormalisedDefinition() {
        assertEquals(Set.of("MANUAL", "PAYOS"),
                PaymentDataInitializer.allowedValues(List.of(row("c", STALE_GATEWAY_DEF))));
    }

    // ============================================================ helpers

    private static EnumColumn column(String table, String col) {
        return PaymentDataInitializer.ENUM_COLUMNS.stream()
                .filter(c -> c.table().equals(table) && c.column().equals(col))
                .findFirst().orElseThrow();
    }

    /** Định nghĩa CHECK đúng dạng PostgreSQL lưu, chứa đủ giá trị enum hiện tại của cột. */
    private static String inSync(String table, String col) {
        String values = column(table, col).javaValues().stream()
                .map(v -> "'" + v + "'::character varying").collect(Collectors.joining(", "));
        return "CHECK (((" + col + ")::text = ANY ((ARRAY[" + values + "])::text[])))";
    }

    @SafeVarargs
    private void givenConstraints(EnumColumn c, Map<String, Object>... rows) {
        when(jdbc.queryForList(PaymentDataInitializer.FIND_COLUMN_CHECKS_SQL, c.table(), c.column()))
                .thenReturn(List.of(rows));
    }

    private static Map<String, Object> row(String name, String def) {
        return Map.of("conname", name, "def", def);
    }

    private List<String> errors() {
        return logs.list.stream()
                .filter(e -> e.getLevel() == Level.ERROR)
                .map(ILoggingEvent::getFormattedMessage)
                .toList();
    }
}
