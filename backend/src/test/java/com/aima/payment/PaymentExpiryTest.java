package com.aima.payment;

import com.aima.config.PaymentProperties;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.enums.UserPlan;
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
import static org.mockito.Mockito.*;

/**
 * Job đóng đơn quá hạn — điểm B §5.
 *
 * <p>Bất biến quan trọng nhất: <b>một đơn cổng đang báo {@code PROCESSING} thì TUYỆT ĐỐI không
 * được huỷ.</b> Huỷ nó nghĩa là tiền sẽ về sau khi đơn đã đóng, và mỗi ca như vậy là một lần
 * khách mất tiền phải xử lý tay.</p>
 *
 * <p>Bất biến thứ hai: job luôn <b>hỏi cổng trước khi đóng</b>, nên đơn đã trả tiền mà webhook
 * không tới được cứu ở đây thay vì bị đóng oan.</p>
 */
class PaymentExpiryTest {

    private static final long AMOUNT = 299_000L;
    private static final long GRACE_MINUTES = 10;
    private static final int MAX_GRACE_ROUNDS = 3;

    private PaymentRepository paymentRepository;
    private SubscriptionService subscriptionService;
    private PaymentGatewayClient gateway;
    private PaymentServiceImpl service;

    private final Map<UUID, Payment> store = new HashMap<>();

    private User user;
    private Plan proPlan;

    @BeforeEach
    void setUp() {
        paymentRepository = mock(PaymentRepository.class);
        subscriptionService = mock(SubscriptionService.class);
        gateway = mock(PaymentGatewayClient.class);
        when(gateway.gateway()).thenReturn(PaymentGateway.PAYOS);

        user = User.builder().email("buyer@aima.test").plan(UserPlan.FREE).build();
        user.setId(UUID.randomUUID());
        proPlan = Plan.builder()
                .code("PRO").nameVi("PRO").nameEn("PRO")
                .price(AMOUNT).monthlyTokenLimit(2_000_000L)
                .billingIntervalMonths((short) 1).isActive(true)
                .build();
        proPlan.setId(UUID.randomUUID());

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
        when(paymentRepository.findExpiredPendingIds(any(), any(), any()))
                .thenAnswer(inv -> store.values().stream()
                        .filter(p -> p.getStatus() == PaymentStatus.PENDING)
                        .filter(p -> p.getExpiresAt() != null
                                && !p.getExpiresAt().isAfter(inv.getArgument(2)))
                        .filter(p -> p.getCheckoutUrl() != null && !p.getReconcileRequired())
                        .map(Payment::getId)
                        .toList());
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
                PaymentGateway.PAYOS, 15, GRACE_MINUTES, MAX_GRACE_ROUNDS, 16384, 5, 10);

