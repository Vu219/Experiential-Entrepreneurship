package com.aima.service.Impl;

import com.aima.dto.request.PaymentActionRequest;
import com.aima.dto.response.AdminPaymentResponse;
import com.aima.dto.response.AdminPaymentSummaryResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.Payment;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AdminPaymentMapper;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PaymentSpecifications;
import com.aima.service.ActivityLogService;
import com.aima.service.AdminPaymentService;
import com.aima.service.PaymentService;
import com.aima.service.SystemLogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Thao tác quản trị trên sổ cái {@code payments}.
 *
 * <p><b>Không tự viết trạng thái đơn.</b> Huỷ đi qua {@code closeLinkSafely}, đánh dấu đã trả
 * tiền đi qua {@code applyGatewayResult} — cùng code path webhook dùng, nên đường admin cũng
 * được khoá dòng {@code SELECT … FOR UPDATE} và idempotent y hệt. Viết tay một nhánh riêng ở
 * đây là cách chắc chắn nhất để hai đường lệch nhau sau vài tháng.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminPaymentServiceImpl implements AdminPaymentService {

    static final String LOG_MODULE = "admin.payment";
    static final String TARGET_PAYMENT = "PAYMENT";
    static final int MAX_PAGE_SIZE = 100;

    PaymentRepository paymentRepository;
    ActivityLogRepository activityLogRepository;
    AdminPaymentMapper adminPaymentMapper;
    PaymentService paymentService;
    ActivityLogService activityLogService;
    SystemLogService systemLogService;

    // ================================================================== đọc

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<AdminPaymentSummaryResponse> summary() {
        long reconcile = paymentRepository.countByReconcileRequiredTrueAndDeletedAtIsNull();
        long pending = paymentRepository.countByStatusAndDeletedAtIsNull(PaymentStatus.PENDING);
        long rejected = activityLogRepository.countByActionSince(
                ActivityAction.PAYMENT_WEBHOOK_REJECTED.name(), LocalDateTime.now().minusHours(24));
        AdminPaymentSummaryResponse result = adminPaymentMapper.toSummary(reconcile, pending, rejected);
        return ApiResponse.success("Lấy tổng quan đơn hàng thành công", result);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<AdminPaymentResponse>> list(PaymentStatus status, PaymentGateway gateway,
                                                                Boolean reconcileRequired, LocalDate from,
                                                                LocalDate to, String q, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "orderedAt"));
        // "to" là NGÀY, hiểu theo nghĩa BAO GỒM cả ngày đó → mốc trên exclusive là hôm sau.
        Page<Payment> payments = paymentRepository.findAll(PaymentSpecifications.adminSearch(
                status, gateway, reconcileRequired,
                from == null ? null : from.atStartOfDay(),
                to == null ? null : to.plusDays(1).atStartOfDay(),
                q), pageable);
        // toRowList() BỎ rawPayload — xem javadoc AdminPaymentMapper.
        PageResponse<AdminPaymentResponse> result =
                PageResponse.from(payments, adminPaymentMapper.toRowList(payments.getContent()));
        return ApiResponse.success("Lấy danh sách đơn hàng thành công", result);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<AdminPaymentResponse> get(UUID paymentId) {
        AdminPaymentResponse result = adminPaymentMapper.toDetail(requirePayment(paymentId));
        return ApiResponse.success("Lấy chi tiết đơn hàng thành công", result);
    }

    // ================================================================== thao tác

    @Override
    public ApiResponse<AdminPaymentResponse> cancel(String actorEmail, UUID paymentId,
                                                    PaymentActionRequest request) {
        Payment before = requirePayment(paymentId);
        if (before.getStatus() != PaymentStatus.PENDING) {
            throw new AppException(ErrorCode.PAYMENT_NOT_CANCELLABLE);
        }
        // Gọi cổng → phải nằm NGOÀI transaction (rule #24). closeLinkSafely cũng là thứ bảo vệ
        // race "huỷ đúng lúc tiền về": cổng báo PAID thì đơn được kích hoạt chứ không bị huỷ.
        paymentService.closeLinkSafely(paymentId, "ADMIN_CANCELLED: " + request.getReason());

        Payment after = requirePayment(paymentId);
        audit(ActivityAction.PAYMENT_CANCELLED, actorEmail, TARGET_PAYMENT, paymentId, Map.of(
                "reason", request.getReason(),
                "statusBefore", before.getStatus().name(),
                "statusAfter", after.getStatus().name(),
                "amount", after.getAmount()));
        systemLogService.warn(LOG_MODULE, actorEmail + " huỷ đơn " + paymentId + ": " + request.getReason());

        AdminPaymentResponse result = adminPaymentMapper.toDetail(after);
        return ApiResponse.success("Đã xử lý yêu cầu huỷ đơn", result);
    }

    @Override
    public ApiResponse<AdminPaymentResponse> markPaid(String actorEmail, UUID paymentId,
                                                      PaymentActionRequest request) {
        Payment before = requirePayment(paymentId);
        if (before.getStatus() == PaymentStatus.PAID
                || before.getStatus() == PaymentStatus.REFUNDED
                || before.getStatus() == PaymentStatus.PARTIALLY_REFUNDED) {
            // Chặn ở đây thay vì để applyGatewayResult im lặng bỏ qua: admin phải BIẾT là thao
            // tác không có tác dụng, chứ không phải tưởng đã cộng hạn rồi bấm lại lần nữa.
            throw new AppException(ErrorCode.PAYMENT_NOT_MARKABLE_PAID);
        }

        // Số tiền truyền vào = ĐÚNG số tiền của đơn: "đánh dấu đã trả tiền" nghĩa là xác nhận
        // khách đã trả đủ. Lệch một đồng thì applyGatewayResult sẽ bật cờ đối soát thay vì
        // kích hoạt gói — không có đường tắt nào ở đây.
        paymentService.applyGatewayResult(paymentId, GatewayLinkStatus.PAID, before.getAmount(),
                null, "ADMIN_MARKED_PAID: " + request.getReason());
        noteReason(paymentId, actorEmail, request.getReason());

        Payment after = requirePayment(paymentId);
        audit(ActivityAction.PAYMENT_MARKED_PAID, actorEmail, TARGET_PAYMENT, paymentId, Map.of(
                "reason", request.getReason(),
                "statusBefore", before.getStatus().name(),
                "statusAfter", after.getStatus().name(),
                "amount", after.getAmount(),
                "planActivated", after.getPlan().getCode()));
        systemLogService.warn(LOG_MODULE,
                actorEmail + " đánh dấu ĐÃ TRẢ TIỀN cho đơn " + paymentId + ": " + request.getReason());

        AdminPaymentResponse result = adminPaymentMapper.toDetail(after);
        return ApiResponse.success("Đã ghi nhận thanh toán thủ công", result);
    }

    // ================================================================== tiện ích

    /**
     * Ghi lý do vào {@code note} của đơn — lý do sống cùng bản ghi, không chỉ nằm trong bảng
     * log. Người mở drawer chi tiết sáu tháng sau đọc được ngay tại chỗ.
     *
     * <p>Cố ý KHÔNG khai {@code @Transactional}: hàm này được gọi từ chính bean này nên
     * annotation sẽ bị proxy bỏ qua (đúng cái bẫy đã sửa ở {@code applyGatewayResult}).
     * {@code JpaRepository.save} vốn đã tự mở transaction của nó, và đây là một lần ghi duy
     * nhất nên không cần gom chung với gì khác.</p>
     */
    private void noteReason(UUID paymentId, String actorEmail, String reason) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        payment.setNote("admin:" + actorEmail + " — " + reason);
        paymentRepository.save(payment);
    }

    /**
     * Đọc đơn kèm user + plan. An toàn khi gọi NGOÀI transaction vì {@code findDetailById}
     * fetch-join cả hai quan hệ — không có lazy proxy nào còn sót lại để nổ sau đó.
     */
    private Payment requirePayment(UUID paymentId) {
        return paymentRepository.findDetailById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
    }

    /**
     * Một dòng {@code activity_logs} cho mỗi thao tác. {@code Entry.byActor} tự tra userId của
     * admin từ email trên thread nền, nên request nghiệp vụ không tốn thêm query.
     */
    private void audit(ActivityAction action, String actorEmail, String targetType, UUID targetId,
                       Map<String, Object> metadata) {
        activityLogService.record(new ActivityLogService.Entry(
                action, null, actorEmail, targetType, targetId.toString(),
                ActivityResult.SUCCESS, metadata));
    }
}
