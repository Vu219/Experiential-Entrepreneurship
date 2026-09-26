package com.aima.payment;

import com.aima.config.PaymentProperties;
import com.aima.dto.request.CheckoutRequest;
import com.aima.dto.response.CheckoutQuoteResponse;
import com.aima.dto.response.CheckoutResponse;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.MockGatewayScenario;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentMethod;
import com.aima.enums.PaymentOrderType;
import com.aima.enums.PaymentStatus;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionStatus;
import com.aima.enums.UserPlan;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PaymentMapperImpl;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.Impl.MockGatewayClientImpl;
import com.aima.service.Impl.PaymentServiceImpl;
import com.aima.service.ActivityLogService;
import com.aima.service.NotificationService;
import com.aima.service.SubscriptionService;
import com.aima.service.SystemLogService;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Luồng checkout: Q1 (chặn hạ gói), Q2 (một đơn PENDING), H2 (hai luồng đồng thời) và —
 * quan trọng nhất — <b>kịch bản đơn treo khoá cứng user khỏi việc mua hàng</b>.
 *
 * <p>Dùng {@link MockGatewayClientImpl} THẬT (không mock) để các kịch bản hỏng đi qua đúng
 * đoạn code mà môi trường dev sẽ chạy.</p>
 */
class PaymentCheckoutTest {

    private static final String EMAIL = "buyer@aima.test";

    private PaymentRepository paymentRepository;
    private PlanRepository planRepository;
    private UserRepository userRepository;
    private SubscriptionRepository subscriptionRepository;
    private SubscriptionService subscriptionService;
    private MockGatewayClientImpl gateway;
    private PaymentServiceImpl service;

    private final Map<UUID, Payment> store = new HashMap<>();
    private final List<String> usedOrderCodes = new ArrayList<>();

    private User user;
    private Plan proPlan;
    private Plan plusPlan;

