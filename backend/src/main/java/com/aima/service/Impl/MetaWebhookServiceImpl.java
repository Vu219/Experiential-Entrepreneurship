package com.aima.service.Impl;

import com.aima.config.MetaProperties;
import com.aima.entity.MetaWebhookEvent;
import com.aima.enums.WebhookEventStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PostAnalyticsMapper;
import com.aima.repository.MetaWebhookEventRepository;
import com.aima.service.MetaWebhookEventWorker;
import com.aima.service.MetaWebhookService;
import com.aima.service.SystemLogService;
import com.aima.util.FacebookPostIds;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Webhook Meta. Có hai việc:
 * <ul>
 *   <li>Analytics giai đoạn 3: Page {@code feed} (bài mới / bài xoá / bình luận / cảm xúc / chia sẻ) kích hoạt đồng bộ số
 *       liệu sớm — webhook không mang số đếm, số vẫn lấy qua API.</li>
 *   <li>Bài bị xoá → "Đã xoá trên nền tảng" (trung tính), KHÔNG đánh FAILED / không thông báo vi phạm: payload không cho biết
 *       Meta gỡ hay người dùng tự xoá (07/10). Không có custom content filter.</li>
 *   <li>Sự kiện test của App Dashboard (entry.id = "0") chỉ được lưu IGNORED.</li>
 * </ul>
 * Endpoint public nên: kiểm chữ ký X-Hub-Signature-256 (HMAC-SHA256 bằng app secret) TRƯỚC mọi thứ; mỗi thay đổi lưu một
 * dòng {@code meta_webhook_events} với khoá chống trùng (Meta gửi lại cùng payload → bỏ qua); xử lý giao cho
 * {@link MetaWebhookEventWorker} chạy nền để trả 200 ngay (Meta coi phản hồi chậm là lỗi và gửi lại).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MetaWebhookServiceImpl implements MetaWebhookService {

    static final String SUBSCRIBE_MODE = "subscribe";
    static final String SIGNATURE_PREFIX = "sha256=";
    static final String LOG_MODULE = "webhook.meta";
    static final int LOG_BODY_MAX = 2000;
    /** Nút "Test" trên App Dashboard gửi sự kiện mẫu có entry.id = "0" (không phải Trang thật). */
    static final String DASHBOARD_TEST_PAGE_ID = "0";

    MetaProperties metaProperties;
    SystemLogService systemLogService;
    ObjectMapper objectMapper;
    MetaWebhookEventRepository eventRepository;
    MetaWebhookEventWorker eventWorker;
    PostAnalyticsMapper postAnalyticsMapper;
    TransactionTemplate transactionTemplate;

    @Override
    public String verify(String mode, String verifyToken, String challenge) {
        String expected = metaProperties.webhook() == null ? null : metaProperties.webhook().verifyToken();
        if (!SUBSCRIBE_MODE.equals(mode) || !StringUtils.hasText(expected) || !expected.equals(verifyToken)) {
            log.warn("[Webhook] Xác thực đăng ký thất bại (mode={})", mode);
            throw new AppException(ErrorCode.WEBHOOK_VERIFY_FAILED);
        }
        log.info("[Webhook] Meta xác thực đăng ký webhook thành công");
        return challenge;
    }

    @Override
    public void handleEvent(String rawBody, String signature) {
        if (!isSignatureValid(rawBody, signature)) {
            log.warn("[Webhook] Chữ ký X-Hub-Signature-256 không hợp lệ — bỏ qua event");
            systemLogService.warn(LOG_MODULE, "Event bị từ chối: chữ ký không hợp lệ");
            return; // vẫn trả 200 để Meta không spam retry một payload hỏng
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(rawBody);
        } catch (Exception e) {
            systemLogService.warn(LOG_MODULE, "Event không phải JSON hợp lệ: " + truncate(rawBody));
            return;
        }

        int total = 0;
        int tests = 0;
        List<UUID> stored = new ArrayList<>();
        for (JsonNode entry : root.path("entry")) {
            String pageId = entry.path("id").asText(null);
            long time = entry.path("time").asLong(0);
            boolean dashboardTest = DASHBOARD_TEST_PAGE_ID.equals(pageId);
            for (JsonNode change : entry.path("changes")) {
                total++;
                UUID id = store(pageId, time, change, dashboardTest);
                if (dashboardTest) {
                    tests++;
                } else if (id != null) {
                    stored.add(id);
                }
            }
        }
        if (tests > 0) {
            log.info("[Webhook] Nhận {} sự kiện test từ App Dashboard (page_id = 0) — chỉ lưu, không xử lý", tests);
        }
        if (total > tests) {
            log.info("[Webhook] Nhận {} thay đổi ({} mới)", total - tests, stored.size());
        }
        stored.forEach(this::dispatch);
    }

    // Lưu một thay đổi; null = trùng (đã nhận trước đó) hoặc lỗi lưu. Sự kiện test của Dashboard lưu thẳng IGNORED (để biết
    // webhook đã thông) — không giao worker, không đụng dữ liệu, không ghi log lỗi.
    private UUID store(String pageId, long time, JsonNode change, boolean dashboardTest) {
        String dedupeKey = sha256(pageId + "|" + time + "|" + change.toString());
        if (eventRepository.existsByDedupeKey(dedupeKey)) {
            return null;
        }
        JsonNode value = change.path("value");
        try {
            MetaWebhookEvent event = postAnalyticsMapper.toWebhookEvent(
                    dedupeKey, cut(pageId, 100), cut(change.path("field").asText(null), 50),
                    cut(value.path("item").asText(null), 30), cut(value.path("verb").asText(null), 20),
                    cut(FacebookPostIds.canonical(pageId, value.path("post_id").asText(null)), 255), change.toString(),
                    time > 0 ? Instant.ofEpochSecond(time) : null);
            if (dashboardTest) {
                event.setStatus(WebhookEventStatus.IGNORED);
                event.setProcessedAt(Instant.now());
            }
            return transactionTemplate.execute(tx -> eventRepository.save(event).getId());
        } catch (DataIntegrityViolationException e) {
            return null; // hai request trùng đến cùng lúc — unique dedupe_key chặn, bản kia đã lưu
        } catch (Exception e) {
            log.error("[Webhook] Không lưu được thay đổi của Trang {}", pageId, e);
            return null;
        }
    }

    private void dispatch(UUID eventId) {
        try {
            eventWorker.process(eventId);
        } catch (TaskRejectedException e) {
            // Hàng đợi đầy: sự kiện vẫn PENDING → MetaWebhookEventJob xử lý lại sau ~2 phút.
            log.warn("[Webhook] Hàng đợi xử lý đầy — sự kiện {} chờ job quét lại", eventId);
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 không khả dụng", e);
        }
    }

    private static String cut(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    // Meta ký POST bằng HMAC-SHA256(app secret, raw body). Endpoint public → thiếu secret hoặc
    // thiếu chữ ký đều TỪ CHỐI (trước đây chấp nhận, cho phép giả event gỡ bài của người khác).
    private boolean isSignatureValid(String rawBody, String signature) {
        String appSecret = metaProperties.facebook() == null ? null : metaProperties.facebook().appSecret();
        if (!StringUtils.hasText(appSecret) || !StringUtils.hasText(signature)
                || !signature.startsWith(SIGNATURE_PREFIX)) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            byte[] provided = HexFormat.of().parseHex(signature.substring(SIGNATURE_PREFIX.length()));
            return MessageDigest.isEqual(expected, provided); // constant-time
        } catch (IllegalArgumentException e) {
            return false; // chữ ký không phải hex hợp lệ
        } catch (Exception e) {
            log.error("[Webhook] Không kiểm tra được chữ ký", e);
            return false;
        }
    }

    private static String truncate(String s) {
        if (s == null) {
            return "";
        }
        return s.length() > LOG_BODY_MAX ? s.substring(0, LOG_BODY_MAX) + "…" : s;
    }
}
