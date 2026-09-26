package com.aima.controller;

import com.aima.dto.request.PaymentActionRequest;
import com.aima.dto.response.AdminPaymentResponse;
import com.aima.dto.response.AdminPaymentSummaryResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.service.AdminPaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Quản trị ĐƠN HÀNG & gói dịch vụ của người dùng.
 *
 * <p>Tách khỏi {@code AdminRevenueController} (trang "Thống kê doanh thu" — chỉ đọc, gộp số)
 * vì đây là nơi có THAO TÁC trên tiền thật. Mọi thao tác bắt buộc kèm lý do
 * ({@code @NotBlank}) và để lại một dòng {@code activity_logs}.</p>
 *
 * <p>Phân quyền bằng {@code @PreAuthorize("hasRole('ADMIN')")} ở cấp LỚP — cùng cơ chế
 * {@code AdminUsageController}/{@code AdminRevenueController} đang dùng, không dựng filter
 * riêng.</p>
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Payments", description = "Order queue and manual actions on payments. "
        + "Every action requires a reason and is recorded in activity_logs.")
public class AdminPaymentController {

    AdminPaymentService adminPaymentService;

    @GetMapping("/payments/summary")
    @Operation(summary = "Work-queue counters for the orders page",
            description = "Orders awaiting manual reconciliation, orders still pending, and payOS webhooks rejected. "
                    + "Without from/to: all open work + webhooks rejected in the last 24h. With from/to (order date, "
                    + "to inclusive): the same three counters scoped to that period, matching the orders list filter.")
    public ApiResponse<AdminPaymentSummaryResponse> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return adminPaymentService.summary(from, to);
    }

    @GetMapping("/payments")
    @Operation(summary = "List orders",
            description = "Filter by status, gateway, reconciliation flag, order date and a free-text query over invoice number, gateway order code or buyer email. Never includes rawPayload.")
    public ApiResponse<PageResponse<AdminPaymentResponse>> list(
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) PaymentGateway gateway,
            @RequestParam(required = false) Boolean reconcileRequired,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return adminPaymentService.list(status, gateway, reconcileRequired, from, to, q, page, size);
    }

    @GetMapping("/payments/{paymentId}")
    @Operation(summary = "Order detail, including the raw gateway payload",
            description = "rawPayload is the only debugging tool when a real incident happens; it is exposed here and nowhere else.")
    public ApiResponse<AdminPaymentResponse> get(@PathVariable UUID paymentId) {
        return adminPaymentService.get(paymentId);
    }

    @PostMapping("/payments/{paymentId}/cancel")
    @Operation(summary = "Cancel a pending order (reason required)",
            description = "Race-safe: if the gateway has already recorded the money, the plan is activated instead of cancelled.")
    public ApiResponse<AdminPaymentResponse> cancel(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable UUID paymentId,
                                                    @Valid @RequestBody PaymentActionRequest request) {
        return adminPaymentService.cancel(principal.getUsername(), paymentId, request);
    }

    @PostMapping("/payments/{paymentId}/mark-paid")
    @Operation(summary = "Record an out-of-band payment (reason required)",
            description = "Runs the same activation path as the webhook, so the Q1 accumulate/replace rules and idempotency still apply.")
    public ApiResponse<AdminPaymentResponse> markPaid(@AuthenticationPrincipal UserDetails principal,
                                                      @PathVariable UUID paymentId,
                                                      @Valid @RequestBody PaymentActionRequest request) {
        return adminPaymentService.markPaid(principal.getUsername(), paymentId, request);
    }
}
