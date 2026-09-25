package com.aima.payment;

import com.aima.dto.response.AdminPaymentResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PaymentSpecifications;
import com.aima.repository.PlanRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AdminPaymentService;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Hồi quy 2026-09-25: {@code GET /admin/payments} không có từ khoá → 500 trên PostgreSQL
 * ({@code lower(bytea) does not exist}) vì query dùng mẫu {@code (:q is null or lower(...) like ...)}.
 *
 * <p>Hai tầng:</p>
 * <ul>
 *   <li><b>Không sinh mệnh đề</b> cho tham số null (mock CriteriaBuilder) — đây là thứ chặn đúng
 *       LỚP lỗi của Postgres, vì mệnh đề không tồn tại thì không có gì để suy sai kiểu. H2 không
 *       tái hiện được lỗi gốc nên KHÔNG được coi tầng dưới là bằng chứng chạy đúng trên Postgres.</li>
 *   <li><b>Kết quả đúng</b> với cả 64 tổ hợp null/không-null của 6 bộ lọc, so với oracle Java,
 *       qua service + JPA + H2 thật.</li>
 * </ul>
 *
 * <p>Cùng bộ properties với {@link PaymentEndToEndTest} để Spring dùng lại context đã có.</p>
 */
@SpringBootTest(properties = {
        "payment.gateway=mock",
        "payment.pending-ttl-minutes=15",
        "payment.grace-minutes=10",
        "payment.max-grace-rounds=3",
        "payment.webhook-max-body-bytes=16384",
        "payment.webhook-alert-threshold=5",
        "payment.webhook-alert-window-minutes=10",
        "payment.mock-scenario=NORMAL",
        "payment.reconcile-interval-ms=3600000",
        "payment.expiry-interval-ms=3600000",
        "payment.plan-expiry-cron=0 0 0 1 1 *",
        "aima.production-mode=false",
})
@Transactional
class AdminPaymentSearchTest {

    private static final LocalDate FROM = LocalDate.of(2031, 3, 10);
    private static final LocalDate TO = LocalDate.of(2031, 3, 20);

    @Autowired
    private AdminPaymentService adminPaymentService;
    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private PlanRepository planRepository;

    private String tag;

    @BeforeEach
    void seed() {
        tag = UUID.randomUUID().toString().substring(0, 8);
        User alice = user("alice_" + tag);
        User bob = user("bob" + tag);
        Plan pro = planRepository.findByCodeAndDeletedAtIsNull("PRO").orElseThrow();

        // Rải đủ giá trị để mỗi bộ lọc đều có dòng khớp VÀ dòng không khớp.
        payment(alice, pro, PaymentStatus.PAID, PaymentGateway.MOCK, true, "2031-03-10T00:00", "INV-" + tag + "-A");
        payment(alice, pro, PaymentStatus.PENDING, PaymentGateway.MOCK, false, "2031-03-15T12:00", "INV-" + tag + "-B");
        payment(bob, pro, PaymentStatus.PAID, PaymentGateway.MANUAL, false, "2031-03-20T23:59", "INV-" + tag + "-C");
        payment(bob, pro, PaymentStatus.FAILED, PaymentGateway.PAYOS, true, "2031-03-21T00:00", null);
        payment(bob, pro, PaymentStatus.PAID, PaymentGateway.MOCK, true, "2031-03-09T23:59", "INV-" + tag + "-E");
        Payment deleted = payment(alice, pro, PaymentStatus.PAID, PaymentGateway.MOCK, true,
                "2031-03-12T00:00", "INV-" + tag + "-DEL");
        deleted.setDeletedAt(LocalDateTime.now());
        paymentRepository.saveAndFlush(deleted);
    }

    // ======================================================== 64 tổ hợp, kết quả đúng

    @Test
    void list_everyNullNonNullCombinationOfFilters_matchesOracle() {
        String q = tag.toUpperCase(); // trúng email lẫn số hoá đơn; kiểm luôn không phân biệt hoa thường
        for (int mask = 0; mask < 64; mask++) {
            PaymentStatus status = (mask & 1) != 0 ? PaymentStatus.PAID : null;
            PaymentGateway gateway = (mask & 2) != 0 ? PaymentGateway.MOCK : null;
            Boolean reconcile = (mask & 4) != 0 ? Boolean.TRUE : null;
            LocalDate from = (mask & 8) != 0 ? FROM : null;
            LocalDate to = (mask & 16) != 0 ? TO : null;
            String search = (mask & 32) != 0 ? q : null;

            assertMatchesOracle("mask=" + mask, status, gateway, reconcile, from, to, search);
        }
    }

    /** Ca gốc của bug: KHÔNG bộ lọc nào — trên Postgres cũ là 500. */
    @Test
    void list_allFiltersNull_returnsEveryLiveOrder() {
        PageResponse<AdminPaymentResponse> page = list(null, null, null, null, null, null);

        long live = paymentRepository.findAll().stream().filter(p -> p.getDeletedAt() == null).count();
        assertEquals(live, page.getTotalElements());
    }

    @Test
    void list_blankSearch_isTreatedAsNoSearch() {
        long all = list(null, null, null, null, null, null).getTotalElements();
        assertEquals(all, list(null, null, null, null, null, "   ").getTotalElements());
        assertEquals(all, list(null, null, null, null, null, "").getTotalElements());
    }

