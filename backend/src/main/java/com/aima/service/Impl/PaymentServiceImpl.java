package com.aima.service.Impl;

import com.aima.config.PaymentProperties;
import com.aima.dto.request.CheckoutRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BillingOverviewResponse;
import com.aima.dto.response.CheckoutQuoteResponse;
import com.aima.dto.response.CheckoutResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PaymentResponse;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.MockPaymentOutcome;
import com.aima.enums.NotificationType;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentMethod;
import com.aima.enums.PaymentStatus;
import com.aima.enums.PlanSource;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PaymentMapper;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.NotificationService;
import com.aima.service.PaymentGatewayClient;
import com.aima.service.PaymentService;
import com.aima.service.SubscriptionService;
import com.aima.service.SystemLogService;
import com.aima.util.CheckoutPricing;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Luồng mua gói.
 *
 * <p><b>Bố cục transaction</b> (rule #24/#28): mỗi lần chạm DB là một transaction NGẮN qua
 * {@code TransactionTemplate}; mọi lời gọi cổng nằm giữa các transaction, không bao giờ bên
 * trong. {@link #applyGatewayResult} cũng mở transaction riêng qua {@code TransactionTemplate}
 * — nó không gọi mạng nhưng cần giữ khoá dòng tới lúc commit; xem javadoc {@code applyLocked}
 * để biết vì sao KHÔNG dùng được {@code @Transactional} ở đó.</p>
 *
 * <p><b>Đơn treo là rủi ro nghiêm trọng nhất của luồng này.</b> Một đơn PENDING không có
 * {@code checkoutUrl} (lần tạo link không kết luận được) vừa chiếm chỗ PENDING duy nhất của
 * user — do partial unique {@code uk_payments_one_pending_per_user} — vừa không có link để trả
 * tiền: user bị khoá cứng khỏi việc mua hàng vì một sự cố mạng thoáng qua. Có HAI đường thoát,
 * cố ý làm trùng nhau: {@link #reconcileStuckOrders} chạy nền mỗi phút, và
 * {@link #checkout} tự chữa ngay trong request của user.</p>
 */
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PaymentServiceImpl implements PaymentService {

    /** Cổng thuộc luồng checkout — loại {@code MANUAL} (admin ghi tay / dev seeder) ra ngoài. */
    private static final Set<PaymentGateway> CHECKOUT_GATEWAYS =
            EnumSet.of(PaymentGateway.PAYOS, PaymentGateway.MOCK);

    private static final DateTimeFormatter INVOICE_MONTH = DateTimeFormatter.ofPattern("yyyyMM");

    /** 15 chữ số: [10^14, 10^15). Trần 10^15 < 2^53 nên payOS trả về dạng JSON number vẫn đúng. */
    private static final long ORDER_CODE_MIN = 100_000_000_000_000L;
    private static final long ORDER_CODE_BOUND = 900_000_000_000_000L;
    private static final int ORDER_CODE_ATTEMPTS = 5;

    /** Partial unique "tối đa 1 đơn chờ / user" — tạo ở {@code PaymentDataInitializer}. */
    static final String ONE_PENDING_CONSTRAINT = "uk_payments_one_pending_per_user";
    /** {@code ... constraint "ten_constraint"} trong message lỗi của PostgreSQL. */
    private static final Pattern QUOTED_CONSTRAINT = Pattern.compile("constraint \"([^\"]+)\"");

    /** Module của {@code system_logs} cho mọi việc cần ADMIN đối soát tay. */
    static final String LOG_MODULE = "payment";

    /** Trần số dòng một trang lịch sử đơn — chặn client tự đặt size khổng lồ. */
    static final int MAX_PAGE_SIZE = 50;

    static final String REASON_REPLACED = "REPLACED_BY_NEW_ORDER";
    static final String REASON_LINK_MISSING = "GATEWAY_LINK_MISSING";
    static final String REASON_URL_UNRECOVERABLE = "LINK_URL_UNRECOVERABLE";
    /** Vai trò nhận cảnh báo vận hành. */
    static final String ADMIN_ROLE = "ADMIN";

    static final String REASON_USER_CANCELLED = "USER_CANCELLED";
    static final String REASON_EXPIRED = "PAYMENT_WINDOW_EXPIRED";

    PaymentRepository paymentRepository;
    ActivityLogRepository activityLogRepository;
    PlanRepository planRepository;
    UserRepository userRepository;
    SubscriptionRepository subscriptionRepository;
    SubscriptionService subscriptionService;
    PaymentMapper paymentMapper;
    PaymentProperties paymentProperties;
    TransactionTemplate transactionTemplate;
    NotificationService notificationService;
    ActivityLogService activityLogService;
    SystemLogService systemLogService;
    Environment environment;
    SecureRandom secureRandom = new SecureRandom();

    /**
     * Lần cuối đã báo admin về webhook bị từ chối — chống một trận bão webhook biến thành một
     * trận bão thông báo. Để trong bộ nhớ là đủ: mất khi restart chỉ khiến admin nhận thừa một
     * thông báo, còn nhiều instance thì mỗi instance báo một lần — cả hai đều an toàn hơn là
     * bỏ sót cảnh báo.
     */
    AtomicReference<LocalDateTime> lastWebhookAlertAt = new AtomicReference<>();

    /** Công tắc production ĐỘC LẬP với Spring profile — chặn cứng cổng giả lập (như dev-seed). */
    @NonFinal
    @Value("${aima.production-mode:false}")
    boolean productionMode;

    Map<PaymentGateway, PaymentGatewayClient> gatewayClients;

    public PaymentServiceImpl(PaymentRepository paymentRepository,
                              ActivityLogRepository activityLogRepository,
                              PlanRepository planRepository,
                              UserRepository userRepository,
                              SubscriptionRepository subscriptionRepository,
                              SubscriptionService subscriptionService,
                              PaymentMapper paymentMapper,
                              PaymentProperties paymentProperties,
                              TransactionTemplate transactionTemplate,
                              NotificationService notificationService,
                              ActivityLogService activityLogService,
                              SystemLogService systemLogService,
                              Environment environment,
                              List<PaymentGatewayClient> clients) {
        this.paymentRepository = paymentRepository;
        this.activityLogRepository = activityLogRepository;
        this.planRepository = planRepository;
        this.userRepository = userRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionService = subscriptionService;
        this.paymentMapper = paymentMapper;
        this.paymentProperties = paymentProperties;
        this.transactionTemplate = transactionTemplate;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
        this.systemLogService = systemLogService;
        this.environment = environment;
        // Cùng mẫu Map<Platform, PlatformPublisher> của worker đăng bài: thêm cổng = thêm bean.
        this.gatewayClients = clients.stream()
                .collect(Collectors.toMap(PaymentGatewayClient::gateway, c -> c));
    }

    // ================================================================== checkout

    @Override
    public ApiResponse<CheckoutResponse> checkout(String email, CheckoutRequest request) {
        // Hai vòng: vòng 2 chỉ chạy khi insert đơn mới đụng partial unique (H2) — nghĩa là một
        // luồng song song vừa tạo đơn PENDING. Vòng sau sẽ thấy đơn đó và đi nhánh Q2.
        for (int attempt = 1; attempt <= 2; attempt++) {
            CheckoutContext ctx = inTransaction(() -> loadAndValidate(email, request));

            if (ctx.openOrderId() != null) {
                CheckoutResponse reused = resolveOpenOrder(ctx);
                if (reused != null) {
                    return ApiResponse.success("Tiếp tục đơn đang chờ thanh toán", reused);
                }
            }

            UUID paymentId;
            try {
                paymentId = inTransaction(() -> createPendingOrder(ctx));
            } catch (DataIntegrityViolationException e) {
                // CHỈ đúng ràng buộc một-đơn-PENDING mới là luồng song song (H2). Mọi ràng buộc
                // khác (vd CHECK constraint enum lệch — dính 2026-09-25 với gateway MOCK) thử lại
                // cũng hỏng y hệt, và nuốt nó thành Q2 là che mất lỗi thật.
                String constraint = violatedConstraint(e);
                if (!ONE_PENDING_CONSTRAINT.equalsIgnoreCase(constraint)) {
                    String detail = "Lưu đơn của user " + ctx.userId() + " vi phạm ràng buộc DB '"
                            + constraint + "' (không phải " + ONE_PENDING_CONSTRAINT + ") — không thử lại";
                    log.error("[Payment] {}: {}", detail, e.getMostSpecificCause().getMessage());
                    systemLogService.error(LOG_MODULE, detail, e);
                    throw new AppException(ErrorCode.PAYMENT_ORDER_SAVE_FAILED);
                }
                // H2: KHÔNG để lỗi DB lọt ra client. Vòng sau đọc lại đơn PENDING kia.
                log.info("[Payment] User {} đụng ràng buộc một-đơn-PENDING — thử lại theo luồng Q2",
                        ctx.userId());
                if (attempt == 2) {
                    throw new AppException(ErrorCode.PAYMENT_PENDING_EXISTS);
                }
                continue;
            }

            CheckoutResponse response = attachPaymentLink(paymentId, ctx);
            return ApiResponse.success("Đã tạo đơn thanh toán", response);
        }
        throw new AppException(ErrorCode.PAYMENT_PENDING_EXISTS);
    }

    /**
     * Tên ràng buộc DB bị vi phạm, hoặc {@code null} nếu không xác định được. Ưu tiên
     * {@link ConstraintViolationException#getConstraintName()} (Hibernate bóc từ trường
     * constraint của lỗi PostgreSQL); không có thì tìm {@code constraint "x"} trong message của
     * chuỗi cause. Không xác định được = coi là ràng buộc KHÁC — thà báo lỗi còn hơn đoán là Q2.
     */
    static String violatedConstraint(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof ConstraintViolationException cve && cve.getConstraintName() != null) {
                return cve.getConstraintName();
            }
        }
        for (Throwable t = e; t != null; t = t.getCause()) {
            Matcher m = t.getMessage() == null ? null : QUOTED_CONSTRAINT.matcher(t.getMessage());
            if (m != null && m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    /** tx1 — nạp user/gói, tính lại báo giá (Q1), tìm đơn checkout đang mở. */
    private CheckoutContext loadAndValidate(String email, CheckoutRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        Plan plan = requirePurchasable(request.getPlanId());
        PaymentMethod method = request.getPaymentMethod();
        if (method == null || !method.runsOn(activeGateway())) {
            throw new AppException(ErrorCode.PAYMENT_METHOD_NOT_SUPPORTED);
        }

        PricedOrder priced = price(user, plan, LocalDateTime.now());
        CheckoutPricing.Quote quote = priced.quote();
        if (!quote.purchasable()) {
            throw new AppException(quote.blockedBy());
        }
        // Không bao giờ thu một số tiền user chưa nhìn thấy trên trang xem lại.
        if (request.getExpectedAmount() == null || request.getExpectedAmount() != quote.total()) {
            throw new AppException(ErrorCode.PAYMENT_QUOTE_CHANGED);
        }

        UUID openOrderId = paymentRepository
                .findOpenOrder(user.getId(), PaymentStatus.PENDING, CHECKOUT_GATEWAYS)
                .map(Payment::getId)
                .orElse(null);
        return new CheckoutContext(user.getId(), plan.getId(), plan.getCode(), quote, method,
                priced.currentPlan() == null ? null : priced.currentPlan().getCode(),
                priced.currentExpiresAt(), openOrderId);
    }

    @Override
    public ApiResponse<CheckoutQuoteResponse> quote(String email, UUID planId) {
        CheckoutQuoteResponse result = inTransaction(() -> {
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            Plan plan = requirePurchasable(planId);
            LocalDateTime now = LocalDateTime.now();
            PricedOrder priced = price(user, plan, now);
            return paymentMapper.toQuoteResponse(plan, priced.currentPlan(), priced.currentExpiresAt(),
                    priced.quote(), enabledMethods(), now);
        });
        return ApiResponse.success("Lấy báo giá đơn hàng thành công", result);
    }

    /** Q4: bán MỌI gói đang bật và có giá — kể cả gói admin tự tạo. */
    private Plan requirePurchasable(UUID planId) {
        Plan plan = planRepository.findByIdAndDeletedAtIsNull(planId)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_PURCHASABLE));
        if (!Boolean.TRUE.equals(plan.getIsActive()) || plan.getPrice() == null || plan.getPrice() <= 0) {
            throw new AppException(ErrorCode.PLAN_NOT_PURCHASABLE);
        }
        return plan;
    }

    /**
     * Báo giá một đơn — nguồn DUY NHẤT của con số cho cả trang xem lại lẫn checkout. Đọc gói
     * hiện hành từ {@code subscriptions} rồi giao toàn bộ quy tắc cho {@link CheckoutPricing}.
     *
     * <p>"Giá gói cũ" của gói tự mua = {@code list_price} của lần mua gần nhất (user chốt 26/9);
     * đơn cũ chưa có cột này thì lùi về giá hiện tại của gói. Gói admin cấp không khấu trừ nên
     * giá hiện tại chỉ dùng cho lớp chặn "phải lên gói đắt hơn".</p>
     */
    private PricedOrder price(User user, Plan target, LocalDateTime now) {
        CheckoutPricing.Target wanted = new CheckoutPricing.Target(target.getCode(), target.getPrice(),
                cycleMonths(target));
        Subscription subscription = subscriptionRepository.findWithPlanByUserId(user.getId()).orElse(null);
        if (subscription == null) {
            return new PricedOrder(CheckoutPricing.quote(wanted, null, now, paymentProperties.minAmount()),
                    null, null);
        }

        Plan currentPlan = subscription.getPlan();
        boolean free = UserPlan.FREE.name().equals(currentPlan.getCode());
        long currentPrice = currentPlan.getPrice() == null ? 0L : currentPlan.getPrice();
        long listPrice = subscription.getPlanSource() == PlanSource.PAYMENT
                ? paymentRepository.findFirstByUser_IdAndPlan_IdAndStatusAndDeletedAtIsNullOrderByPaidAtDesc(
                        user.getId(), currentPlan.getId(), PaymentStatus.PAID)
                    .map(Payment::getListPrice)
                    .orElse(currentPrice)
                : currentPrice;
        LocalDateTime expiresAt = subscription.getPlanExpiresAt();
        CheckoutPricing.Current current = new CheckoutPricing.Current(currentPlan.getCode(), free,
                listPrice, cycleMonths(currentPlan), subscription.getPlanSource(), expiresAt);

        CheckoutPricing.Quote quote = CheckoutPricing.quote(wanted, current, now, paymentProperties.minAmount());
        boolean active = !free && (expiresAt == null || expiresAt.isAfter(now));
        return active
                ? new PricedOrder(quote, currentPlan, expiresAt)
                : new PricedOrder(quote, null, null);
    }

    /** Chu kỳ gói (tháng) — cùng quy tắc {@code SubscriptionServiceImpl.billingMonths}. */
    private static int cycleMonths(Plan plan) {
        Short months = plan.getBillingIntervalMonths();
        return months == null || months <= 0 ? 1 : months;
    }

    /** Phương thức đang bật = chạy được trên cổng đang cấu hình. */
    private List<PaymentMethod> enabledMethods() {
        PaymentGateway gateway = activeGateway();
        return Arrays.stream(PaymentMethod.values()).filter(m -> m.runsOn(gateway)).toList();
    }

    /**
     * Xử lý đơn checkout đang mở.
     *
     * @return response khi dùng lại được đơn cũ; {@code null} khi đơn cũ đã được đóng và caller
     *         nên tạo đơn mới
     */
    private CheckoutResponse resolveOpenOrder(CheckoutContext ctx) {
        OpenOrder open = inTransaction(() -> readOpenOrder(ctx.openOrderId()));
        if (open == null || open.status() != PaymentStatus.PENDING) {
            return null;
        }

        // ---- Đơn TREO: có bản ghi nhưng không có link để trả tiền ----
        if (open.checkoutUrl() == null || open.checkoutUrl().isBlank()) {
            return healStuckOrder(ctx, open);
        }

        // ---- Điểm E: chỉ trả lại link cũ khi cổng xác nhận link còn sống ----
        GatewayLinkStatus status = probeLinkStatus(open);
        if (status == null) {
            // Không hỏi được cổng — thà bắt user thử lại còn hơn đưa một link có thể đã chết.
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_TIMEOUT);
        }
        if (status != GatewayLinkStatus.PENDING && status != GatewayLinkStatus.PROCESSING) {
            applyGatewayResult(open.id(), status, null, null, null);
            return null;
        }

        if (sameOrder(open, ctx)) {
            // Q2 — cùng đơn: trả lại ĐÚNG link cũ, giữ nguyên expiresAt (không cộng lại TTL).
            return inTransaction(() -> toResponse(open.id(), true));
        }
        // Q2 — khác gói / số tiền / phương thức: huỷ đơn cũ rồi tạo đơn mới.
        closeLinkSafely(open.id(), REASON_REPLACED);
        return null;
    }

    /**
     * Đơn PENDING cũ có dùng lại được không. Không chỉ so gói: số tiền của đơn nâng cấp đổi theo
     * số ngày còn lại, nên link cũ mang số tiền cũ phải bị thay — nếu không user sẽ trả khác con
     * số vừa thấy trên trang xem lại.
     */
    private static boolean sameOrder(OpenOrder open, CheckoutContext ctx) {
        return open.planId().equals(ctx.planId())
                && open.amount() != null && open.amount() == ctx.quote().total()
                && open.paymentMethod() == ctx.paymentMethod();
    }

    /**
     * Tự chữa đơn treo NGAY trong request của user — chốt chặn thứ hai bên cạnh job đối soát.
     *
     * <p>Không có bước này, một lần {@code createPaymentLink} timeout sẽ khoá user khỏi việc
     * mua hàng cho tới khi job nền chạy tới.</p>
     */
    private CheckoutResponse healStuckOrder(CheckoutContext ctx, OpenOrder open) {
        GatewayOrderView view = probeLink(open);

        if (view.linkMissing()) {
            // Cổng khẳng định không có link này → link CHƯA TỪNG được tạo → đóng đơn, mua lại.
            log.info("[Payment] Đơn {} không có link bên cổng — đóng để user mua lại", open.id());
            inTransaction(() -> closeAsNeverCreated(open.id()));
            return null;
        }
        if (view.unreachable()) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_TIMEOUT);
        }

        GatewayLinkStatus status = view.order().status();
        if (status != GatewayLinkStatus.PENDING) {
            // PAID / EXPIRED / CANCELLED / FAILED / UNDERPAID / UNKNOWN — áp trạng thái thật.
            applyGatewayResult(open.id(), status, view.order().amountPaid(), null, null);
            OpenOrder after = inTransaction(() -> readOpenOrder(open.id()));
            if (after != null && after.status() == PaymentStatus.PAID) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PAID);
            }
            if (after != null && after.status() == PaymentStatus.PENDING) {
                // PROCESSING/UNDERPAID/UNKNOWN: tiền có thể đang chuyển — KHÔNG tạo đơn mới
                // song song để user khỏi trả hai lần.
                throw new AppException(ErrorCode.PAYMENT_PENDING_EXISTS);
            }
            return null;
        }

        // Link còn sống. Cứu được URL thì chữa tại chỗ; không thì huỷ link rồi tạo đơn mới —
        // đằng nào cũng phải giải phóng chỗ PENDING cho user.
        String recovered = view.order().checkoutUrl();
        if (recovered != null && !recovered.isBlank()) {
            inTransaction(() -> healCheckoutUrl(open.id(), recovered, view.order().linkId()));
            if (sameOrder(open, ctx)) {
                return inTransaction(() -> toResponse(open.id(), true));
            }
            closeLinkSafely(open.id(), REASON_REPLACED);
            return null;
        }
        log.info("[Payment] Đơn {} còn PENDING bên cổng nhưng không lấy lại được URL — huỷ để tạo đơn mới",
                open.id());
        closeLinkSafely(open.id(), REASON_URL_UNRECOVERABLE);
        return null;
    }

    /** tx2 — sinh orderCode + INSERT đơn PENDING. */
    private UUID createPendingOrder(CheckoutContext ctx) {
        User user = userRepository.findById(ctx.userId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        Plan plan = planRepository.findByIdAndDeletedAtIsNull(ctx.planId())
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_PURCHASABLE));

        LocalDateTime now = LocalDateTime.now();
        CheckoutPricing.Quote quote = ctx.quote();
        CheckoutPricing.Proration proration = quote.proration();
        Payment payment = Payment.builder()
                .user(user)
                .plan(plan)
                // Số tiền của BÁO GIÁ đã kiểm ở tx1 — không đọc lại plan.getPrice().
                .amount(quote.total())
                .currency("VND")
                .orderType(quote.orderType())
                .paymentMethod(ctx.paymentMethod())
                .listPrice(quote.subtotal())
                .prorationCredit(proration == null ? null : proration.credit())
                .prorationRemainingDays(proration == null ? null : proration.remainingDays())
                .prorationCycleDays(proration == null ? null : proration.cycleDays())
                .prorationRounding(proration == null ? null : proration.rounding())
                .fromPlanCode(ctx.fromPlanCode())
                .fromExpiresAt(ctx.fromExpiresAt())
                .status(PaymentStatus.PENDING)
                .gateway(activeGateway())
                .gatewayTxnId(nextOrderCode())
                .orderedAt(now)
                // Điểm E: mốc DUY NHẤT — tính MỘT lần ở đây rồi dùng lại cho cả đếm ngược phía
                // user lẫn expiredAt gửi cổng. Không nơi nào được tính lại.
                .expiresAt(now.plusMinutes(paymentProperties.pendingTtlMinutes()))
                .build();
        return paymentRepository.save(payment).getId();
    }

    /** Gọi cổng (NGOÀI transaction) rồi ghi link vào đơn. */
    private CheckoutResponse attachPaymentLink(UUID paymentId, CheckoutContext ctx) {
        Payment snapshot = inTransaction(() -> paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND)));

        PaymentGatewayClient.GatewayLink link;
        try {
            link = client().createPaymentLink(snapshot, describe(ctx));
        } catch (AppException e) {
            if (e.getErrorCode() == ErrorCode.PAYMENT_GATEWAY_TIMEOUT) {
                // KHÔNG set FAILED: link có thể đã tạo thành công bên cổng. Đơn giữ PENDING,
                // bật cờ đối soát — job sẽ kết luận, và lần checkout sau sẽ tự chữa.
                inTransaction(() -> flagReconcile(paymentId, "Tạo link không kết luận được"));
            } else {
                inTransaction(() -> closeOrder(paymentId, PaymentStatus.FAILED, e.getMessage()));
            }
            throw e;
        }
        return inTransaction(() -> {
            Payment payment = paymentRepository.findById(paymentId)
                    .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
            payment.setCheckoutUrl(link.checkoutUrl());
            payment.setGatewayLinkId(link.linkId());
            paymentRepository.save(payment);
            return paymentMapper.toCheckoutResponse(payment, false);
        });
    }

    // ================================================================== đọc phía user

    @Override
    public ApiResponse<BillingOverviewResponse> getBilling(String email) {
        BillingOverviewResponse result = inTransaction(() -> {
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            // getOrCreate cũng là nơi gói hết hạn được hạ về Free (không phụ thuộc cron), nên
            // trang Billing luôn hiển thị đúng gói THẬT ngay cả khi scheduler chưa chạy.
            Subscription subscription = subscriptionService.getOrCreate(user);
            if (subscription == null) {
                throw new AppException(ErrorCode.SUBSCRIPTION_NOT_FOUND);
            }
            PaymentResponse pending = paymentRepository
                    .findOpenOrder(user.getId(), PaymentStatus.PENDING, CHECKOUT_GATEWAYS)
                    .map(paymentMapper::toResponse)
                    .orElse(null);
            return paymentMapper.toBillingOverview(subscription, subscription.getPlan(), pending,
                    LocalDateTime.now());
        });
        return ApiResponse.success("Lấy thông tin gói dịch vụ thành công", result);
    }

    @Override
    public ApiResponse<PageResponse<PaymentResponse>> list(String email, PaymentStatus status,
                                                           LocalDate from, LocalDate to,
                                                           int page, int size) {
        PageResponse<PaymentResponse> result = inTransaction(() -> {
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            PageRequest pageable = PageRequest.of(Math.max(page, 0),
                    Math.clamp(size, 1, MAX_PAGE_SIZE),
                    Sort.by(Sort.Direction.DESC, "orderedAt"));
            // "to" là NGÀY, hiểu theo nghĩa BAO GỒM cả ngày đó → mốc trên exclusive là hôm sau.
            Page<Payment> payments = paymentRepository.searchByUser(user.getId(), status,
                    from == null ? null : from.atStartOfDay(),
                    to == null ? null : to.plusDays(1).atStartOfDay(),
                    pageable);
            return PageResponse.from(payments, paymentMapper.toResponseList(payments.getContent()));
        });
        return ApiResponse.success("Lấy lịch sử thanh toán thành công", result);
    }

    @Override
    public ApiResponse<PaymentResponse> get(String email, UUID paymentId) {
        PaymentResponse result = inTransaction(() -> paymentMapper.toResponse(requireOwned(email, paymentId)));
        return ApiResponse.success("Lấy chi tiết đơn hàng thành công", result);
    }

    // ================================================================== thao tác của user

    @Override
    public ApiResponse<PaymentResponse> cancel(String email, UUID paymentId) {
        inTransaction(() -> {
            Payment payment = requireOwned(email, paymentId);
            if (payment.getStatus() != PaymentStatus.PENDING) {
                throw new AppException(ErrorCode.PAYMENT_NOT_CANCELLABLE);
            }
            return null;
        });
        // closeLinkSafely gọi cổng nên phải nằm NGOÀI transaction (rule #24). Nó cũng là thứ
        // bảo vệ race "user bấm huỷ đúng lúc tiền về": cổng báo PAID thì đơn được KÍCH HOẠT.
        closeLinkSafely(paymentId, REASON_USER_CANCELLED);
        PaymentResponse result = inTransaction(() -> paymentMapper.toResponse(requireOwned(email, paymentId)));
        return ApiResponse.success("Đã xử lý yêu cầu huỷ đơn", result);
    }

    @Override
    public ApiResponse<PaymentResponse> verify(String email, UUID paymentId) {
        OpenOrder open = inTransaction(() -> {
            Payment payment = requireOwned(email, paymentId);
            return new OpenOrder(payment.getId(), payment.getStatus(), payment.getGatewayTxnId(),
                    payment.getCheckoutUrl(), payment.getPlan().getId(), payment.getAmount(),
                    payment.getPaymentMethod());
        });

        if (open.status() == PaymentStatus.PENDING) {
            GatewayOrderView view = probeLink(open);
            if (view.unreachable()) {
                throw new AppException(ErrorCode.PAYMENT_GATEWAY_TIMEOUT);
            }
            if (view.linkMissing()) {
                inTransaction(() -> closeAsNeverCreated(paymentId));
            } else {
                // CÙNG code path với webhook — không có nhánh "nhẹ tay" cho đường thủ công.
                applyGatewayResult(paymentId, view.order().status(), view.order().amountPaid(),
                        null, null);
            }
        }
        PaymentResponse result = inTransaction(() -> paymentMapper.toResponse(requireOwned(email, paymentId)));
        return ApiResponse.success("Đã đối soát đơn hàng với cổng thanh toán", result);
    }

    @Override
    public ApiResponse<PaymentResponse> applyMockOutcome(String email, UUID paymentId,
                                                         MockPaymentOutcome outcome) {
        MockGatewayClientImpl mock = requireMockGateway();

        OrderSnapshot snapshot = inTransaction(() -> {
            Payment payment = requireOwned(email, paymentId);
            if (payment.getStatus() == PaymentStatus.PAID) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PAID);
            }
            if (payment.getStatus() != PaymentStatus.PENDING) {
                throw new AppException(ErrorCode.PAYMENT_NOT_CANCELLABLE);
            }
            return new OrderSnapshot(payment.getGatewayTxnId(), payment.getAmount());
        });

        switch (outcome) {
            case SUCCESS -> {
                mock.markStatus(snapshot.orderCode(), GatewayLinkStatus.PAID);
                applyGatewayResult(paymentId, GatewayLinkStatus.PAID, snapshot.amount(),
                        mockPayload(snapshot, GatewayLinkStatus.PAID), null);
            }
            case FAILED -> {
                mock.markStatus(snapshot.orderCode(), GatewayLinkStatus.FAILED);
                applyGatewayResult(paymentId, GatewayLinkStatus.FAILED, null,
                        mockPayload(snapshot, GatewayLinkStatus.FAILED), "MOCK_GATEWAY_FAILED");
            }
            case TIMEOUT -> {
                mock.markStatus(snapshot.orderCode(), GatewayLinkStatus.EXPIRED);
                applyGatewayResult(paymentId, GatewayLinkStatus.EXPIRED, null,
                        mockPayload(snapshot, GatewayLinkStatus.EXPIRED), REASON_EXPIRED);
            }
        }
        PaymentResponse result = inTransaction(() -> paymentMapper.toResponse(requireOwned(email, paymentId)));
        return ApiResponse.success("Đã áp kết quả giả lập", result);
    }

    // ================================================================== webhook

    @Override
    public void handleWebhook(String rawBody) {
        try {
            // Điểm F — trần kích thước TRƯỚC khi parse: endpoint này public, không JWT.
            if (rawBody == null || rawBody.isBlank()) {
                rejectWebhook("EMPTY_BODY");
                return;
            }
            int bytes = rawBody.getBytes(StandardCharsets.UTF_8).length;
            if (bytes > paymentProperties.webhookMaxBodyBytes()) {
                rejectWebhook("BODY_TOO_LARGE");
                return;
            }

            PaymentGatewayClient.WebhookData data;
            try {
                data = client().verifyWebhook(rawBody);
            } catch (AppException e) {
                // Điểm F — KHÔNG nêu lý do ra ngoài và không log chữ ký/payload: đừng biến một
                // endpoint public thành công cụ dò chữ ký. Nguyên nhân cụ thể (kể cả trường hợp
                // khớp biến thể định dạng số) đã được adapter log ở mức ERROR.
                rejectWebhook(e.getErrorCode().name());
                return;
            }

            String orderCode = String.valueOf(data.orderCode());
            UUID paymentId = inTransaction(() -> paymentRepository
                    .findByGatewayTxnIdAndDeletedAtIsNull(orderCode)
                    .map(Payment::getId)
                    .orElse(null));
            if (paymentId == null) {
                // BẮT BUỘC im lặng + 200: payOS gửi một giao dịch MẪU (orderCode = 123) lúc gọi
                // /confirm-webhook. Trả lỗi ở đây = ĐĂNG KÝ WEBHOOK THẤT BẠI.
                log.info("[Payment] Webhook cho orderCode {} không khớp đơn nào — bỏ qua", orderCode);
                return;
            }

            // Lưu payload thô NGAY, trước cả khi hỏi cổng: bước sau có vỡ thì vẫn còn bằng chứng.
            inTransaction(() -> storeRawPayload(paymentId, rawBody));

            OpenOrder open = inTransaction(() -> readOpenOrder(paymentId));
            if (open == null || open.status() == PaymentStatus.PAID) {
                log.info("[Payment] Webhook lặp cho đơn {} đã PAID — bỏ qua (idempotent)", paymentId);
                return;
            }

            // code = "00" chỉ nghĩa là MỘT lệnh chuyển tiền thành công, KHÔNG phải đơn đã đủ
            // tiền (bẫy UNDERPAID). Trạng thái THẬT của link chỉ cổng mới biết → phải hỏi.
            GatewayOrderView view = probeLink(open);
            if (view.unreachable() || view.linkMissing()) {
                inTransaction(() -> flagReconcile(paymentId,
                        "Có webhook nhưng không xác nhận được trạng thái link"));
                systemLogService.error(LOG_MODULE, "Đơn " + paymentId
                        + " nhận webhook mà không xác nhận được trạng thái link — cần đối soát tay", null);
                return;
            }

            GatewayLinkStatus status = view.order().status();
            // Khi cổng xác nhận PAID thì so bằng số tiền của CHÍNH webhook (đã ký), không lấy số
            // cổng tự thuật lại — đó mới là giá trị ta xác thực được.
            Long amountPaid = status == GatewayLinkStatus.PAID
                    ? data.amount()
                    : view.order().amountPaid();
            applyGatewayResult(paymentId, status, amountPaid, rawBody, data.desc());
        } catch (Exception e) {
            // payOS RETRY mọi response khác 200 → tuyệt đối không để lỗi nội bộ thoát ra ngoài.
            log.error("[Payment] Xử lý webhook lỗi: {}", e.getMessage(), e);
            systemLogService.error(LOG_MODULE, "Xử lý webhook payOS lỗi", e);
        }
    }

    /**
     * Ghi vết một request webhook bị TỪ CHỐI. Rate-limit theo IP tái dùng nguyên cơ chế sẵn có
     * của {@code ActivityLogWriterImpl} (trần dòng/IP/giờ cho nhóm {@code DEDUP_EXEMPT}) —
     * không dựng bucket Redis mới (điểm F §5).
     */
    private void rejectWebhook(String reason) {
        log.warn("[Payment] Webhook bị từ chối");
        // Đếm TRƯỚC khi ghi: activity log ghi bất đồng bộ nên dòng của lần này chưa có trong DB.
        long previous = countRecentRejections(reason);
        activityLogService.record(new ActivityLogService.Entry(
                ActivityAction.PAYMENT_WEBHOOK_REJECTED, null, null,
                "WEBHOOK", null, ActivityResult.FAILURE, Map.of("reason", reason)));
        maybeAlertAdmins(reason, previous + 1);
    }

    /**
     * Số webhook bị từ chối trong cửa sổ cảnh báo. Trả 0 khi không đếm được — lỗi của bộ đếm
     * không được phép làm hỏng đường xử lý webhook.
     */
    private long countRecentRejections(String reason) {
        if (!isSignatureRejection(reason)) {
            return 0;
        }
        try {
            return inTransaction(() -> activityLogRepository.countByActionSince(
                    ActivityAction.PAYMENT_WEBHOOK_REJECTED.name(),
                    LocalDateTime.now().minusMinutes(paymentProperties.webhookAlertWindowMinutes())));
        } catch (Exception e) {
            log.warn("[Payment] Không đếm được webhook bị từ chối: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Báo admin khi webhook bị từ chối bất thường — <b>lưới an toàn cho điểm mù chết người</b>:
     * nếu quy ước chữ ký của ta lệch thì 100% webhook fail, khách trả tiền xong không được kích
     * hoạt gói, và không đơn nào mang {@code reconcile_required} để ai đó nhìn ra.
     *
     * <p>Hai mức nhạy khác nhau, có chủ đích:</p>
     * <ul>
     *   <li>{@code PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH} — chữ ký khớp với biến thể định
     *       dạng số CÒN LẠI, nghĩa là payload thật và người gửi biết {@code checksumKey}. Đây
     *       gần như chắc chắn là lỗi cấu hình của TA → báo <b>ngay từ lần đầu</b>.</li>
     *   <li>Chữ ký sai thường — có thể chỉ là ai đó dò endpoint public → chỉ báo khi vượt
     *       ngưỡng trong cửa sổ, tránh biến mỗi request rác thành một thông báo.</li>
     * </ul>
     *
     * <p>Cảnh báo là best-effort tuyệt đối: mọi lỗi ở đây chỉ log, không bao giờ nổi lên làm
     * webhook trả khác 200.</p>
     */
    private void maybeAlertAdmins(String reason, long recentCount) {
        if (!isSignatureRejection(reason)) {
            return;
        }
        boolean immediate = ErrorCode.PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH.name().equals(reason);
        if (!immediate && recentCount < paymentProperties.webhookAlertThreshold()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime last = lastWebhookAlertAt.get();
        // Biến thể format số bỏ qua throttle: đúng một loại sự cố này thì thà báo thừa.
        if (!immediate && last != null
                && last.isAfter(now.minusMinutes(paymentProperties.webhookAlertWindowMinutes()))) {
            return;
        }
        if (!lastWebhookAlertAt.compareAndSet(last, now)) {
            return;
        }

        String message = immediate
                ? "Webhook payOS bị từ chối vì chữ ký khớp BIẾN THỂ ĐỊNH DẠNG SỐ khác. Gần như chắc"
                + " chắn là cấu hình của hệ thống sai, không phải tấn công — xem"
                + " PayOSSignature.ACTIVE_STYLE và mục scale trong docs/PAYMENT.md."
                : "Webhook payOS đang bị từ chối hàng loạt (" + recentCount + " lần trong "
                + paymentProperties.webhookAlertWindowMinutes() + " phút). Kiểm tra PAYOS_CHECKSUM_KEY"
                + " và quy ước định dạng số của chữ ký — khách có thể đã trả tiền mà gói không được"
                + " kích hoạt.";
        log.error("[Payment] {}", message);
        try {
            systemLogService.error(LOG_MODULE, message, null);
            List<User> admins = inTransaction(() ->
                    userRepository.findActiveByRoleName(ADMIN_ROLE, UserStatus.ACTIVE));
            for (User admin : admins) {
                notificationService.notify(admin, NotificationType.PAYMENT_WEBHOOK_ALERT,
                        "Webhook thanh toán đang bị từ chối", message, null);
            }
        } catch (Exception e) {
            log.warn("[Payment] Không gửi được cảnh báo webhook cho admin: {}", e.getMessage());
        }
    }

    /** Chỉ hai lý do dưới liên quan tới chữ ký; body rác/quá cỡ không phải tín hiệu cấu hình sai. */
    private static boolean isSignatureRejection(String reason) {
        return ErrorCode.PAYMENT_SIGNATURE_INVALID.name().equals(reason)
                || ErrorCode.PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH.name().equals(reason);
    }

    // ================================================================== đơn hết hạn (điểm B)

    @Override
    public int expireOverdueOrders() {
        List<UUID> ids = inTransaction(() -> paymentRepository.findExpiredPendingIds(
                PaymentStatus.PENDING, CHECKOUT_GATEWAYS, LocalDateTime.now()));
        int closed = 0;
        for (UUID id : ids) {
            try {
                if (expireOne(id)) {
                    closed++;
                }
            } catch (Exception e) {
                // Resilient (rule #27): một đơn hỏng không được làm chết cả vòng quét.
                log.warn("[Payment] Đóng đơn hết hạn {} lỗi: {}", id, e.getMessage());
            }
        }
        if (!ids.isEmpty()) {
            log.info("[Payment] {} đơn quá hạn — đã chốt {}", ids.size(), closed);
        }
        return closed;
    }

    private boolean expireOne(UUID paymentId) {
        OpenOrder open = inTransaction(() -> readOpenOrder(paymentId));
        if (open == null || open.status() != PaymentStatus.PENDING) {
            return false;
        }
        // Hỏi cổng TRƯỚC khi đóng: đơn đã trả tiền mà webhook không tới được cứu ở đây.
        GatewayOrderView view = probeLink(open);
        if (view.linkMissing()) {
            inTransaction(() -> closeAsNeverCreated(paymentId));
            return true;
        }
        if (view.unreachable()) {
            return inTransaction(() -> bumpGrace(paymentId));
        }

        GatewayLinkStatus status = view.order().status();
        switch (status) {
            case PAID -> applyGatewayResult(paymentId, status, view.order().amountPaid(), null, null);
            case PROCESSING -> {
                // Điểm B: tiền đang chuyển dở — TUYỆT ĐỐI không huỷ, nếu không tiền sẽ về sau
                // khi đơn đã đóng và thành một ca đối soát tay.
                inTransaction(() -> grantGrace(paymentId));
                return false;
            }
            // Cổng vẫn coi link còn sống nhưng hạn của ta đã hết → chủ động huỷ rồi đóng EXPIRED.
            case PENDING -> closeLinkSafely(paymentId, REASON_EXPIRED, GatewayLinkStatus.EXPIRED);
            default -> applyGatewayResult(paymentId, status, view.order().amountPaid(), null, REASON_EXPIRED);
        }
        return true;
    }

    /**
     * Gia hạn một vòng ân hạn cho đơn cổng báo {@code PROCESSING}. Vượt trần thì bật cờ đối
     * soát + báo admin nhưng <b>vẫn giữ PENDING</b> — đóng một đơn đang chuyển tiền là cách
     * chắc chắn nhất để mất tiền của khách.
     */
    private Void grantGrace(UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        int rounds = (payment.getExpiryGraceCount() == null ? 0 : payment.getExpiryGraceCount()) + 1;
        payment.setExpiryGraceCount(rounds);

        if (rounds > paymentProperties.maxGraceRounds()) {
            payment.setReconcileRequired(true);
            log.error("[Payment] Đơn {} đã {} vòng ở trạng thái PROCESSING — CẦN ADMIN đối soát",
                    paymentId, rounds);
            systemLogService.error(LOG_MODULE, "Đơn " + paymentId + " kẹt ở PROCESSING sau "
                    + rounds + " vòng ân hạn — cần đối soát tay", null);
        } else {
            payment.setExpiresAt(payment.getExpiresAt().plusMinutes(paymentProperties.graceMinutes()));
            log.info("[Payment] Đơn {} đang PROCESSING — gia hạn vòng {}/{}",
                    paymentId, rounds, paymentProperties.maxGraceRounds());
        }
        paymentRepository.save(payment);
        return null;
    }

    // ================================================================== áp kết quả cổng

    @Override
    public void applyGatewayResult(UUID paymentId, GatewayLinkStatus status, Long amountPaid,
                                   String rawPayload, String failedReason) {
        inTransaction(() -> {
            applyLocked(paymentId, status, amountPaid, rawPayload, failedReason);
            return null;
        });
    }

    /**
     * Thân thật của {@link #applyGatewayResult}, luôn chạy TRONG một transaction.
     *
     * <p><b>Vì sao mở transaction bằng {@code TransactionTemplate} chứ không phải
     * {@code @Transactional}</b>: mọi call site của {@code applyGatewayResult} đều nằm TRONG
     * chính bean này (checkout, verify, huỷ, cổng giả lập, hai job đối soát/hết hạn). Lời gọi
     * nội bộ không đi qua proxy Spring, nên annotation sẽ KHÔNG có tác dụng — khoá
     * {@code SELECT ... FOR UPDATE} được nhả ngay sau câu select và phần ghi trạng thái rơi
     * sang một transaction khác. Tính idempotent của cả luồng thanh toán dựa vào khoá đó, nên
     * nó phải được mở tường minh. {@code TransactionTemplate} dùng propagation REQUIRED nên
     * caller bên ngoài (đã có transaction) vẫn join bình thường.</p>
     */
    private void applyLocked(UUID paymentId, GatewayLinkStatus status, Long amountPaid,
                             String rawPayload, String failedReason) {
        // Khoá dòng TRƯỚC khi đọc trạng thái: webhook, job đối soát và nút "kiểm tra lại" của
        // user có thể ập tới cùng lúc. Kiểm tra ngoài khoá rồi mới mở transaction là sai.
        Payment payment = paymentRepository.findByIdForUpdate(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));

        if (rawPayload != null) {
            payment.setRawPayload(rawPayload);
        }
        if (payment.getStatus() == PaymentStatus.PAID) {
            log.info("[Payment] Đơn {} đã PAID từ trước — bỏ qua (idempotent)", paymentId);
            paymentRepository.save(payment);
            return;
        }

        boolean alreadyClosed = payment.getStatus() == PaymentStatus.EXPIRED
                || payment.getStatus() == PaymentStatus.CANCELLED
                || payment.getStatus() == PaymentStatus.FAILED;
        LocalDateTime now = LocalDateTime.now();

        switch (status) {
            case PAID -> {
                boolean amountMatches = amountPaid != null
                        && amountPaid.longValue() == payment.getAmount().longValue();
                payment.setStatus(PaymentStatus.PAID);
                payment.setPaidAt(now);
                payment.setInvoiceNo(buildInvoiceNo(payment, now));

                if (!amountMatches) {
                    // Bẫy UNDERPAID/overpaid: webhook vẫn báo code="00". Ghi nhận tiền nhưng
                    // KHÔNG kích hoạt gói — để admin đối soát.
                    payment.setReconcileRequired(true);
                    log.error("[Payment] Đơn {} tiền lệch: cổng {} vs đơn {} — KHÔNG kích hoạt gói",
                            paymentId, amountPaid, payment.getAmount());
                } else if (alreadyClosed) {
                    payment.setReconcileRequired(true);
                    log.error("[Payment] Đơn {} đã đóng nhưng tiền vẫn về — KHÔNG tự kích hoạt gói, cần admin",
                            paymentId);
                } else {
                    activate(payment, now);
                }
            }
            case UNDERPAID -> {
                payment.setReconcileRequired(true);
                log.error("[Payment] Đơn {} khách chuyển thiếu — giữ PENDING, cần đối soát", paymentId);
            }
            case PENDING, PROCESSING -> log.debug("[Payment] Đơn {} còn {} bên cổng", paymentId, status);
            case CANCELLED -> closeIfOpen(payment, PaymentStatus.CANCELLED, failedReason);
            case EXPIRED -> closeIfOpen(payment, PaymentStatus.EXPIRED, failedReason);
            case FAILED -> closeIfOpen(payment, PaymentStatus.FAILED, failedReason);
            case UNKNOWN -> {
                payment.setReconcileRequired(true);
                log.error("[Payment] Đơn {} có trạng thái cổng không nhận ra — giữ nguyên, cần đối soát",
                        paymentId);
            }
        }
        paymentRepository.save(payment);
    }

    private void activate(Payment payment, LocalDateTime now) {
        Subscription subscription =
                subscriptionService.activatePaidPlan(payment.getUser(), payment.getPlan(), now);
        if (subscription == null) {
            payment.setReconcileRequired(true);
            log.error("[Payment] Đơn {} đã thu tiền nhưng KHÔNG kích hoạt được gói — cần admin",
                    payment.getId());
            systemLogService.error(LOG_MODULE, "Đơn " + payment.getId()
                    + " đã thu tiền nhưng không kích hoạt được gói — cần xử lý tay", null);
            return;
        }
        payment.setPeriodStart(subscription.getPlanStartedAt());
        payment.setPeriodEnd(subscription.getPlanExpiresAt());
        log.info("[Payment] Đơn {} PAID — đã kích hoạt gói {} tới {}",
                payment.getId(), payment.getPlan().getCode(), subscription.getPlanExpiresAt());
        announcePaid(payment, subscription);
    }

    /**
     * Báo cho user + để lại vết audit sau khi gói đã được kích hoạt. Nằm TRONG
     * {@link #activate} nên mọi đường tới PAID (webhook, verify thủ công, job đối soát, job hết
     * hạn, cổng giả lập) đều phát đúng một lần — không có đường nào quên.
     *
     * <p>Cả hai đều best-effort: {@code notify} tự nuốt lỗi, {@code record} chạy async. Thu
     * tiền đã thành công thì không được rollback chỉ vì gửi thông báo hỏng.</p>
     */
    private void announcePaid(Payment payment, Subscription subscription) {
        User user = payment.getUser();
        notificationService.notify(user, NotificationType.PAYMENT_SUCCEEDED,
                "Thanh toán thành công",
                "Gói " + payment.getPlan().getCode() + " đã được kích hoạt"
                        + (subscription.getPlanExpiresAt() == null
                        ? "." : " tới " + subscription.getPlanExpiresAt().toLocalDate() + "."),
                payment.getId());
        activityLogService.record(new ActivityLogService.Entry(
                ActivityAction.PAYMENT_SUCCEEDED, user.getId(), user.getEmail(),
                "PAYMENT", payment.getId().toString(), ActivityResult.SUCCESS,
                Map.of("plan", payment.getPlan().getCode(),
                        "amount", payment.getAmount(),
                        "invoiceNo", payment.getInvoiceNo() == null ? "" : payment.getInvoiceNo())));
    }

    private void closeIfOpen(Payment payment, PaymentStatus target, String reason) {
        if (payment.getStatus() != PaymentStatus.PENDING) {
            return;
        }
        payment.setStatus(target);
        if (reason != null) {
            payment.setFailedReason(reason);
        }
        payment.setReconcileRequired(false);

        // CHỈ ghi audit cho FAILED. EXPIRED/CANCELLED là khách bỏ giỏ hàng — ghi cả hai vào
        // log nghiệp vụ chỉ làm phình bảng mà không nói lên điều gì (xem javadoc ActivityAction).
        if (target == PaymentStatus.FAILED) {
            User user = payment.getUser();
            activityLogService.record(new ActivityLogService.Entry(
                    ActivityAction.PAYMENT_FAILED, user.getId(), user.getEmail(),
                    "PAYMENT", payment.getId().toString(), ActivityResult.FAILURE,
                    Map.of("plan", payment.getPlan().getCode(),
                            "reason", reason == null ? "" : reason)));
        }
    }

    // ================================================================== đóng link an toàn

    @Override
    public void closeLinkSafely(UUID paymentId, String reason) {
        closeLinkSafely(paymentId, reason, GatewayLinkStatus.CANCELLED);
    }

    /**
     * Như {@link #closeLinkSafely(UUID, String)} nhưng chọn được trạng thái đóng.
     *
     * <p>Job hết hạn phải đóng thành {@code EXPIRED} chứ không phải {@code CANCELLED}: khách
     * hết giờ không trả tiền là chuyện khác với khách/hệ thống chủ động huỷ, và hai trạng thái
     * này được đọc riêng trên báo cáo doanh thu.</p>
     */
    private void closeLinkSafely(UUID paymentId, String reason, GatewayLinkStatus closeAs) {
        OpenOrder open = inTransaction(() -> readOpenOrder(paymentId));
        if (open == null || open.status() != PaymentStatus.PENDING) {
            return;
        }
        try {
            client().cancelPaymentLink(open.orderCode(), reason);
            applyGatewayResult(paymentId, closeAs, null, null, reason);
            return;
        } catch (AppException e) {
            if (e.getErrorCode() == ErrorCode.PAYMENT_GATEWAY_LINK_NOT_FOUND) {
                applyGatewayResult(paymentId, closeAs, null, null, reason);
                return;
            }
            log.warn("[Payment] Huỷ link đơn {} thất bại — phải tra lại trạng thái thật", paymentId);
        }

        // Điểm C: huỷ lỗi thì BẮT BUỘC xác nhận lại. Tuyệt đối không đóng đơn khi chưa biết
        // link có PAID hay không — race huỷ/PAID là chỗ mất tiền của khách.
        GatewayOrderView view = probeLink(open);
        if (view.linkMissing()) {
            applyGatewayResult(paymentId, closeAs, null, null, reason);
            return;
        }
        if (view.unreachable()) {
            inTransaction(() -> flagReconcile(paymentId, "Không xác nhận được trạng thái link khi huỷ"));
            return;
        }
        applyGatewayResult(paymentId, view.order().status(), view.order().amountPaid(), null, reason);
    }

    // ================================================================== đối soát đơn treo

    @Override
    public int reconcileStuckOrders() {
        List<UUID> ids = inTransaction(() ->
                paymentRepository.findStuckPendingIds(PaymentStatus.PENDING, CHECKOUT_GATEWAYS));
        int resolved = 0;
        for (UUID id : ids) {
            try {
                if (reconcileOne(id)) {
                    resolved++;
                }
            } catch (Exception e) {
                // Resilient (rule #27): một đơn hỏng không được làm chết cả vòng quét.
                log.warn("[Payment] Đối soát đơn {} lỗi: {}", id, e.getMessage());
            }
        }
        if (!ids.isEmpty()) {
            log.info("[Payment] Đối soát {} đơn treo — xử lý xong {}", ids.size(), resolved);
        }
        return resolved;
    }

    private boolean reconcileOne(UUID paymentId) {
        OpenOrder open = inTransaction(() -> readOpenOrder(paymentId));
        if (open == null || open.status() != PaymentStatus.PENDING) {
            return false;
        }
        GatewayOrderView view = probeLink(open);

        if (view.linkMissing()) {
            inTransaction(() -> closeAsNeverCreated(paymentId));
            return true;
        }
        if (view.unreachable()) {
            return inTransaction(() -> bumpGrace(paymentId));
        }

        GatewayLinkStatus status = view.order().status();
        String recovered = view.order().checkoutUrl();
        if (status == GatewayLinkStatus.PENDING) {
            if (open.checkoutUrl() != null && !open.checkoutUrl().isBlank()) {
                inTransaction(() -> clearReconcile(paymentId));
                return true;
            }
            if (recovered != null && !recovered.isBlank()) {
                inTransaction(() -> healCheckoutUrl(paymentId, recovered, view.order().linkId()));
                return true;
            }
            // Đơn PENDING không có URL = user bị khoá khỏi việc mua. Huỷ để giải phóng.
            closeLinkSafely(paymentId, REASON_URL_UNRECOVERABLE);
            return true;
        }
        applyGatewayResult(paymentId, status, view.order().amountPaid(), null, null);
        return true;
    }

    // ================================================================== thao tác DB nhỏ

    private OpenOrder readOpenOrder(UUID paymentId) {
        return paymentRepository.findById(paymentId)
                .map(p -> new OpenOrder(p.getId(), p.getStatus(), p.getGatewayTxnId(),
                        p.getCheckoutUrl(), p.getPlan().getId(), p.getAmount(), p.getPaymentMethod()))
                .orElse(null);
    }

    private CheckoutResponse toResponse(UUID paymentId, boolean reused) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        return paymentMapper.toCheckoutResponse(payment, reused);
    }

    private Void healCheckoutUrl(UUID paymentId, String checkoutUrl, String linkId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        payment.setCheckoutUrl(checkoutUrl);
        if (linkId != null) {
            payment.setGatewayLinkId(linkId);
        }
        payment.setReconcileRequired(false);
        payment.setExpiryGraceCount(0);
        paymentRepository.save(payment);
        log.info("[Payment] Đơn {} đã lấy lại được checkoutUrl từ cổng", paymentId);
        return null;
    }

    /** Cổng khẳng định link chưa từng tồn tại → đóng đơn để giải phóng chỗ PENDING của user. */
    private Void closeAsNeverCreated(UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        if (payment.getStatus() != PaymentStatus.PENDING) {
            return null;
        }
        // CANCELLED chứ không phải FAILED: link chưa từng tạo thì cổng chưa hề hỏng giao dịch
        // nào — nhét vào FAILED sẽ thổi phồng "tỉ lệ giao dịch thất bại" của cổng.
        payment.setStatus(PaymentStatus.CANCELLED);
        payment.setFailedReason(REASON_LINK_MISSING);
        payment.setReconcileRequired(false);
        paymentRepository.save(payment);
        return null;
    }

    /** Lưu payload webhook mà KHÔNG đụng trạng thái — chạy trước mọi bước có thể vỡ. */
    private Void storeRawPayload(UUID paymentId, String rawPayload) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        payment.setRawPayload(rawPayload);
        paymentRepository.save(payment);
        return null;
    }

    private Void flagReconcile(UUID paymentId, String reason) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        payment.setReconcileRequired(true);
        payment.setFailedReason(reason);
        paymentRepository.save(payment);
        return null;
    }

    private Void clearReconcile(UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        payment.setReconcileRequired(false);
        payment.setExpiryGraceCount(0);
        paymentRepository.save(payment);
        return null;
    }

    /** Không hỏi được cổng: đếm số vòng đã thử, quá trần thì kêu admin (tái dùng expiryGraceCount). */
    private boolean bumpGrace(UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        int rounds = payment.getExpiryGraceCount() == null ? 0 : payment.getExpiryGraceCount();
        payment.setExpiryGraceCount(rounds + 1);
        payment.setReconcileRequired(true);
        paymentRepository.save(payment);

        if (rounds + 1 > paymentProperties.maxGraceRounds()) {
            log.error("[Payment] Đơn {} đã {} vòng không hỏi được cổng — CẦN ADMIN xử lý tay",
                    paymentId, rounds + 1);
        }
        return false;
    }

    private Void closeOrder(UUID paymentId, PaymentStatus status, String reason) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        if (payment.getStatus() == PaymentStatus.PENDING) {
            payment.setStatus(status);
            payment.setFailedReason(reason);
            paymentRepository.save(payment);
        }
        return null;
    }

    // ================================================================== tiện ích

    /**
     * Nạp đơn + kiểm quyền sở hữu (API-03/SEC-04). Phân biệt rõ 404 với 403: đơn không tồn tại
     * và đơn của người khác là hai chuyện khác nhau đối với người dùng thật.
     */
    private Payment requireOwned(String email, UUID paymentId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        Payment payment = paymentRepository.findDetailById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        if (!payment.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.PAYMENT_ACCESS_DENIED);
        }
        return payment;
    }

    /**
     * Ba lớp khoá cho cổng giả lập, cùng mẫu dev-seed doanh thu: cổng đang bật phải là MOCK +
     * {@code AIMA_PRODUCTION_MODE} tắt + không chạy profile prod.
     */
    private MockGatewayClientImpl requireMockGateway() {
        PaymentGatewayClient gateway = gatewayClients.get(PaymentGateway.MOCK);
        if (activeGateway() != PaymentGateway.MOCK || productionMode || isProductionProfile()
                || !(gateway instanceof MockGatewayClientImpl mock)) {
            throw new AppException(ErrorCode.PAYMENT_MOCK_DISABLED);
        }
        return mock;
    }

    private boolean isProductionProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Payload giả lập lưu vào {@code raw_payload}. Giữ đúng hình dạng webhook thật (bọc trong
     * {@code data}) để trang đối soát của admin đọc được cùng một cấu trúc ở cả hai môi trường.
     */
    private static String mockPayload(OrderSnapshot snapshot, GatewayLinkStatus status) {
        return "{\"mock\":true,\"data\":{\"orderCode\":" + snapshot.orderCode()
                + ",\"amount\":" + snapshot.amount()
                + ",\"status\":\"" + status.name() + "\"}}";
    }

    private PaymentGateway activeGateway() {
        PaymentGateway gateway = paymentProperties.gateway();
        return gateway == null ? PaymentGateway.MOCK : gateway;
    }

    private PaymentGatewayClient client() {
        PaymentGatewayClient client = gatewayClients.get(activeGateway());
        if (client == null) {
            log.error("[Payment] Không có adapter cho cổng {}", activeGateway());
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_NOT_CONFIGURED);
        }
        return client;
    }

    /** Hỏi cổng, quy về ba kết cục rõ ràng để caller không phải bắt exception lung tung. */
    private GatewayOrderView probeLink(OpenOrder open) {
        try {
            return new GatewayOrderView(client().getPaymentLink(open.orderCode()), false, false);
        } catch (AppException e) {
            if (e.getErrorCode() == ErrorCode.PAYMENT_GATEWAY_LINK_NOT_FOUND) {
                return new GatewayOrderView(null, true, false);
            }
            log.warn("[Payment] Không tra được link đơn {}: {}", open.id(), e.getMessage());
            return new GatewayOrderView(null, false, true);
        }
    }

    private GatewayLinkStatus probeLinkStatus(OpenOrder open) {
        GatewayOrderView view = probeLink(open);
        if (view.linkMissing()) {
            return GatewayLinkStatus.CANCELLED;
        }
        return view.unreachable() ? null : view.order().status();
    }

    /**
     * Mô tả đơn gửi cổng. payOS giới hạn rất ngắn (mặc định 9 ký tự) nên đây chỉ là mã gói —
     * client sẽ tự cắt lần nữa trước khi ký.
     */
    private String describe(CheckoutContext ctx) {
        return ctx.planCode();
    }

    /**
     * {@code INV-yyyyMM-######} — 6 chữ số cuối của {@code orderCode}. Không cần bảng/sequence
     * riêng: {@code orderCode} vốn đã unique nên trùng số hoá đơn là cực hiếm, và
     * {@code invoiceNo} chỉ để hiển thị/đối chiếu chứ không phải khoá.
     */
    private static String buildInvoiceNo(Payment payment, LocalDateTime now) {
        if (payment.getInvoiceNo() != null) {
            return payment.getInvoiceNo();
        }
        String txn = payment.getGatewayTxnId() == null ? "000000" : payment.getGatewayTxnId();
        String tail = txn.length() <= 6 ? String.format("%06d", Long.parseLong(txn))
                : txn.substring(txn.length() - 6);
        return "INV-" + INVOICE_MONTH.format(now) + "-" + tail;
    }

    /**
     * 15 chữ số ngẫu nhiên. Không dùng số tăng dần để không lộ thứ tự/khối lượng đơn hàng.
     * Trùng thì thử lại; chốt chặn cuối là partial unique {@code uk_payments_gateway_txn}.
     */
    private String nextOrderCode() {
        for (int i = 0; i < ORDER_CODE_ATTEMPTS; i++) {
            String candidate = String.valueOf(
                    ORDER_CODE_MIN + (long) (secureRandom.nextDouble() * ORDER_CODE_BOUND));
            if (!paymentRepository.existsByGatewayTxnIdAndDeletedAtIsNull(candidate)) {
                return candidate;
            }
        }
        throw new AppException(ErrorCode.PAYMENT_ORDER_CODE_UNAVAILABLE);
    }

    private <T> T inTransaction(Supplier<T> work) {
        return transactionTemplate.execute(status -> work.get());
    }

    // ================================================================== kiểu nội bộ

    private record CheckoutContext(UUID userId, UUID planId, String planCode, CheckoutPricing.Quote quote,
                                   PaymentMethod paymentMethod, String fromPlanCode,
                                   LocalDateTime fromExpiresAt, UUID openOrderId) {
    }

    /** Báo giá + gói đang dùng (null khi Free/hết hạn) để hiển thị trên trang xem lại. */
    private record PricedOrder(CheckoutPricing.Quote quote, Plan currentPlan, LocalDateTime currentExpiresAt) {
    }

    /** Ảnh chụp đơn để dùng NGOÀI transaction — không mang entity đã detach đi lang thang. */
    private record OpenOrder(UUID id, PaymentStatus status, String orderCode, String checkoutUrl,
                             UUID planId, Long amount, PaymentMethod paymentMethod) {
    }

    /** Chỉ hai giá trị cần mang ra NGOÀI transaction cho luồng cổng giả lập. */
    private record OrderSnapshot(String orderCode, Long amount) {
    }

    /** Ba kết cục của một lần hỏi cổng: có dữ liệu · link không tồn tại · không hỏi được. */
    private record GatewayOrderView(PaymentGatewayClient.GatewayOrder order, boolean linkMissing,
                                    boolean unreachable) {
    }
}
