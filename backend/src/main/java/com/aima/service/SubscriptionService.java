package com.aima.service;

import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.DurationUnit;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionChangeCategory;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Gói đăng ký hiện hành của user ({@code subscriptions}) — <b>nguồn sự thật</b> về gói + chu kỳ
 * tính usage.
 *
 * <p><b>Q4 — đảo chiều nguồn sự thật (2026-09-22).</b> {@code User.plan} nay chỉ là nhãn
 * <b>cache một chiều</b> (subscription → user). Mọi thao tác thanh toán/hết hạn ghi CẢ HAI
 * trong CÙNG một transaction, nên nhãn và subscription luôn khớp. Đường admin cũ
 * ({@code PATCH /users} ghi {@code User.plan}) vẫn hoạt động NGUYÊN như trước, nhưng chỉ với
 * subscription còn {@code planSource = FREE} — xem {@link #getOrCreate}.</p>
 */
public interface SubscriptionService {

    /**
     * Subscription hiện hành của user: tự tạo nếu chưa có, <b>tự hạ về Free khi gói trả tiền
     * đã hết hạn</b>, tự lăn sang kỳ mới khi {@code currentPeriodEnd} đã qua, và đồng bộ plan
     * theo {@code User.plan} <b>chỉ khi</b> {@code planSource = FREE}.
     *
     * <p><b>Vì sao hạ gói ở ĐÂY chứ không chỉ trong cron</b>: đây là đường mà mọi lời gọi
     * {@code checkQuota} đi qua. Nếu chỉ dựa vào {@code SubscriptionExpiryJob} thì một lần
     * scheduler không chạy (app restart, deploy, lệch múi giờ) là user tiếp tục dùng hạn mức
     * gói đã hết hạn cho tới lần cron kế tiếp. Hai đường cố ý làm TRÙNG nhau; đường nào chạy
     * trước cũng cho cùng kết quả vì {@link #expireToFreePlan} idempotent.
     *
     * <p><b>Vì sao có điều kiện {@code planSource}</b>: không có nó, nhánh đồng bộ sẽ HỦY
     * việc hạ gói ngay ở request kế tiếp. Job hết hạn đặt {@code subscription.plan = FREE},
     * lần gọi sau thấy {@code User.plan} vẫn là PRO, và vì FREE → PRO không phải "hạ gói" nên
     * nó khôi phục lại PRO — user hết hạn vẫn dùng gói trả tiền vĩnh viễn. Gói do thanh toán
     * hoặc admin cấp thì subscription là nguồn sự thật, không nghe theo nhãn nữa.</p>
     *
     * <p>Trả null khi bảng plans chưa có gói của user (DB chưa seed) — caller rơi về
     * hạn mức/kỳ mặc định, không chặn luồng AI. Gọi trong transaction đang mở (có thể ghi).</p>
     */
    Subscription getOrCreate(User user);

    /**
     * Kích hoạt gói TRẢ TIỀN sau khi một đơn chuyển PAID. Ghi {@code subscription.plan} +
     * {@code planStartedAt} + {@code planExpiresAt} + {@code planSource=PAYMENT} <b>và</b>
     * nhãn cache {@code User.plan}, trong cùng transaction của caller.
     *
     * <p>Quy tắc hạn dùng (Q1):</p>
     * <ul>
     *   <li><b>Trùng gói</b> → CỘNG DỒN: mốc mới = (hạn cũ nếu còn hạn, ngược lại {@code now})
     *       + chu kỳ. {@code planExpiresAt} null được coi là "không còn hạn" ở đây, tức cộng
     *       từ {@code now} — null chỉ có nghĩa "vô hạn" với gói Free/admin cấp.</li>
     *   <li><b>Nâng gói</b> → THAY THẾ: {@code now} + chu kỳ, bỏ phần dư của gói cũ.</li>
     * </ul>
     *
     * @param now mốc kích hoạt, truyền vào để test cố định được thời gian
     * @return subscription đã cập nhật (null khi user chưa có subscription và không tạo được)
     */
    Subscription activatePaidPlan(User user, Plan plan, LocalDateTime now);

    /**
     * Admin CỘNG THÊM thời hạn vào gói hiện tại: mốc mới = (hạn cũ nếu còn hạn, ngược lại
     * {@code now}) + {@code amount} {@code unit}. Giữ nguyên gói, {@code planSource} (gói tự mua
     * vẫn là PAYMENT — user chốt 25/9) và {@code planStartedAt}; lịch sử ghi nhận admin tặng.
     *
     * @throws com.aima.exception.AppException {@code SUBSCRIPTION_DURATION_INVALID} khi vượt trần
     *         của đơn vị; {@code SUBSCRIPTION_NOT_EXTENDABLE} khi gói Free hoặc không hết hạn
     */
    Subscription extendPlan(User user, int amount, DurationUnit unit, LocalDateTime now, AdminChange change);

    /**
     * Admin chuyển user sang {@code plan} khác, thời hạn tính từ {@code now}; {@code unit = null}
     * nghĩa là KHÔNG hết hạn. Ghi {@code planSource = ADMIN} để doanh thu không đếm gói tặng là
     * gói bán được. Hạn mức gói mới áp dụng ngay (kể cả khi hạ gói).
     *
     * @throws com.aima.exception.AppException {@code SUBSCRIPTION_CHANGE_TO_FREE} (dùng thu hồi),
     *         {@code SUBSCRIPTION_SAME_PLAN} (dùng gia hạn), {@code SUBSCRIPTION_DURATION_INVALID}
     */
    Subscription changePlan(User user, Plan plan, Integer amount, DurationUnit unit, LocalDateTime now,
                            AdminChange change);

    /**
     * Admin thu hồi gói — hạ về Free NGAY, cùng trạng thái cuối với {@link #expireToFreePlan}
     * ({@code planSource = FREE}, không có vòng đời).
     *
     * @throws com.aima.exception.AppException {@code SUBSCRIPTION_ALREADY_FREE}
     */
    Subscription revokeToFree(User user, LocalDateTime now, AdminChange change);

    /**
     * Hạ về gói Free cho MỘT subscription theo id — đường mà {@code SubscriptionExpiryJob}
     * dùng. Tách khỏi {@link #expireToFreePlan(Subscription, LocalDateTime)} vì job là bean
     * KHÁC: gọi qua proxy thì {@code @Transactional} mới có tác dụng, và mỗi subscription là
     * một transaction NGẮN riêng — một bản ghi hỏng không kéo đổ cả vòng quét.
     *
     * @return true nếu đã hạ gói
     */
    boolean expireToFreePlan(UUID subscriptionId, LocalDateTime now);

    /**
     * Hạ về gói Free khi gói trả tiền hết hạn. Ghi cả {@code subscription} lẫn nhãn
     * {@code User.plan} trong cùng transaction — nếu chỉ ghi một bên, {@link #getOrCreate}
     * sẽ khôi phục lại gói cũ ở request kế tiếp.
     *
     * @return true nếu đã hạ gói; false khi không có gì để làm hoặc thiếu gói FREE trong DB
     */
    boolean expireToFreePlan(Subscription subscription, LocalDateTime now);

    /**
     * Ai thao tác + vì sao — đi kèm mọi thay đổi gói do admin, ghi thẳng vào
     * {@code subscription_history}. {@code actorEmail} là snapshot (admin bị xoá vẫn đọc được).
     */
    record AdminChange(UUID actorId, String actorEmail, SubscriptionChangeCategory category, String reason) {
    }

    /** Trạng thái gói TRƯỚC khi đổi — vế "from" của một dòng lịch sử. */
    record PlanSnapshot(String planCode, LocalDateTime expiresAt, PlanSource source) {
    }
}
