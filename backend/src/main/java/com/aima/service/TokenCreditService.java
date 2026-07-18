package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.TokenCreditResponse;

import java.util.List;
import java.util.UUID;

/**
 * Token mua thêm ({@code token_credits}) — bucket riêng, KHÔNG reset theo kỳ. Chỉ bị tiêu
 * khi mức dùng kỳ đã vượt hạn mức GÓI (trừ gói trước — xem AiUsageServiceImpl.saveEvent).
 * Luồng bán/tạo credit thuộc pha payment (webhook idempotent) — pha này mới có tiêu + đọc.
 */
public interface TokenCreditService {

    /** Tổng credit còn tiêu được (ACTIVE, chưa hết hạn) của user. */
    long creditLeft(UUID userId);

    /**
     * Trừ {@code unitsNeeded} vào credit theo FIFO (dòng sắp hết hạn trước), có thể trải qua
     * NHIỀU dòng. Không đủ → trừ được bao nhiêu hay bấy nhiêu, phần thiếu trả về trong
     * {@code shortfall} (event đã gọi AI xong — KHÔNG rollback, lần checkQuota sau sẽ chặn).
     * Gọi trong transaction đang mở của recordCall.
     */
    Consumption consume(UUID userId, long unitsNeeded);

    /** Kết quả trừ credit của MỘT event: đã trừ được + phần thiếu (rò qua chỗ chặn). */
    record Consumption(long consumed, long shortfall) {
        public static final Consumption NONE = new Consumption(0, 0);
    }

    /**
     * DEV-ONLY: seed credit cho một user để verify quy tắc bucket TRƯỚC khi có luồng payment
     * thật. Hai lớp khoá: cờ {@code aima.dev.credit-seed-enabled} (mặc định TẮT) VÀ chặn cứng
     * khi Spring profile prod/production đang bật (kể cả khi cờ = true — endpoint tạo credit
     * miễn phí không được sống ở môi trường thật). Mỗi lần gọi ghi audit system_logs
     * (actor + user đích + kịch bản). Kịch bản:
     * <ul>
     *   <li>SIMPLE — 1 dòng 10.000, không hạn.</li>
     *   <li>FIFO — 3 dòng (1.000 hết hạn sau 10', 2.000 sau 1 ngày, 5.000 không hạn) —
     *       verify thứ tự tiêu sắp-hết-hạn-trước qua nhiều dòng.</li>
     *   <li>EXPIRY — 1 dòng ĐÃ hết hạn hôm qua (không bao giờ được tiêu) + 1 dòng hết hạn
     *       sau 5' — verify điều kiện expires_at nằm trong UPDATE.</li>
     * </ul>
     */
    ApiResponse<List<TokenCreditResponse>> devSeed(String actorEmail, UUID userId, String scenario);
}
