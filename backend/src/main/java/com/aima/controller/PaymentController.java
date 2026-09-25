package com.aima.controller;

import com.aima.dto.request.CheckoutRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BillingOverviewResponse;
import com.aima.dto.response.CheckoutResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PaymentResponse;
import com.aima.enums.MockPaymentOutcome;
import com.aima.enums.PaymentStatus;
import com.aima.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
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
 * Mua gói & lịch sử thanh toán của CHÍNH người đang đăng nhập (API-02/API-03).
 *
 * <p>Toàn bộ endpoint đều scope theo email trong token — không endpoint nào nhận {@code userId}
 * từ client. Thao tác quản trị trên đơn hàng nằm ở {@code AdminPaymentController} riêng.</p>
 */
@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Payment", description = "Buy a plan through payOS, track orders and reconcile them (FR plan billing).")
public class PaymentController {

    PaymentService paymentService;

    @PostMapping("/checkout")
    @Operation(summary = "Create a payment order and checkout link",
            description = "Blocks downgrades while the current plan is still valid, and keeps at most one pending order per user: buying the same plan again returns the existing link untouched.")
    public ApiResponse<CheckoutResponse> checkout(@AuthenticationPrincipal UserDetails principal,
                                                  @Valid @RequestBody CheckoutRequest request) {
        return paymentService.checkout(principal.getUsername(), request);
    }

    @GetMapping("/billing")
    @Operation(summary = "Current plan and pending order",
            description = "Reads the subscription (source of truth), not the cached User.plan label. planExpiresAt = null means the plan does not expire.")
    public ApiResponse<BillingOverviewResponse> getBilling(@AuthenticationPrincipal UserDetails principal) {
        return paymentService.getBilling(principal.getUsername());
    }

    @GetMapping
    @Operation(summary = "Payment history (newest first)",
            description = "Paged and filterable by status and order date; 'to' includes the whole day.")
    public ApiResponse<PageResponse<PaymentResponse>> list(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return paymentService.list(principal.getUsername(), status, from, to, page, size);
    }

    @GetMapping("/{paymentId}")
    @Operation(summary = "Order detail", description = "Another user's order returns 403.")
    public ApiResponse<PaymentResponse> get(@AuthenticationPrincipal UserDetails principal,
                                            @PathVariable UUID paymentId) {
        return paymentService.get(principal.getUsername(), paymentId);
    }

    @PostMapping("/{paymentId}/cancel")
    @Operation(summary = "Cancel a pending order",
            description = "Race-safe: if the gateway has already recorded the money, the order is activated instead of cancelled.")
    public ApiResponse<PaymentResponse> cancel(@AuthenticationPrincipal UserDetails principal,
                                               @PathVariable UUID paymentId) {
        return paymentService.cancel(principal.getUsername(), paymentId);
    }

    @PostMapping("/{paymentId}/verify")
    @Operation(summary = "Reconcile one order against the gateway",
            description = "Called by the return page: payOS appends an UNSIGNED query string, so the frontend must never trust it — the backend asks the gateway itself.")
    public ApiResponse<PaymentResponse> verify(@AuthenticationPrincipal UserDetails principal,
                                               @PathVariable UUID paymentId) {
        return paymentService.verify(principal.getUsername(), paymentId);
    }

    @PostMapping("/mock/{paymentId}/{outcome}")
    @Operation(summary = "DEV ONLY — simulate the gateway outcome",
            description = "Backs the three buttons of the mock checkout page. Disabled unless PAYMENT_GATEWAY=mock and production mode is off.")
    public ApiResponse<PaymentResponse> applyMockOutcome(@AuthenticationPrincipal UserDetails principal,
                                                         @PathVariable UUID paymentId,
                                                         @PathVariable MockPaymentOutcome outcome) {
        return paymentService.applyMockOutcome(principal.getUsername(), paymentId, outcome);
    }
}
