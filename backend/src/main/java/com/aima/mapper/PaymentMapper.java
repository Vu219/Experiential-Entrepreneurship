package com.aima.mapper;

import com.aima.dto.response.BillingOverviewResponse;
import com.aima.dto.response.CheckoutResponse;
import com.aima.dto.response.PaymentResponse;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
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
}
