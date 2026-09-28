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
 * Đối soát đơn TREO — quét mỗi phút.
 *
 * <p>Đơn treo là đơn còn {@code PENDING} mà không có {@code checkout_url} (lần tạo link không
 * kết luận được), hoặc đã bật {@code reconcile_required}. Nó vừa chiếm chỗ PENDING duy nhất
 * của user — partial unique {@code uk_payments_one_pending_per_user} — vừa không có link để
 * trả tiền, nên user bị <b>khoá cứng khỏi việc mua hàng</b>.</p>
 *
 * <p><b>Vì sao mỗi phút chứ không đợi hạn 15 phút</b>: hạn thanh toán là chuyện của đơn còn
 * sống; đơn treo thì không có gì để chờ cả — mỗi phút user không mua được là một phút mất
 * doanh thu vì một sự cố mạng thoáng qua.</p>
 *
 * <p>Resilient (rule #27): lỗi từng đơn do {@code PaymentService} nuốt và log, job không bao
 * giờ ném ra ngoài.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PaymentReconcileJob {

    PaymentService paymentService;

    @Scheduled(fixedDelayString = "${payment.reconcile-interval-ms:60000}")
    @SchedulerLock(name = "payment-reconcile", lockAtMostFor = "PT5M", lockAtLeastFor = "PT20S")
    public void run() {
        try {
            paymentService.reconcileStuckOrders();
        } catch (Exception e) {
            log.error("[PaymentReconcile] Vòng đối soát lỗi: {}", e.getMessage(), e);
        }
    }
}
