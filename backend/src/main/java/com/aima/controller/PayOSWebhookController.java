package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Webhook payOS — nguồn sự thật của luồng thanh toán. Public (không JWT), xác thực bằng
 * HMAC-SHA256 trên object {@code data} của payload.
 *
 * <p><b>Endpoint này LUÔN trả HTTP 200.</b> payOS retry mọi response khác 200, nên body quá cỡ,
 * chữ ký sai, orderCode lạ hay lỗi nội bộ đều được nuốt trong service rồi kết thúc êm. Đặc biệt
 * với orderCode lạ, trả 200 là BẮT BUỘC: payOS gửi một giao dịch MẪU (orderCode = 123) ngay lúc
 * đăng ký webhook, trả lỗi ở đó nghĩa là đăng ký webhook thất bại.</p>
 *
 * <p><b>Nhận body dạng {@code String}, không phải DTO</b> (điểm F §5): chữ ký được tính trên
 * văn bản gốc, deserialize sang POJO trước khi kiểm là mất chính xác số thập phân và làm chữ ký
 * lệch. Service cũng kiểm kích thước body TRƯỚC khi parse.</p>
 *
 * <p><b>Ngoại lệ rule #3 (thứ hai sau {@code PlatformConnectionController.callback}).</b> Kiểu
 * trả về là {@code ResponseEntity<Object>} chứ không phải {@code ApiResponse<T>} để body ack
 * nằm gọn trong MỘT hằng số {@link #WEBHOOK_ACK} và đổi được bằng đúng một dòng — xem javadoc
 * của hằng số đó.</p>
 */
@RestController
@RequestMapping("/webhooks/payos")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "payOS Webhook", description = "Payment result callbacks from payOS. Public — secured by the HMAC-SHA256 signature over the data object.")
public class PayOSWebhookController {

    /**
     * ⚠️ <b>CHỖ DUY NHẤT quyết định body trả về cho payOS.</b>
     *
     * <p><b>Chưa xác minh được</b> payOS mong nhận lại body gì: tài liệu không nêu, SDK Node
     * minh hoạ {@code {success: true}}. Mặc định ở đây là envelope {@code ApiResponse} chuẩn dự
     * án (rule #3) vì quyết định retry của payOS đi theo HTTP status, mà endpoint luôn trả 200.
     * Lưu ý {@code ApiResponse} <b>không có</b> field {@code success} — JSON thực tế là
     * {@code {"code":200,"message":"Đã nhận webhook"}}.</p>
     *
     * <p><b>Rủi ro thật nếu đoán sai không phải là retry</b> mà là {@code POST /confirm-webhook}
     * TỪ CHỐI đăng ký lúc go-live → webhook không bao giờ được gọi → tính năng chết âm thầm.
     * Nếu lúc đăng ký thật payOS báo lỗi, <b>đổi ĐÚNG dòng dưới đây</b> thành:</p>
     *
     * <pre>{@code static final Object WEBHOOK_ACK = Map.of("success", true);}</pre>
     *
     * <p>không phải sửa chỗ nào khác. Việc này nằm trong checklist go-live của
     * {@code docs/PAYMENT.md}.</p>
     */
    static final Object WEBHOOK_ACK = ApiResponse.success("Đã nhận webhook");

    PaymentService paymentService;

    @PostMapping
    @SecurityRequirements({})
    @Operation(summary = "Receive a payment result",
            description = "Always answers 200 so payOS never retries; rejected payloads are silently recorded in the activity log.")
    public ResponseEntity<Object> receive(@RequestBody(required = false) String body) {
        paymentService.handleWebhook(body);
        return ResponseEntity.ok(WEBHOOK_ACK);
    }
}
