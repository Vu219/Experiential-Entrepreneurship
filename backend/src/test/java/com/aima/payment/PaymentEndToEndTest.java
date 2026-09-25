package com.aima.payment;

import com.aima.dto.request.CheckoutRequest;
import com.aima.dto.request.PaymentActionRequest;
import com.aima.dto.response.BillingOverviewResponse;
import com.aima.dto.response.CheckoutResponse;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.Role;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.MockGatewayScenario;
import com.aima.enums.MockPaymentOutcome;
import com.aima.enums.PaymentStatus;
import com.aima.enums.PlanSource;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AdminPaymentService;
import com.aima.service.Impl.MockGatewayClientImpl;
import com.aima.service.PaymentService;
import com.aima.service.SubscriptionService;
import com.aima.service.TokenUsageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Chạy TOÀN TUYẾN mua gói trên cổng giả lập, với Spring context thật + H2 thật: service thật,
 * repository thật, transaction thật, {@code MockGatewayClientImpl} thật.
 *
 * <p>Khác các test đơn vị ở {@code PaymentCheckoutTest}/{@code PaymentWebhookTest} (mock
 * repository trong bộ nhớ): ở đây mọi thứ đi qua JPA và ranh giới transaction thật, nên nó bắt
 * được đúng loại lỗi mà unit test không thấy — mapper hỏng, quan hệ lazy, thứ tự commit.</p>
 *
 * <p><b>Ba job nền bị vô hiệu bằng cấu hình</b> (chu kỳ 1 giờ, cron 01/01) thay vì tắt
 * scheduling: test tự gọi thẳng {@code expireOverdueOrders()}/{@code reconcileStuckOrders()}
 * nên phải chắc chắn không có job nào chạy xen vào giữa và làm kết quả bấp bênh.</p>
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
class PaymentEndToEndTest {

    @Autowired
    private PaymentService paymentService;
    @Autowired
    private AdminPaymentService adminPaymentService;
    @Autowired
    private SubscriptionService subscriptionService;
    @Autowired
    private TokenUsageService tokenUsageService;
    @Autowired
    private MockGatewayClientImpl mockGateway;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private PlanRepository planRepository;
    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private SubscriptionRepository subscriptionRepository;
    @Autowired
    private ActivityLogRepository activityLogRepository;

    @AfterEach
    void resetGateway() {
        // Bean cổng giả lập dùng chung cả context — kịch bản hỏng rò sang test sau là một
        // nguồn "test đỏ ngẫu nhiên" rất tốn thời gian truy.
        mockGateway.useScenario(MockGatewayScenario.NORMAL);
    }

    // ================================================================== tiện ích