    /** {@code %} và {@code _} phải được so NGUYÊN VĂN, không thành ký tự đại diện. */
    @Test
    void list_likeWildcardsInSearch_areMatchedLiterally() {
        assertEquals(0, list(null, null, null, null, null, "%").getTotalElements(),
                "'%' không được khớp mọi dòng");
        assertEquals(0, list(null, null, null, null, null, "\\").getTotalElements());
        // alice_<tag>: '_' là ký tự thật trong email → khớp; bob<tag> không có '_' trước tag.
        Set<String> invoices = ids(list(null, null, null, null, null, "_" + tag));
        assertEquals(Set.of("INV-" + tag + "-A", "INV-" + tag + "-B"), invoices);
    }

    @Test
    void list_trimsSearch() {
        assertEquals(ids(list(null, null, null, null, null, tag)),
                ids(list(null, null, null, null, null, "  " + tag + "  ")));
    }

    // ======================================================== không sinh mệnh đề cho null

    @Test
    @SuppressWarnings("unchecked")
    void spec_allFiltersNull_emitsOnlyTheSoftDeleteClause() {
        CriteriaBuilder cb = mock(CriteriaBuilder.class, RETURNS_DEEP_STUBS);
        Root<Payment> root = mock(Root.class, RETURNS_DEEP_STUBS);

        PaymentSpecifications.adminSearch(null, null, null, null, null, null)
                .toPredicate(root, mock(CriteriaQuery.class), cb);

        verify(cb).isNull(any());
        verify(cb, never()).equal(any(), any(Object.class));
        verify(cb, never()).like(any(), anyString(), anyChar());
        verify(cb, never()).lower(any());
        verify(cb, never()).greaterThanOrEqualTo(any(), any(LocalDateTime.class));
        verify(cb, never()).lessThan(any(), any(LocalDateTime.class));
        verify(root, never()).join(anyString(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void spec_onlyNonNullFiltersEmitClauses() {
        CriteriaBuilder cb = mock(CriteriaBuilder.class, RETURNS_DEEP_STUBS);
        Root<Payment> root = mock(Root.class, RETURNS_DEEP_STUBS);

        PaymentSpecifications.adminSearch(PaymentStatus.PAID, null, true, null,
                        LocalDateTime.of(2031, 1, 1, 0, 0), " a%b ")
                .toPredicate(root, mock(CriteriaQuery.class), cb);

        verify(cb, times(2)).equal(any(), any(Object.class)); // status + reconcileRequired
        verify(cb, never()).greaterThanOrEqualTo(any(), any(LocalDateTime.class));
        verify(cb).lessThan(any(), any(LocalDateTime.class));
        verify(cb, times(3)).like(any(), eq("%a\\%b%"), eq('\\'));
    }

    // ======================================================== helpers

    private void assertMatchesOracle(String label, PaymentStatus status, PaymentGateway gateway,
                                     Boolean reconcile, LocalDate from, LocalDate to, String q) {
        List<Predicate<Payment>> rules = new ArrayList<>();
        rules.add(p -> p.getDeletedAt() == null);
        if (status != null) rules.add(p -> p.getStatus() == status);
        if (gateway != null) rules.add(p -> p.getGateway() == gateway);
        if (reconcile != null) rules.add(p -> reconcile.equals(p.getReconcileRequired()));
        if (from != null) rules.add(p -> !p.getOrderedAt().isBefore(from.atStartOfDay()));
        if (to != null) rules.add(p -> p.getOrderedAt().isBefore(to.plusDays(1).atStartOfDay()));
        if (q != null) {
            String needle = q.toLowerCase();
            rules.add(p -> Arrays.asList(p.getInvoiceNo(), p.getGatewayTxnId(), p.getUser().getEmail()).stream()
                    .anyMatch(v -> v != null && v.toLowerCase().contains(needle)));
        }
        Set<UUID> expected = paymentRepository.findAll().stream()
                .filter(p -> rules.stream().allMatch(r -> r.test(p)))
                .map(Payment::getId)
                .collect(Collectors.toSet());

        PageResponse<AdminPaymentResponse> page = list(status, gateway, reconcile, from, to, q);

        assertEquals(expected.size(), page.getTotalElements(), label + " — totalElements");
        Set<UUID> actual = page.getContent().stream().map(AdminPaymentResponse::getId).collect(Collectors.toSet());
        assertTrue(expected.containsAll(actual), label + " — trả về dòng không khớp bộ lọc");
    }

    private PageResponse<AdminPaymentResponse> list(PaymentStatus status, PaymentGateway gateway, Boolean reconcile,
                                                    LocalDate from, LocalDate to, String q) {
        return adminPaymentService.list(status, gateway, reconcile, from, to, q, 0, 50).getResult();
    }

    private static Set<String> ids(PageResponse<AdminPaymentResponse> page) {
        return page.getContent().stream().map(AdminPaymentResponse::getInvoiceNo).collect(Collectors.toSet());
    }

    private User user(String localPart) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = localPart + "@search.local";
        return userRepository.save(User.builder()
                .username(email).email(email).fullName("Search " + localPart)
                .password("{noop}x").role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE)
                .build());
    }

    private Payment payment(User user, Plan plan, PaymentStatus status, PaymentGateway gateway,
                            boolean reconcile, String orderedAt, String invoiceNo) {
        return paymentRepository.saveAndFlush(Payment.builder()
                .user(user).plan(plan).amount(plan.getPrice()).currency("VND")
                .status(status).gateway(gateway).reconcileRequired(reconcile)
                .orderedAt(LocalDateTime.parse(orderedAt)).invoiceNo(invoiceNo)
                .gatewayTxnId(gateway == PaymentGateway.MANUAL ? null : String.valueOf(System.nanoTime()))
                .build());
    }
}
