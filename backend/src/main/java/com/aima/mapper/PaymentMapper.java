package com.aima.mapper;

import com.aima.dto.response.BillingOverviewResponse;
import com.aima.dto.response.CheckoutQuoteResponse;
import com.aima.dto.response.CheckoutResponse;
import com.aima.dto.response.PaymentResponse;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.enums.PaymentMethod;
import com.aima.util.CheckoutPricing;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDateTime;
import java.util.List;

/** Entity ↔ DTO của luồng thanh toán (rule #18 — service không tự dựng DTO). */
@Mapper(componentModel = "spring")
public interface PaymentMapper {

    @Mapping(target = "paymentId", source = "payment.id")
    @Mapping(target = "planCode", source = "payment.plan.code")
    CheckoutResponse toCheckoutResponse(Payment payment, Boolean reused);

    @Mapping(target = "planCode", source = "plan.code")
    @Mapping(target = "planNameVi", source = "plan.nameVi")
    @Mapping(target = "planNameEn", source = "plan.nameEn")
    PaymentResponse toResponse(Payment payment);

    List<PaymentResponse> toResponseList(List<Payment> payments);

    /**
     * Gói hiện hành + đơn đang chờ. {@code plan} truyền riêng thay vì lấy qua
     * {@code subscription.getPlan()} để caller chủ động đọc trong transaction — subscription là
     * entity lazy, map ngoài transaction sẽ ném {@code LazyInitializationException}.
     */
    @Mapping(target = "planId", source = "plan.id")
    @Mapping(target = "planCode", source = "plan.code")
    @Mapping(target = "planNameVi", source = "plan.nameVi")
    @Mapping(target = "planNameEn", source = "plan.nameEn")
    @Mapping(target = "price", source = "plan.price")
    @Mapping(target = "billingIntervalMonths", source = "plan.billingIntervalMonths")
    @Mapping(target = "monthlyTokenLimit", source = "plan.monthlyTokenLimit")
    @Mapping(target = "planSource", source = "subscription.planSource")
    @Mapping(target = "planStartedAt", source = "subscription.planStartedAt")
    @Mapping(target = "planExpiresAt", source = "subscription.planExpiresAt")
    @Mapping(target = "currentPeriodEnd", source = "subscription.currentPeriodEnd")
    BillingOverviewResponse toBillingOverview(Subscription subscription, Plan plan,
                                              PaymentResponse pendingPayment,
                                              LocalDateTime serverTime);

    /**
     * Báo giá cho trang "Xem lại đơn hàng". {@code currentPlan} null khi user đang Free; hai gói
     * trùng tên thuộc tính nên mọi trường đều khai báo nguồn tường minh.
     */
    @Mapping(target = "planId", source = "plan.id")
    @Mapping(target = "planCode", source = "plan.code")
    @Mapping(target = "planNameVi", source = "plan.nameVi")
    @Mapping(target = "planNameEn", source = "plan.nameEn")
    @Mapping(target = "billingIntervalMonths", source = "plan.billingIntervalMonths")
    @Mapping(target = "orderType", source = "quote.orderType")
    @Mapping(target = "subtotal", source = "quote.subtotal")
    @Mapping(target = "currentPlanCode", source = "currentPlan.code")
    @Mapping(target = "currentPlanNameVi", source = "currentPlan.nameVi")
    @Mapping(target = "currentPlanNameEn", source = "currentPlan.nameEn")
    @Mapping(target = "currentPlanExpiresAt", source = "currentExpiresAt")
    @Mapping(target = "oldListPrice", source = "quote.oldListPrice")
    @Mapping(target = "prorationRemainingDays", source = "quote.proration.remainingDays")
    @Mapping(target = "prorationCycleDays", source = "quote.proration.cycleDays")
    @Mapping(target = "prorationCredit", source = "quote.proration.credit")
    @Mapping(target = "roundingAmount",
            expression = "java(quote.proration() == null ? 0L : quote.proration().rounding())")
    @Mapping(target = "total", source = "quote.total")
    @Mapping(target = "newExpiresAt", source = "quote.newExpiresAt")
    @Mapping(target = "purchasable", expression = "java(quote.purchasable())")
    @Mapping(target = "blockedCode",
            expression = "java(quote.blockedBy() == null ? null : quote.blockedBy().getCode())")
    @Mapping(target = "blockedMessage",
            expression = "java(quote.blockedBy() == null ? null : quote.blockedBy().getMessage())")
    CheckoutQuoteResponse toQuoteResponse(Plan plan, Plan currentPlan, LocalDateTime currentExpiresAt,
                                          CheckoutPricing.Quote quote, List<PaymentMethod> paymentMethods,
                                          LocalDateTime serverTime);
}