        service = new PaymentServiceImpl(paymentRepository, mock(ActivityLogRepository.class),
                mock(PlanRepository.class),
                mock(UserRepository.class), mock(SubscriptionRepository.class), subscriptionService,
                new PaymentMapperImpl(), properties, transactionTemplate,
                mock(NotificationService.class), mock(ActivityLogService.class),
                mock(SystemLogService.class), new MockEnvironment(), List.of(gateway));
    }

    private Payment seedOverdueOrder(int graceCount) {
        Payment payment = Payment.builder()
                .user(user).plan(proPlan)
                .amount(AMOUNT).currency("VND")
                .status(PaymentStatus.PENDING)
                .gateway(PaymentGateway.PAYOS)
                .gatewayTxnId("123456789012345")
                .orderedAt(LocalDateTime.now().minusMinutes(30))
                .expiresAt(LocalDateTime.now().minusMinutes(1))
                .expiryGraceCount(graceCount)
                .reconcileRequired(false)
                .checkoutUrl("https://pay.payos.vn/web/abc")
                .build();
        payment.setId(UUID.randomUUID());
        store.put(payment.getId(), payment);
        return payment;
    }

    private void gatewayLinkIs(GatewayLinkStatus status, Long amountPaid) {
        when(gateway.getPaymentLink(anyString())).thenReturn(new PaymentGatewayClient.GatewayOrder(
                status, AMOUNT, amountPaid, "link-1", null, status.name()));
    }

    // ------------------------------------------------------------------ điểm B

    @Test
    void expiry_processingLink_isExtendedNeverCancelled() {
        Payment payment = seedOverdueOrder(0);
        LocalDateTime before = payment.getExpiresAt();
        gatewayLinkIs(GatewayLinkStatus.PROCESSING, null);

        service.expireOverdueOrders();

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PENDING, saved.getStatus(), "đơn đang chuyển tiền không được đóng");
        assertEquals(1, saved.getExpiryGraceCount());
        assertEquals(before.plusMinutes(GRACE_MINUTES), saved.getExpiresAt());
        verify(gateway, never()).cancelPaymentLink(anyString(), anyString());
    }

    @Test
    void expiry_processingBeyondMaxRounds_callsAdminButKeepsOrderOpen() {
        Payment payment = seedOverdueOrder(MAX_GRACE_ROUNDS);
        LocalDateTime before = payment.getExpiresAt();
        gatewayLinkIs(GatewayLinkStatus.PROCESSING, null);

        service.expireOverdueOrders();

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PENDING, saved.getStatus(),
                "hết vòng ân hạn vẫn KHÔNG đóng đơn — chỉ chuyển cho admin");
        assertTrue(saved.getReconcileRequired());
        assertEquals(before, saved.getExpiresAt(), "vượt trần thì thôi gia hạn");
        verify(gateway, never()).cancelPaymentLink(anyString(), anyString());
    }

    // ------------------------------------------------------------------ cứu đơn & đóng đơn

    @Test
    void expiry_orderAlreadyPaidOnGateway_isRescuedInsteadOfClosed() {
        // Kịch bản webhook không tới (mất mạng, sai URL đăng ký): job là lưới an toàn cuối.
        Payment payment = seedOverdueOrder(0);
        gatewayLinkIs(GatewayLinkStatus.PAID, AMOUNT);

        service.expireOverdueOrders();

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PAID, saved.getStatus());
        assertNotNull(saved.getPaidAt());
        verify(subscriptionService).activatePaidPlan(any(), any(), any());
        verify(gateway, never()).cancelPaymentLink(anyString(), anyString());
    }

    @Test
    void expiry_linkStillOpenOnGateway_isCancelledThenMarkedExpired() {
        Payment payment = seedOverdueOrder(0);
        gatewayLinkIs(GatewayLinkStatus.PENDING, null);

        service.expireOverdueOrders();

        Payment saved = store.get(payment.getId());
        // EXPIRED chứ KHÔNG phải FAILED: khách không bấm trả tiền không phải cổng thanh toán
        // hỏng — nhét vào FAILED sẽ thổi phồng tỉ lệ giao dịch thất bại.
        assertEquals(PaymentStatus.EXPIRED, saved.getStatus());
        verify(gateway).cancelPaymentLink(anyString(), anyString());
    }

    @Test
    void expiry_gatewayUnreachable_keepsOrderOpenForTheNextRound() {
        Payment payment = seedOverdueOrder(0);
        when(gateway.getPaymentLink(anyString())).thenThrow(new com.aima.exception.AppException(
                com.aima.exception.ErrorCode.PAYMENT_GATEWAY_TIMEOUT));

        service.expireOverdueOrders();

        Payment saved = store.get(payment.getId());
        assertEquals(PaymentStatus.PENDING, saved.getStatus(),
                "không hỏi được cổng thì không được kết luận đơn đã chết");
        assertTrue(saved.getReconcileRequired());
    }

    @Test
    void expiry_orderNotDueYet_isLeftAlone() {
        Payment payment = seedOverdueOrder(0);
        payment.setExpiresAt(LocalDateTime.now().plusMinutes(10));

        service.expireOverdueOrders();

        assertEquals(PaymentStatus.PENDING, store.get(payment.getId()).getStatus());
        verify(gateway, never()).getPaymentLink(anyString());
    }
}
