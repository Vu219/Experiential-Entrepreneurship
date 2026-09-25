package com.aima.payment;

import com.aima.config.PaymentProperties;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.NotificationType;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.mapper.PaymentMapperImpl;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.NotificationService;
import com.aima.service.PaymentGatewayClient;
import com.aima.service.SubscriptionService;
import com.aima.service.SystemLogService;
import com.aima.service.Impl.PaymentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Webhook payOS — nơi tiền thật đổi chủ, nên mọi nhánh ở đây đều được pin bằng test.
 *
 * <p>Ba bất biến mà bộ test này bảo vệ:</p>
 * <ol>
 *   <li><b>Không bao giờ ném ra ngoài.</b> payOS retry mọi response khác 200; một exception lọt
 *       ra là một vòng retry vô hạn.</li>
 *   <li><b>Không bao giờ kích hoạt gói chỉ vì {@code code = "00"}.</b> Khách chuyển thiếu vẫn
 *       làm payOS gửi {@code code = "00"} — điều kiện kích hoạt phải là chữ ký hợp lệ VÀ cổng
 *       xác nhận link PAID VÀ số tiền khớp TUYỆT ĐỐI.</li>
 *   <li><b>Idempotent.</b> payOS gửi lặp là chuyện thường; gói chỉ được kích hoạt một lần.</li>
 * </ol>
 *
 * <p>Dùng Mockito cho {@code PaymentGatewayClient} (không phải cổng giả lập) vì ở đây cần điều
 * khiển ĐỘC LẬP hai thứ: kết quả kiểm chữ ký và trạng thái link phía cổng.</p>
 */
class PaymentWebhookTest {

    private static final String EMAIL = "buyer@aima.test";
    private static final long AMOUNT = 299_000L;
    private static final String ORDER_CODE = "123456789012345";
    private static final int ALERT_THRESHOLD = 5;

    private PaymentRepository paymentRepository;
    private ActivityLogRepository activityLogRepository;
    private UserRepository userRepository;
    private SubscriptionService subscriptionService;
    private NotificationService notificationService;
    private ActivityLogService activityLogService;
    private PaymentGatewayClient gateway;
    private PaymentServiceImpl service;

    private final Map<UUID, Payment> store = new HashMap<>();

    private User user;
    private Plan proPlan;