    private User newUser(String tag) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = tag + "-" + UUID.randomUUID() + "@e2e.local";
        User user = User.builder()
                .username(email).email(email).fullName("E2E " + tag)
                .password("{noop}x").role(role).status(UserStatus.ACTIVE)
                .plan(UserPlan.FREE)
                .build();
        return userRepository.save(user);
    }

    private Plan plan(String code) {
        return planRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow();
    }

    /** Tạo đơn + trả tiền thành công trên cổng giả lập — đường "mua gói" đầy đủ. */
    private UUID buyAndPay(User user, String planCode) {
        UUID paymentId = createOrder(user, planCode);
        paymentService.applyMockOutcome(user.getEmail(), paymentId, MockPaymentOutcome.SUCCESS);
        return paymentId;
    }

    private UUID createOrder(User user, String planCode) {
        CheckoutResponse order = paymentService
                .checkout(user.getEmail(), CheckoutRequest.builder().planId(plan(planCode).getId()).build())
                .getResult();
        assertNotNull(order.getCheckoutUrl(), "đơn mới phải có link thanh toán");
        return order.getPaymentId();
    }

    private BillingOverviewResponse billing(User user) {
        return paymentService.getBilling(user.getEmail()).getResult();
    }

    private LocalDateTime expiryOf(User user) {
        return subscriptionRepository.findWithPlanByUserId(user.getId()).orElseThrow().getPlanExpiresAt();
    }

    /** Activity log ghi bất đồng bộ — chờ có giới hạn thay vì sleep cố định. */
    private boolean awaitActivity(ActivityAction action, UUID targetId) {
        for (int i = 0; i < 60; i++) {
            long hits = activityLogRepository.countByActionSince(action.name(),
                    LocalDateTime.now().minusMinutes(5));
            if (hits > 0 && activityLogRepository.findAll().stream()
                    .anyMatch(l -> action.name().equals(l.getAction().name())
                            && targetId.toString().equals(l.getTargetId()))) {
                return true;
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }

    // ================================================================== 1

    @Test
    void flow1_freeUserBuysPro_planActuallyChanges() {
        User user = newUser("f1");
        LocalDateTime before = LocalDateTime.now();

        UUID paymentId = buyAndPay(user, "PRO");

        Payment payment = paymentRepository.findById(paymentId).orElseThrow();
        assertEquals(PaymentStatus.PAID, payment.getStatus());
        assertNotNull(payment.getPaidAt());
        assertNotNull(payment.getInvoiceNo(), "đơn PAID phải có số hoá đơn");
        assertFalse(payment.getReconcileRequired());

        BillingOverviewResponse view = billing(user);
        assertEquals("PRO", view.getPlanCode());
        assertEquals(PlanSource.PAYMENT, view.getPlanSource());
        assertNotNull(view.getServerTime(), "FE cần giờ server để chạy đếm ngược");
        assertNull(view.getPendingPayment(), "đã trả tiền thì không còn đơn chờ");
        // Hạn = now + 1 chu kỳ (gói lõi là 1 tháng).
        assertTrue(view.getPlanExpiresAt().isAfter(before.plusMonths(1).minusMinutes(5)));
        assertTrue(view.getPlanExpiresAt().isBefore(before.plusMonths(1).plusMinutes(5)));

        // Nhãn cache phải được ghi CÙNG transaction — không có nó, request kế tiếp sẽ kéo gói cũ về.
        assertEquals(UserPlan.PRO, userRepository.findById(user.getId()).orElseThrow().getPlan());
    }

    // ================================================================== 2

    @Test
    void flow2_buyingTheSamePlanAgain_accumulatesTheExpiry() {
        User user = newUser("f2");
        buyAndPay(user, "PRO");
        LocalDateTime first = expiryOf(user);

        buyAndPay(user, "PRO");
        LocalDateTime second = expiryOf(user);

        // Q1 — trùng gói CÒN HẠN thì cộng dồn vào hạn cũ, không phải tính lại từ now.
        assertEquals(first.plusMonths(1).truncatedTo(ChronoUnit.SECONDS),
                second.truncatedTo(ChronoUnit.SECONDS));
    }

    // ================================================================== 3

    @Test
    void flow3_upgrade_replacesInsteadOfAccumulating() {
        User user = newUser("f3");
        buyAndPay(user, "PLUS");
        LocalDateTime plusExpiry = expiryOf(user);

        LocalDateTime before = LocalDateTime.now();
        buyAndPay(user, "PRO");
        LocalDateTime proExpiry = expiryOf(user);

        assertEquals("PRO", billing(user).getPlanCode());
        // Thay thế: hạn tính từ BÂY GIỜ, bỏ phần dư của gói cũ (nên phải NHỎ HƠN hạn cộng dồn).
        assertTrue(proExpiry.isBefore(plusExpiry.plusMonths(1)));
        assertTrue(proExpiry.isAfter(before.plusMonths(1).minusMinutes(5)));
        assertTrue(proExpiry.isBefore(before.plusMonths(1).plusMinutes(5)));
    }

    // ================================================================== 4

    @Test
    void flow4_buyingALowerPlanWhileCurrentIsValid_isBlocked() {
        User user = newUser("f4");
        buyAndPay(user, "PRO");

        AppException e = assertThrows(AppException.class, () -> createOrder(user, "PLUS"));

        assertEquals(ErrorCode.PLAN_DOWNGRADE_NOT_ALLOWED, e.getErrorCode());
        assertEquals("PRO", billing(user).getPlanCode(), "gói đang dùng không được đụng tới");
    }

    // ================================================================== 5

    @Test
    void flow5_abandonedOrderExpires_andTheUserCanBuyAgain() {
        User user = newUser("f5");
        UUID abandoned = createOrder(user, "PRO");

        // Đẩy hạn về quá khứ thay vì chờ 15 phút thật.
        Payment order = paymentRepository.findById(abandoned).orElseThrow();
        order.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        paymentRepository.save(order);

        assertEquals(1, paymentService.expireOverdueOrders());

        assertEquals(PaymentStatus.EXPIRED, paymentRepository.findById(abandoned).orElseThrow().getStatus(),
                "khách bỏ giỏ hàng là EXPIRED, KHÔNG phải FAILED — đừng thổi phồng tỉ lệ lỗi cổng");
        assertNull(billing(user).getPendingPayment(), "chỗ PENDING phải được giải phóng");

        // Và user mua lại được ngay.
        UUID fresh = createOrder(user, "PRO");
        assertNotEquals(abandoned, fresh);
    }

    // ================================================================== 6

    @Test
    void flow6_createLinkTimeout_doesNotLockTheUserOutOfBuying() {
        User user = newUser("f6");

        mockGateway.useScenario(MockGatewayScenario.CREATE_TIMEOUT);
        AppException e = assertThrows(AppException.class, () -> createOrder(user, "PRO"));
        assertEquals(ErrorCode.PAYMENT_GATEWAY_TIMEOUT, e.getErrorCode());

        Payment stuck = paymentRepository
                .findOpenOrder(user.getId(), PaymentStatus.PENDING,
                        List.of(com.aima.enums.PaymentGateway.PAYOS, com.aima.enums.PaymentGateway.MOCK))
                .orElseThrow();
        assertNull(stuck.getCheckoutUrl(), "đơn treo: có bản ghi nhưng không có link để trả tiền");
        assertTrue(stuck.getReconcileRequired());
        assertNotEquals(PaymentStatus.FAILED, stuck.getStatus(),
                "timeout KHÔNG kết luận được — link có thể đã tạo bên cổng");

        // Cổng hồi phục và khẳng định chưa từng có link này → job đối soát phải giải phóng đơn.
        mockGateway.useScenario(MockGatewayScenario.GET_LINK_NOT_FOUND);
        assertEquals(1, paymentService.reconcileStuckOrders());
        assertEquals(PaymentStatus.CANCELLED, paymentRepository.findById(stuck.getId()).orElseThrow().getStatus());

        mockGateway.useScenario(MockGatewayScenario.NORMAL);
        UUID retry = createOrder(user, "PRO");
        assertNotNull(retry, "user KHÔNG được bị khoá khỏi việc mua hàng vì một sự cố mạng thoáng qua");
    }

    // ================================================================== 7

    @Test
    void flow7_gatewayResultAppliedThreeTimes_activatesExactlyOnce() {
        User user = newUser("f7");
        UUID paymentId = buyAndPay(user, "PRO");
        LocalDateTime afterFirst = expiryOf(user);
        long amount = paymentRepository.findById(paymentId).orElseThrow().getAmount();

        // Webhook payOS bị gửi lặp là chuyện thường. Đây đúng là hàm mà webhook gọi.
        paymentService.applyGatewayResult(paymentId, GatewayLinkStatus.PAID, amount, "{\"repeat\":1}", null);
        paymentService.applyGatewayResult(paymentId, GatewayLinkStatus.PAID, amount, "{\"repeat\":2}", null);

        assertEquals(afterFirst.truncatedTo(ChronoUnit.SECONDS),
                expiryOf(user).truncatedTo(ChronoUnit.SECONDS),
                "gọi lặp KHÔNG được cộng hạn thêm lần nào");
        assertEquals(PaymentStatus.PAID, paymentRepository.findById(paymentId).orElseThrow().getStatus());
        assertEquals(1, paymentRepository.findAll().stream()
                .filter(p -> p.getUser().getId().equals(user.getId()))
                .filter(p -> p.getStatus() == PaymentStatus.PAID)
                .count(), "không được đẻ thêm dòng doanh thu nào");
    }

    // ================================================================== 8

    @Test
    void flow8_expiredPlan_dropsTheQuotaImmediately() {
        User user = newUser("f8");
        buyAndPay(user, "PRO");
        assertEquals(1_000_000L, tokenUsageService.state(user).limit(), "đang PRO thì hạn mức là của PRO");

        // Hết hạn GIỮA THÁNG — kỳ tính hạn mức (tháng lịch) vẫn đang chạy, nên nếu việc hạ gói
        // chỉ có tác dụng từ kỳ sau thì test này đỏ. Đó chính là điểm G.
        Subscription subscription = subscriptionRepository.findWithPlanByUserId(user.getId()).orElseThrow();
        subscription.setPlanExpiresAt(LocalDateTime.now().minusMinutes(1));
        subscriptionRepository.save(subscription);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertEquals(1_000L, tokenUsageService.state(reloaded).limit(),
                "hạn mức phải tụt về FREE NGAY lần đọc kế tiếp, không đợi cron");

        // Và lần đọc sau nữa cũng vậy — nhánh đồng bộ theo nhãn không được hồi sinh gói cũ.
        assertEquals("FREE", billing(userRepository.findById(user.getId()).orElseThrow()).getPlanCode());
    }

    // ================================================================== 9

    @Test
    void flow9_adminMarkPaid_activatesThePlanAndLeavesAnAuditTrail() {
        User user = newUser("f9");
        UUID paymentId = createOrder(user, "PRO");

        adminPaymentService.markPaid("admin@e2e.local", paymentId,
                PaymentActionRequest.builder().reason("Khách chuyển khoản tay, đối chiếu sao kê 23/09").build());

        assertEquals(PaymentStatus.PAID, paymentRepository.findById(paymentId).orElseThrow().getStatus());
        assertEquals("PRO", billing(user).getPlanCode(), "đánh dấu đã trả tiền phải KÍCH HOẠT gói thật");
        assertTrue(awaitActivity(ActivityAction.PAYMENT_MARKED_PAID, paymentId),
                "thao tác tay trên tiền bạc BẮT BUỘC để lại vết trong activity_logs");

        // Bấm lần hai không được cộng hạn thêm.
        AppException e = assertThrows(AppException.class, () -> adminPaymentService.markPaid(
                "admin@e2e.local", paymentId, PaymentActionRequest.builder().reason("bấm nhầm").build()));
        assertEquals(ErrorCode.PAYMENT_NOT_MARKABLE_PAID, e.getErrorCode());
    }
}
