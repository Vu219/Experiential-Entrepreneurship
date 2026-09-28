package com.aima.scheduler;

import com.aima.service.PaymentService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Chốt các đơn ĐÃ QUÁ HẠN chờ thanh toán — quét mỗi phút.
 *
 * <p>Khác {@link PaymentReconcileJob}: job kia lo đơn <i>treo</i> (không có link để trả tiền),
 * job này lo đơn <i>còn sống nhưng hết giờ</i>. Hai truy vấn nguồn cố ý không giao nhau —
 * {@code findExpiredPendingIds} loại đơn thiếu {@code checkout_url} và đơn đã bật
 * {@code reconcile_required} — để một đơn không bị hai job cùng nện vào cổng mỗi phút.</p>
 *
 * <p><b>Luôn hỏi cổng TRƯỚC khi đóng.</b> Đó là chỗ một đơn đã trả tiền mà webhook không tới
 * được cứu, và là chỗ đơn {@code PROCESSING} (tiền đang chuyển dở) được gia hạn thay vì bị huỷ
 * — huỷ một đơn như vậy là cách chắc chắn nhất để tiền của khách về sau khi đơn đã đóng.</p>
 *
 * <p>Resilient (rule #27): lỗi từng đơn do {@code PaymentService} nuốt và log, job không bao
 * giờ ném ra ngoài.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PaymentExpiryJob {

    PaymentService paymentService;

    @Scheduled(fixedDelayString = "${payment.expiry-interval-ms:60000}")
    @SchedulerLock(name = "payment-expiry", lockAtMostFor = "PT5M", lockAtLeastFor = "PT20S")
    public void run() {
        try {
            paymentService.expireOverdueOrders();
        } catch (Exception e) {
            log.error("[PaymentExpiry] Vòng quét đơn hết hạn lỗi: {}", e.getMessage(), e);
        }
    }
}
