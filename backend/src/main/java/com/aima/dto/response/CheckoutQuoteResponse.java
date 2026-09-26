package com.aima.dto.response;

import com.aima.enums.PaymentMethod;
import com.aima.enums.PaymentOrderType;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Báo giá cho trang "Xem lại đơn hàng" ({@code GET /payments/quote}). Chỉ ĐỌC — không tạo đơn,
 * không đụng gói hiện tại. Mọi con số của dòng khấu trừ đều trả về để FE hiển thị công thức
 * minh bạch: {@code subtotal − prorationCredit − roundingAmount = total}.
 *
 * <p>Đơn bị chặn vẫn trả 200 với {@code purchasable = false} + lý do, để trang giải thích được
 * VÌ SAO (kèm con số) thay vì chỉ hiện một thông báo lỗi.</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CheckoutQuoteResponse {

    UUID planId;
    String planCode;
    String planNameVi;
    String planNameEn;
    Short billingIntervalMonths;

    PaymentOrderType orderType;

    /** Giá niêm yết gói mới (tạm tính). */
    Long subtotal;

    /** Gói đang dùng — null nếu đang Free. */
    String currentPlanCode;
    String currentPlanNameVi;
    String currentPlanNameEn;
    LocalDateTime currentPlanExpiresAt;

    /** Các trường proration* chỉ có khi {@code orderType = UPGRADE}. */
    Long oldListPrice;
    Integer prorationRemainingDays;
    Integer prorationCycleDays;
    Long prorationCredit;
    /** 0 khi không làm tròn. */
    Long roundingAmount;

    /** Số tiền sẽ thu. */
    Long total;

    /** Hạn dùng dự kiến nếu thanh toán NGAY bây giờ (mốc thật tính lại lúc tiền về). */
    LocalDateTime newExpiresAt;

    Boolean purchasable;
    /** {@code ErrorCode.code} của lý do chặn — null khi mua được. */
    Integer blockedCode;
    String blockedMessage;

    /** Phương thức đang bật — FE render danh sách thẻ theo đúng thứ tự này. */
    List<PaymentMethod> paymentMethods;

    LocalDateTime serverTime;
}
