package com.aima.service;

/**
 * Webhook Meta Page {@code feed} cho analytics (giai đoạn 3): bài mới / bài bị xoá / tương tác → đồng bộ sớm.
 * GET xác thực đăng ký (verify token); POST nhận sự kiện, đối chiếu chữ ký X-Hub-Signature-256.
 */
public interface MetaWebhookService {

    /** Trả lại hub.challenge khi mode=subscribe và verify token khớp; sai → WEBHOOK_VERIFY_FAILED. */
    String verify(String mode, String verifyToken, String challenge);

    /**
     * Nhận event: chữ ký sai → bỏ; mỗi thay đổi lưu một dòng (trùng → bỏ) rồi giao worker xử lý nền — trả ngay, không chờ.
     */
    void handleEvent(String rawBody, String signature);
}