    @BeforeEach
    void setUp() {
        paymentRepository = mock(PaymentRepository.class);
        activityLogRepository = mock(ActivityLogRepository.class);
        PlanRepository planRepository = mock(PlanRepository.class);
        userRepository = mock(UserRepository.class);
        SubscriptionRepository subscriptionRepository = mock(SubscriptionRepository.class);
        subscriptionService = mock(SubscriptionService.class);
        notificationService = mock(NotificationService.class);
        activityLogService = mock(ActivityLogService.class);
        gateway = mock(PaymentGatewayClient.class);
        when(gateway.gateway()).thenReturn(PaymentGateway.PAYOS);

        user = User.builder().email(EMAIL).plan(UserPlan.FREE).build();
        user.setId(UUID.randomUUID());
        proPlan = Plan.builder()
                .code("PRO").nameVi("PRO").nameEn("PRO")
                .price(AMOUNT).monthlyTokenLimit(2_000_000L)
                .billingIntervalMonths((short) 1).isActive(true)
                .build();
        proPlan.setId(UUID.randomUUID());

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        doAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) {
                p.setId(UUID.randomUUID());
            }
            store.put(p.getId(), p);
            return p;
        }).when(paymentRepository).save(any());
        when(paymentRepository.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0))));
        when(paymentRepository.findByIdForUpdate(any()))
                .thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0))));
        when(paymentRepository.findByGatewayTxnIdAndDeletedAtIsNull(anyString()))
                .thenAnswer(inv -> store.values().stream()
                        .filter(p -> inv.getArgument(0).equals(p.getGatewayTxnId()))
                        .findFirst());

        // Gói được kích hoạt thành công → subscription có hạn mới.
        when(subscriptionService.activatePaidPlan(any(), any(), any())).thenAnswer(inv -> {
            LocalDateTime now = inv.getArgument(2);
            return Subscription.builder()
                    .user(user).plan(proPlan)
                    .planStartedAt(now).planExpiresAt(now.plusMonths(1))
                    .build();
        });

        TransactionTemplate transactionTemplate = mock(TransactionTemplate.class);
        when(transactionTemplate.execute(any())).thenAnswer(inv ->
                ((TransactionCallback<?>) inv.getArgument(0)).doInTransaction(mock(TransactionStatus.class)));

        PaymentProperties properties = new PaymentProperties(
                PaymentGateway.PAYOS, 15, 10, 3, 16384, ALERT_THRESHOLD, 10);

        service = new PaymentServiceImpl(paymentRepository, activityLogRepository,
                planRepository, userRepository,
                subscriptionRepository, subscriptionService, new PaymentMapperImpl(),
                properties, transactionTemplate, notificationService, activityLogService,
                mock(SystemLogService.class), new MockEnvironment(), List.of(gateway));
    }

    // ------------------------------------------------------------------ tiện ích

    private Payment seedOrder(PaymentStatus status) {
        Payment payment = Payment.builder()
                .user(user).plan(proPlan)
                .amount(AMOUNT).currency("VND")
                .status(status)
                .gateway(PaymentGateway.PAYOS)
                .gatewayTxnId(ORDER_CODE)
                .orderedAt(LocalDateTime.now().minusMinutes(5))
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .checkoutUrl("https://pay.payos.vn/web/abc")
                .build();
        payment.setId(UUID.randomUUID());
        store.put(payment.getId(), payment);
        return payment;
    }

    private void gatewaySaysSignatureValid(long amountInWebhook) {
        when(gateway.verifyWebhook(anyString())).thenReturn(new PaymentGatewayClient.WebhookData(
                Long.parseLong(ORDER_CODE), amountInWebhook, "PRO", "FT123", "00", "success",
                "link-1"));
    }

    private void gatewayLinkIs(GatewayLinkStatus status, Long amountPaid) {
        when(gateway.getPaymentLink(anyString())).thenReturn(new PaymentGatewayClient.GatewayOrder(
                status, AMOUNT, amountPaid, "link-1", null, status.name()));
    }

    private static String body(String suffix) {
        return "{\"code\":\"00\",\"data\":{\"orderCode\":" + ORDER_CODE + "}" + suffix + "}";
    }

    // ------------------------------------------------------------------ đường thành công

    @Test
    void webhook_fullAmountAndLinkPaid_activatesPlan() {
        Payment payment = seedOrder(PaymentStatus.PENDING);
        gatewaySaysSignatureValid(AMOUNT);
        gatewayLinkIs(GatewayLinkStatus.PAID, AMOUNT);

        service.handleWebhook(body(""));

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PAID, saved.getStatus());
        assertNotNull(saved.getPaidAt());
        assertNotNull(saved.getInvoiceNo(), "đơn PAID phải có số hoá đơn");
        assertFalse(saved.getReconcileRequired(), "đường sạch thì không được bật cờ đối soát");
        assertNotNull(saved.getRawPayload(), "payload thô phải được lưu để đối soát");
        verify(subscriptionService, times(1)).activatePaidPlan(any(), eq(proPlan), any());
        verify(notificationService).notify(eq(user), eq(NotificationType.PAYMENT_SUCCEEDED),
                anyString(), anyString(), any());
    }

    @Test
    void webhook_sentTwice_activatesOnlyOnce() {
        seedOrder(PaymentStatus.PENDING);
        gatewaySaysSignatureValid(AMOUNT);
        gatewayLinkIs(GatewayLinkStatus.PAID, AMOUNT);

        service.handleWebhook(body(""));
        service.handleWebhook(body(""));
        service.handleWebhook(body(""));

        verify(subscriptionService, times(1)).activatePaidPlan(any(), any(), any());
    }

    // ------------------------------------------------------------------ bẫy UNDERPAID

    @Test
    void webhook_underpaidLink_keepsPendingAndAsksForReconcile() {
        // payOS VẪN gửi code="00" khi khách chuyển thiếu — đây chính là cái bẫy.
        Payment payment = seedOrder(PaymentStatus.PENDING);
        gatewaySaysSignatureValid(150_000L);
        gatewayLinkIs(GatewayLinkStatus.UNDERPAID, 150_000L);

        service.handleWebhook(body(""));

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PENDING, saved.getStatus(), "chuyển thiếu thì đơn chưa xong");
        assertTrue(saved.getReconcileRequired());
        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
    }

    @Test
    void webhook_linkPaidButAmountMismatch_doesNotActivate() {
        Payment payment = seedOrder(PaymentStatus.PENDING);
        gatewaySaysSignatureValid(150_000L);   // số tiền ĐÃ KÝ lệch với đơn
        gatewayLinkIs(GatewayLinkStatus.PAID, AMOUNT);

        service.handleWebhook(body(""));

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PAID, saved.getStatus(), "tiền đã về thì vẫn phải ghi nhận");
        assertTrue(saved.getReconcileRequired(), "nhưng lệch tiền thì phải để admin đối soát");
        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
    }

    // ------------------------------------------------------------------ nhánh từ chối

    @Test
    void webhook_invalidSignature_changesNothingAndLeavesATrace() {
        Payment payment = seedOrder(PaymentStatus.PENDING);
        when(gateway.verifyWebhook(anyString()))
                .thenThrow(new com.aima.exception.AppException(
                        com.aima.exception.ErrorCode.PAYMENT_SIGNATURE_INVALID));

        assertDoesNotThrow(() -> service.handleWebhook(body("")));

        assertEquals(PaymentStatus.PENDING, store.get(payment.getId()).getStatus());
        verify(gateway, never()).getPaymentLink(anyString());

        ArgumentCaptor<ActivityLogService.Entry> entry =
                ArgumentCaptor.forClass(ActivityLogService.Entry.class);
        verify(activityLogService).record(entry.capture());
        assertEquals(ActivityAction.PAYMENT_WEBHOOK_REJECTED, entry.getValue().action());
    }

    @Test
    void webhook_oversizedBody_isRejectedBeforeParsing() {
        seedOrder(PaymentStatus.PENDING);
        String huge = "{\"pad\":\"" + "x".repeat(20_000) + "\"}";

        assertDoesNotThrow(() -> service.handleWebhook(huge));

        // Điểm F: chặn TRƯỚC khi parse — không được để một body khổng lồ đi vào bộ parse JSON.
        verify(gateway, never()).verifyWebhook(anyString());
        verify(activityLogService).record(any());
    }

    @Test
    void webhook_unknownOrderCode_isIgnoredQuietly() {
        // payOS gửi giao dịch MẪU (orderCode = 123) lúc /confirm-webhook. Ném lỗi ở đây =
        // ĐĂNG KÝ WEBHOOK THẤT BẠI, nên nhánh này phải im lặng và trả về bình thường.
        when(gateway.verifyWebhook(anyString())).thenReturn(new PaymentGatewayClient.WebhookData(
                123L, 2000L, "sample", "FT", "00", "success", "link-sample"));

        assertDoesNotThrow(() -> service.handleWebhook("{\"data\":{\"orderCode\":123}}"));

        verify(gateway, never()).getPaymentLink(anyString());
        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
    }

    @Test
    void webhook_gatewayUnreachable_flagsReconcileWithoutThrowing() {
        Payment payment = seedOrder(PaymentStatus.PENDING);
        gatewaySaysSignatureValid(AMOUNT);
        when(gateway.getPaymentLink(anyString())).thenThrow(new com.aima.exception.AppException(
                com.aima.exception.ErrorCode.PAYMENT_GATEWAY_TIMEOUT));

        assertDoesNotThrow(() -> service.handleWebhook(body("")));

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PENDING, saved.getStatus());
        assertTrue(saved.getReconcileRequired());
        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
    }

    // ------------------------------------------------------------------ tiền về muộn

    @Test
    void webhook_moneyArrivesAfterOrderExpired_recordsItButDoesNotActivate() {
        Payment payment = seedOrder(PaymentStatus.EXPIRED);
        gatewaySaysSignatureValid(AMOUNT);
        gatewayLinkIs(GatewayLinkStatus.PAID, AMOUNT);

        service.handleWebhook(body(""));

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PAID, saved.getStatus(), "tiền của khách không được bỏ qua");
        assertTrue(saved.getReconcileRequired(), "nhưng gói phải do admin quyết định, không tự bật");
        verify(subscriptionService, never()).activatePaidPlan(any(), any(), any());
    }

    // ------------------------------------------------------------------ cảnh báo cho admin

    /**
     * Điểm mù chết người: quy ước chữ ký lệch → 100% webhook fail → khách trả tiền xong không
     * được kích hoạt gói, mà KHÔNG đơn nào mang {@code reconcile_required} để ai đó nhìn ra.
     * Bộ đếm này là tín hiệu duy nhất, nên nó phải nổ.
     */
    @Test
    void webhook_signatureRejectionsAboveThreshold_alertAdmins() {
        User admin = adminUser();
        when(gateway.verifyWebhook(anyString())).thenThrow(new com.aima.exception.AppException(
                com.aima.exception.ErrorCode.PAYMENT_SIGNATURE_INVALID));
        // Cửa sổ đã có đủ số lần từ chối trước đó.
        when(activityLogRepository.countByActionSince(anyString(), any()))
                .thenReturn((long) ALERT_THRESHOLD - 1);

        service.handleWebhook(body(""));

        verify(notificationService).notify(eq(admin), eq(NotificationType.PAYMENT_WEBHOOK_ALERT),
                anyString(), anyString(), any());
    }

    @Test
    void webhook_fewSignatureRejections_doNotAlertYet() {
        adminUser();
        when(gateway.verifyWebhook(anyString())).thenThrow(new com.aima.exception.AppException(
                com.aima.exception.ErrorCode.PAYMENT_SIGNATURE_INVALID));
        when(activityLogRepository.countByActionSince(anyString(), any())).thenReturn(0L);

        service.handleWebhook(body(""));

        verify(notificationService, never()).notify(any(), eq(NotificationType.PAYMENT_WEBHOOK_ALERT),
                anyString(), anyString(), any());
    }

    /** Khớp biến thể format số = gần như chắc chắn lỗi của TA → báo ngay, không đợi ngưỡng. */
    @Test
    void webhook_numberStyleMismatch_alertsOnTheVeryFirstOccurrence() {
        User admin = adminUser();
        when(gateway.verifyWebhook(anyString())).thenThrow(new com.aima.exception.AppException(
                com.aima.exception.ErrorCode.PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH));
        when(activityLogRepository.countByActionSince(anyString(), any())).thenReturn(0L);

        service.handleWebhook(body(""));

        verify(notificationService).notify(eq(admin), eq(NotificationType.PAYMENT_WEBHOOK_ALERT),
                anyString(), anyString(), any());
    }

    /** Body rác/quá cỡ KHÔNG phải tín hiệu cấu hình sai — đừng gọi admin dậy vì nó. */
    @Test
    void webhook_oversizedBody_neverAlertsAdmins() {
        adminUser();
        when(activityLogRepository.countByActionSince(anyString(), any()))
                .thenReturn(1_000L);

        service.handleWebhook("{\"pad\":\"" + "x".repeat(20_000) + "\"}");

        verify(notificationService, never()).notify(any(), any(), anyString(), anyString(), any());
    }

    /** Một trận bão webhook không được biến thành một trận bão thông báo. */
    @Test
    void webhook_repeatedRejections_alertAdminsOnlyOncePerWindow() {
        adminUser();
        when(gateway.verifyWebhook(anyString())).thenThrow(new com.aima.exception.AppException(
                com.aima.exception.ErrorCode.PAYMENT_SIGNATURE_INVALID));
        when(activityLogRepository.countByActionSince(anyString(), any()))
                .thenReturn((long) ALERT_THRESHOLD * 10);

        for (int i = 0; i < 20; i++) {
            service.handleWebhook(body(""));
        }

        verify(notificationService, times(1)).notify(any(), eq(NotificationType.PAYMENT_WEBHOOK_ALERT),
                anyString(), anyString(), any());
    }

    private User adminUser() {
        User admin = User.builder().email("admin@aima.test").build();
        admin.setId(UUID.randomUUID());
        when(userRepository.findActiveByRoleName(anyString(), eq(UserStatus.ACTIVE)))
                .thenReturn(List.of(admin));
        return admin;
    }
}