    @BeforeEach
    void setUp() {
        paymentRepository = mock(PaymentRepository.class);
        planRepository = mock(PlanRepository.class);
        userRepository = mock(UserRepository.class);
        subscriptionRepository = mock(SubscriptionRepository.class);
        subscriptionService = mock(SubscriptionService.class);
        gateway = new MockGatewayClientImpl("http://localhost:3000", MockGatewayScenario.NORMAL);

        user = User.builder().email(EMAIL).plan(UserPlan.FREE).build();
        user.setId(UUID.randomUUID());
        proPlan = plan("PRO", 299_000L, 2_000_000L);
        plusPlan = plan("PLUS", 99_000L, 500_000L);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(planRepository.findByIdAndDeletedAtIsNull(proPlan.getId())).thenReturn(Optional.of(proPlan));
        when(planRepository.findByIdAndDeletedAtIsNull(plusPlan.getId())).thenReturn(Optional.of(plusPlan));
        when(subscriptionRepository.findWithPlanByUserId(any())).thenReturn(Optional.empty());
        when(paymentRepository.existsByGatewayTxnIdAndDeletedAtIsNull(anyString()))
                .thenAnswer(inv -> usedOrderCodes.contains(inv.getArgument(0)));

        // Lưu/đọc đơn bằng map trong bộ nhớ để mô phỏng sổ cái.
        when(paymentRepository.save(any())).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) {
                p.setId(UUID.randomUUID());
                usedOrderCodes.add(p.getGatewayTxnId());
            }
            store.put(p.getId(), p);
            return p;
        });
        when(paymentRepository.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0))));
        when(paymentRepository.findByIdForUpdate(any()))
                .thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0))));
        when(paymentRepository.findOpenOrder(any(), any(), any())).thenAnswer(inv -> store.values().stream()
                .filter(p -> p.getStatus() == PaymentStatus.PENDING)
                .findFirst());
        when(paymentRepository.findStuckPendingIds(any(), any())).thenAnswer(inv -> store.values().stream()
                .filter(p -> p.getStatus() == PaymentStatus.PENDING)
                .filter(p -> p.getCheckoutUrl() == null || Boolean.TRUE.equals(p.getReconcileRequired()))
                .map(Payment::getId)
                .toList());

        TransactionTemplate transactionTemplate = mock(TransactionTemplate.class);
        when(transactionTemplate.execute(any())).thenAnswer(inv ->
                ((TransactionCallback<?>) inv.getArgument(0)).doInTransaction(mock(TransactionStatus.class)));

        PaymentProperties properties = new PaymentProperties(
                PaymentGateway.MOCK, 15, 10, 3, 16384, 5, 10, 2000);

        service = new PaymentServiceImpl(paymentRepository, mock(ActivityLogRepository.class),
                planRepository, userRepository,
                subscriptionRepository, subscriptionService, new PaymentMapperImpl(),
                properties, transactionTemplate, mock(NotificationService.class),
                mock(ActivityLogService.class), mock(SystemLogService.class),
                new MockEnvironment(), List.of(gateway));
    }

    private static Plan plan(String code, long price, Long tokenLimit) {
        Plan p = Plan.builder()
                .code(code).nameVi(code).nameEn(code)
                .price(price).monthlyTokenLimit(tokenLimit)
                .billingIntervalMonths((short) 1).isActive(true)
                .build();
        p.setId(UUID.randomUUID());
        return p;
    }

    private CheckoutResponse checkout(Plan plan) {
        // User của lớp này mặc định đang Free → báo giá = đúng giá niêm yết.
        return checkout(plan, plan.getPrice());
    }

    private CheckoutResponse checkout(Plan plan, long expectedAmount) {
        return service.checkout(EMAIL, CheckoutRequest.builder().planId(plan.getId())
                .paymentMethod(PaymentMethod.PAYOS_VIETQR).expectedAmount(expectedAmount).build()).getResult();
    }

    private Payment onlyOpenOrder() {
        return store.values().stream()
                .filter(p -> p.getStatus() == PaymentStatus.PENDING)
                .findFirst().orElse(null);
    }

    // ================================================================ đường thành công

    @Test
    void checkout_createsPendingOrderWithLinkAndSingleExpiryMoment() {
        CheckoutResponse response = checkout(proPlan);

        assertNotNull(response.getCheckoutUrl());
        assertEquals(299_000L, response.getAmount());
        assertEquals("PRO", response.getPlanCode());
        assertFalse(response.getReused());

        Payment saved = store.get(response.getPaymentId());
        assertEquals(PaymentStatus.PENDING, saved.getStatus());
        assertEquals(15, saved.getGatewayTxnId().length(), "orderCode phải đủ 15 chữ số");
        assertEquals(saved.getExpiresAt(), response.getExpiresAt(),
                "expiresAt chỉ có MỘT nguồn — đơn và response phải trùng");
    }

    // ================================================================ ⚠️ KỊCH BẢN DEADLOCK

    /**
     * ⚠️ Lỗi nghiêm trọng nhất của thiết kế "giữ đơn + reconcile": tạo link timeout để lại đơn
     * PENDING <b>không có checkoutUrl</b>. Đơn đó chiếm chỗ PENDING duy nhất (partial unique
     * {@code uk_payments_one_pending_per_user}) nên chặn user tạo đơn mới, mà bản thân nó lại
     * không có link để trả tiền.
     *
     * <p>Test này khẳng định user <b>không bị bế tắc</b>: bấm mua lại là ra link mới.</p>
     */
    @Test
    void checkout_afterCreateLinkTimeout_userIsNotDeadlocked() {
        gateway.useScenario(MockGatewayScenario.CREATE_TIMEOUT);
        AppException first = assertThrows(AppException.class, () -> checkout(proPlan));
        assertEquals(ErrorCode.PAYMENT_GATEWAY_TIMEOUT, first.getErrorCode());

        Payment stuck = onlyOpenOrder();
        assertNotNull(stuck, "Đơn phải GIỮ PENDING — link có thể đã tạo bên cổng");
        assertNull(stuck.getCheckoutUrl());
        assertTrue(stuck.getReconcileRequired());
        assertNotEquals(PaymentStatus.FAILED, stuck.getStatus(), "Timeout KHÔNG được đóng đơn FAILED");

        // Cổng hồi phục, nhưng nó khẳng định chưa từng có link này.
        gateway.useScenario(MockGatewayScenario.GET_LINK_NOT_FOUND);
        CheckoutResponse retry = checkout(proPlan);

        assertNotNull(retry.getCheckoutUrl(), "User phải mua lại được ngay trong request kế tiếp");
        assertEquals(PaymentStatus.CANCELLED, store.get(stuck.getId()).getStatus());
        assertEquals("GATEWAY_LINK_MISSING", store.get(stuck.getId()).getFailedReason());
        assertFalse(store.get(stuck.getId()).getReconcileRequired());
    }

    /**
     * Cùng kịch bản nhưng để JOB đối soát dọn, không cần user bấm lại — hai đường thoát cố ý
     * làm trùng nhau.
     */
    @Test
    void reconcileJob_closesOrderWhoseLinkNeverExisted() {
        gateway.useScenario(MockGatewayScenario.CREATE_TIMEOUT);
        assertThrows(AppException.class, () -> checkout(proPlan));
        UUID stuckId = onlyOpenOrder().getId();

        gateway.useScenario(MockGatewayScenario.GET_LINK_NOT_FOUND);
        assertEquals(1, service.reconcileStuckOrders());

        assertEquals(PaymentStatus.CANCELLED, store.get(stuckId).getStatus());
        assertNull(onlyOpenOrder(), "Chỗ PENDING đã được giải phóng");
    }

    /**
     * Link CÓ thật và còn PENDING nhưng cổng không trả lại URL (đúng thực tế payOS) → đối soát
     * phải huỷ link để giải phóng chỗ, chứ không để đơn treo mãi.
     */
    @Test
    void reconcileJob_cancelsLiveLinkWhenUrlCannotBeRecovered() {
        gateway.useScenario(MockGatewayScenario.CREATE_TIMEOUT);
        assertThrows(AppException.class, () -> checkout(proPlan));
        UUID stuckId = onlyOpenOrder().getId();

        gateway.useScenario(MockGatewayScenario.NORMAL);
        assertEquals(1, service.reconcileStuckOrders());

        assertEquals(PaymentStatus.CANCELLED, store.get(stuckId).getStatus());
        assertEquals("LINK_URL_UNRECOVERABLE", store.get(stuckId).getFailedReason());
    }

    /** Vẫn không hỏi được cổng → đếm vòng, KHÔNG đóng đơn bừa. */
    @Test
    void reconcileJob_keepsOrderWhenGatewayStillUnreachable() {
        gateway.useScenario(MockGatewayScenario.CREATE_TIMEOUT);
        assertThrows(AppException.class, () -> checkout(proPlan));
        UUID stuckId = onlyOpenOrder().getId();

        gateway.useScenario(MockGatewayScenario.GET_UNREACHABLE);
        assertEquals(0, service.reconcileStuckOrders());

        assertEquals(PaymentStatus.PENDING, store.get(stuckId).getStatus());
        assertTrue(store.get(stuckId).getExpiryGraceCount() >= 1, "Phải đếm số vòng đã thử");
    }

    // ================================================================ Q2

    /** Cùng gói → trả lại ĐÚNG link cũ và GIỮ NGUYÊN expiresAt (không cộng lại TTL). */
    @Test
    void checkout_samePlanTwice_reusesExistingLinkAndExpiry() {
        CheckoutResponse first = checkout(proPlan);
        CheckoutResponse second = checkout(proPlan);

        assertEquals(first.getPaymentId(), second.getPaymentId());
        assertEquals(first.getCheckoutUrl(), second.getCheckoutUrl());
        assertEquals(first.getExpiresAt(), second.getExpiresAt());
        assertTrue(second.getReused());
    }

    /** Khác gói → huỷ đơn cũ rồi tạo đơn mới. */
    @Test
    void checkout_differentPlan_cancelsOldOrderAndCreatesNew() {
        CheckoutResponse first = checkout(plusPlan);
        CheckoutResponse second = checkout(proPlan);

        assertNotEquals(first.getPaymentId(), second.getPaymentId());
        assertEquals(PaymentStatus.CANCELLED, store.get(first.getPaymentId()).getStatus());
        assertEquals("REPLACED_BY_NEW_ORDER", store.get(first.getPaymentId()).getFailedReason());
        assertEquals(PaymentStatus.PENDING, store.get(second.getPaymentId()).getStatus());
    }

    /** Điểm E: link cũ đã chết bên cổng → đồng bộ rồi tạo đơn mới, không trả link chết. */
    @Test
    void checkout_whenOldLinkExpiredAtGateway_createsFreshOrder() {
        CheckoutResponse first = checkout(proPlan);
        gateway.useScenario(MockGatewayScenario.LINK_EXPIRED);

        CheckoutResponse second = checkout(proPlan);

        assertNotEquals(first.getPaymentId(), second.getPaymentId());
        assertEquals(PaymentStatus.EXPIRED, store.get(first.getPaymentId()).getStatus());
    }

    // ================================================================ H2 — hai luồng đồng thời

    /**
     * H2: partial unique nổ khi hai luồng cùng tạo đơn. KHÔNG được để lỗi DB lọt ra client —
     * vòng sau đọc lại đơn PENDING kia và đi đúng luồng Q2.
     */
    @Test
    void checkout_concurrentInsert_translatesDbConstraintIntoQ2Flow() {
        Payment rival = Payment.builder()
                .user(user).plan(proPlan).amount(proPlan.getPrice()).currency("VND")
                .status(PaymentStatus.PENDING).gateway(PaymentGateway.MOCK)
                .paymentMethod(PaymentMethod.PAYOS_VIETQR)
                .gatewayTxnId("100000000000001").orderedAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusMinutes(15))
                .checkoutUrl("http://localhost:3000/billing/mock/rival")
                .build();
        rival.setId(UUID.randomUUID());

        // doAnswer (không phải when(...)): when(mock.save(any())) sẽ GỌI mock với null và
        // kích hoạt answer đang có từ setUp trước khi kịp thay thế nó.
        doAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) {
                // Luồng kia vừa chèn xong ngay trước ta.
                store.put(rival.getId(), rival);
                throw dbViolation("uk_payments_one_pending_per_user",
                        "duplicate key value violates unique constraint \"uk_payments_one_pending_per_user\"");
            }
            store.put(p.getId(), p);
            return p;
        }).when(paymentRepository).save(any());

        CheckoutResponse response = checkout(proPlan);

        assertEquals(rival.getId(), response.getPaymentId(), "Phải dùng lại đơn của luồng thắng");
        assertTrue(response.getReused());
    }

    /**
     * Hồi quy 2026-09-25: {@code payments_gateway_check} thiếu {@code MOCK} → INSERT nổ 23514,
     * nhưng catch cũ coi MỌI {@link DataIntegrityViolationException} là đụng một-đơn-PENDING,
     * nhảy vào Q2, thử lại và hỏng tiếp. Ràng buộc KHÁC phải ra lỗi rõ ràng, KHÔNG thử lại.
     */
    @Test
    void checkout_otherConstraintViolation_isNotSwallowedIntoQ2Flow() {
        doThrow(dbViolation("payments_gateway_check",
                "new row for relation \"payments\" violates check constraint \"payments_gateway_check\""))
                .when(paymentRepository).save(any());

        AppException ex = assertThrows(AppException.class, () -> checkout(proPlan));

        assertEquals(ErrorCode.PAYMENT_ORDER_SAVE_FAILED, ex.getErrorCode(),
                "Không được báo nhầm là 'đang có đơn chờ' (PAYMENT_PENDING_EXISTS)");
        verify(paymentRepository, times(1)).save(any());
        verify(paymentRepository, times(1)).findOpenOrder(any(), any(), any());
    }

    /** Hibernate không bóc được tên → đọc từ message; không phải one-pending thì vẫn không thử lại. */
    @Test
    void checkout_constraintNameOnlyInMessage_isStillClassified() {
        doThrow(new DataIntegrityViolationException("could not execute statement",
                new java.sql.SQLException(
                        "ERROR: new row for relation \"payments\" violates check constraint \"payments_status_check\"")))
                .when(paymentRepository).save(any());

        AppException ex = assertThrows(AppException.class, () -> checkout(proPlan));

        assertEquals(ErrorCode.PAYMENT_ORDER_SAVE_FAILED, ex.getErrorCode());
        verify(paymentRepository, times(1)).save(any());
    }

    /** Không xác định được tên ràng buộc → coi là ràng buộc KHÁC, không bao giờ đoán là Q2. */
    @Test
    void checkout_unidentifiableConstraint_isNotGuessedAsQ2() {
        doThrow(new DataIntegrityViolationException("boom")).when(paymentRepository).save(any());

        AppException ex = assertThrows(AppException.class, () -> checkout(proPlan));

        assertEquals(ErrorCode.PAYMENT_ORDER_SAVE_FAILED, ex.getErrorCode());
        verify(paymentRepository, times(1)).save(any());
    }

    /** Đúng hình dạng Spring dịch từ lỗi PostgreSQL: DIVE ← Hibernate CVE (mang tên) ← SQLException. */
    private static DataIntegrityViolationException dbViolation(String constraint, String pgMessage) {
        java.sql.SQLException sql = new java.sql.SQLException("ERROR: " + pgMessage);
        return new DataIntegrityViolationException("could not execute statement",
                new ConstraintViolationException("could not execute statement", sql, constraint));
    }

    // ================================================================ Q1

    @Test
    void checkout_downgradeWhilePlanStillValid_isBlocked() {
        Subscription sub = Subscription.builder()
                .user(user).plan(proPlan).status(SubscriptionStatus.ACTIVE)
                .planSource(PlanSource.PAYMENT).planExpiresAt(LocalDateTime.now().plusDays(10))
                .currentPeriodStart(LocalDateTime.now()).currentPeriodEnd(LocalDateTime.now().plusMonths(1))
                .build();
        when(subscriptionRepository.findWithPlanByUserId(user.getId())).thenReturn(Optional.of(sub));

        AppException ex = assertThrows(AppException.class, () -> checkout(plusPlan));

        assertEquals(ErrorCode.PLAN_DOWNGRADE_NOT_ALLOWED, ex.getErrorCode());
        assertTrue(store.isEmpty(), "Không được tạo đơn khi đã bị chặn");
    }

    /** User đang ở Plus TỰ MUA (giá niêm yết lúc mua 99.000), còn hạn tới {@code expiresAt}. */
    private void currentlyOnPaidPlus(LocalDateTime expiresAt) {
        Subscription sub = Subscription.builder()
                .user(user).plan(plusPlan).status(SubscriptionStatus.ACTIVE)
                .planSource(PlanSource.PAYMENT).planExpiresAt(expiresAt)
                .currentPeriodStart(LocalDateTime.now()).currentPeriodEnd(LocalDateTime.now().plusMonths(1))
                .build();
        when(subscriptionRepository.findWithPlanByUserId(user.getId())).thenReturn(Optional.of(sub));
        when(paymentRepository.findFirstByUser_IdAndPlan_IdAndStatusAndDeletedAtIsNullOrderByPaidAtDesc(
                user.getId(), plusPlan.getId(), PaymentStatus.PAID))
                .thenReturn(Optional.of(Payment.builder().listPrice(99_000L).build()));
    }

    @Test
    void quote_upgrade_showsTheProrationAndCreatesNothing() {
        currentlyOnPaidPlus(LocalDateTime.now().plusDays(10).plusHours(1));

        CheckoutQuoteResponse quote = service.quote(EMAIL, proPlan.getId()).getResult();

        assertTrue(quote.getPurchasable());
        assertEquals(PaymentOrderType.UPGRADE, quote.getOrderType());
        assertEquals("PLUS", quote.getCurrentPlanCode());
        assertEquals(10, quote.getProrationRemainingDays());
        assertEquals(99_000L, quote.getOldListPrice());
        assertEquals(299_000L - quote.getProrationCredit() - quote.getRoundingAmount(), quote.getTotal());
        assertEquals(0, quote.getTotal() % 1_000, "tổng làm tròn xuống tới hàng nghìn");
        assertEquals(List.of(PaymentMethod.PAYOS_VIETQR), quote.getPaymentMethods());
        verify(paymentRepository, never()).save(any());
        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
    }

    @Test
    void checkout_upgrade_chargesTheQuotedAmountAndSnapshotsTheQuote() {
        LocalDateTime plusExpiry = LocalDateTime.now().plusDays(10).plusHours(1);
        currentlyOnPaidPlus(plusExpiry);
        CheckoutQuoteResponse quote = service.quote(EMAIL, proPlan.getId()).getResult();

        CheckoutResponse response = checkout(proPlan, quote.getTotal());

        Payment saved = store.get(response.getPaymentId());
        assertEquals(quote.getTotal(), saved.getAmount());
        assertEquals(PaymentOrderType.UPGRADE, saved.getOrderType());
        assertEquals(PaymentMethod.PAYOS_VIETQR, saved.getPaymentMethod());
        assertEquals(299_000L, saved.getListPrice(), "giá niêm yết lúc mua — nguồn khấu trừ lần sau");
        assertEquals(quote.getProrationCredit(), saved.getProrationCredit());
        assertEquals(10, saved.getProrationRemainingDays());
        assertEquals(quote.getRoundingAmount(), saved.getProrationRounding());
        assertEquals("PLUS", saved.getFromPlanCode());
        assertEquals(plusExpiry, saved.getFromExpiresAt());
        // Gói hiện tại chỉ đổi khi tiền về — tạo đơn thôi thì không đụng tới.
        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
    }

    @Test
    void checkout_expectedAmountDiffersFromTheQuote_isRejected() {
        AppException ex = assertThrows(AppException.class, () -> checkout(proPlan, 298_000L));

        assertEquals(ErrorCode.PAYMENT_QUOTE_CHANGED, ex.getErrorCode());
        assertTrue(store.isEmpty());
    }

    @Test
    void checkout_blockedUpgrade_failsWithTheReasonTheQuoteShows() {
        // Plus 99.000 còn ~60 ngày (gia hạn chồng) → giá trị còn lại ~195.000 > giá gói mới 120.000.
        Plan plusMax = plan("PLUS_MAX", 120_000L, 600_000L);
        when(planRepository.findByIdAndDeletedAtIsNull(plusMax.getId())).thenReturn(Optional.of(plusMax));
        currentlyOnPaidPlus(LocalDateTime.now().plusDays(60));

        CheckoutQuoteResponse quote = service.quote(EMAIL, plusMax.getId()).getResult();
        AppException ex = assertThrows(AppException.class, () -> checkout(plusMax, quote.getTotal()));

        assertFalse(quote.getPurchasable());
        assertEquals(ErrorCode.UPGRADE_CREDIT_EXCEEDS_PRICE.getCode(), quote.getBlockedCode());
        assertEquals(ErrorCode.UPGRADE_CREDIT_EXCEEDS_PRICE, ex.getErrorCode());
        assertTrue(store.isEmpty(), "không bao giờ tạo đơn ≤ 0");
    }

    @Test
    void checkout_samePlanButTheAmountChanged_replacesTheOldPendingOrder() {
        CheckoutResponse first = checkout(proPlan);           // lúc còn Free: 299.000
        currentlyOnPaidPlus(LocalDateTime.now().plusDays(10).plusHours(1));
        long upgradeTotal = service.quote(EMAIL, proPlan.getId()).getResult().getTotal();

        CheckoutResponse second = checkout(proPlan, upgradeTotal);

        assertNotEquals(first.getPaymentId(), second.getPaymentId(),
                "link cũ mang số tiền cũ — dùng lại là bắt user trả khác con số vừa thấy");
        assertEquals(PaymentStatus.CANCELLED, store.get(first.getPaymentId()).getStatus());
        assertEquals(upgradeTotal, second.getAmount());
    }

    @Test
    void checkout_inactiveOrFreePlan_isNotPurchasable() {
        Plan free = plan("FREE", 0L, 100_000L);
        when(planRepository.findByIdAndDeletedAtIsNull(free.getId())).thenReturn(Optional.of(free));

        AppException ex = assertThrows(AppException.class, () -> checkout(free));
        assertEquals(ErrorCode.PLAN_NOT_PURCHASABLE, ex.getErrorCode());
    }

    // ================================================================ idempotency

    /** Webhook + job đối soát + verify thủ công cùng gọi tới: chỉ kích hoạt gói MỘT lần. */
    @Test
    void applyGatewayResult_isIdempotentAcrossRepeatedCalls() {
        CheckoutResponse response = checkout(proPlan);
        UUID id = response.getPaymentId();
        when(subscriptionService.activatePaidPlan(any(), any(), any()))
                .thenReturn(Subscription.builder().planStartedAt(LocalDateTime.now()).build());

        service.applyGatewayResult(id, GatewayLinkStatus.PAID, 299_000L, "{}", null);
        service.applyGatewayResult(id, GatewayLinkStatus.PAID, 299_000L, "{}", null);
        service.applyGatewayResult(id, GatewayLinkStatus.PAID, 299_000L, "{}", null);

        verify(subscriptionService, times(1)).activatePaidPlan(any(), any(), any());
        assertEquals(PaymentStatus.PAID, store.get(id).getStatus());
        assertNotNull(store.get(id).getInvoiceNo());
    }

    /** Bẫy UNDERPAID: webhook vẫn báo code="00" — tiền lệch thì KHÔNG kích hoạt gói. */
    @Test
    void applyGatewayResult_amountMismatch_recordsMoneyButDoesNotActivate() {
        UUID id = checkout(proPlan).getPaymentId();

        service.applyGatewayResult(id, GatewayLinkStatus.PAID, 100_000L, "{}", null);

        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
        assertTrue(store.get(id).getReconcileRequired());
        assertEquals(PaymentStatus.PAID, store.get(id).getStatus());
    }

    @Test
    void applyGatewayResult_underpaid_keepsOrderPendingAndFlagsReconcile() {
        UUID id = checkout(proPlan).getPaymentId();

        service.applyGatewayResult(id, GatewayLinkStatus.UNDERPAID, 100_000L, "{}", null);

        assertEquals(PaymentStatus.PENDING, store.get(id).getStatus());
        assertTrue(store.get(id).getReconcileRequired());
        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
    }

    /** Trạng thái cổng lạ → không đoán bừa, giữ nguyên đơn + cờ đối soát. */
    @Test
    void applyGatewayResult_unknownStatus_keepsOrderAndFlagsReconcile() {
        UUID id = checkout(proPlan).getPaymentId();

        service.applyGatewayResult(id, GatewayLinkStatus.UNKNOWN, null, null, null);

        assertEquals(PaymentStatus.PENDING, store.get(id).getStatus());
        assertTrue(store.get(id).getReconcileRequired());
    }
}
