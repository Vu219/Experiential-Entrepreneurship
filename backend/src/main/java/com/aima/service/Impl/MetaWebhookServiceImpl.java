package com.aima.service.Impl;

import com.aima.config.MetaProperties;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.enums.ContentLifecycle;
import com.aima.enums.NotificationType;
import com.aima.enums.PostStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PostRepository;
import com.aima.service.MetaWebhookService;
import com.aima.service.NotificationService;
import com.aima.service.SystemLogService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;

/**
 * Webhook Meta (SEC-06/EX-02): thông báo vi phạm SAU khi đăng. Không có custom content filter —
 * chỉ phản ứng khi nền tảng báo bài bị gỡ: chuyển pipeline sang FAILED + notification cho chủ bài
 * (BR-07: không retry). Mọi event đều lưu SystemLog để admin soi lại (FR-84).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MetaWebhookServiceImpl implements MetaWebhookService {

    static final String SUBSCRIBE_MODE = "subscribe";
    // Giá trị value.item của feed webhook ứng với chính bài viết (không phải comment/reaction/share).
    static final Set<String> REMOVED_POST_ITEMS = Set.of("status", "post");
    static final String SIGNATURE_PREFIX = "sha256=";
    static final String LOG_MODULE = "webhook.meta";
    static final int LOG_BODY_MAX = 2000;

    MetaProperties metaProperties;
    PostRepository postRepository;
    NotificationService notificationService;
    SystemLogService systemLogService;
    ObjectMapper objectMapper;

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
    @Transactional
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

        // Lưu vết mọi event để admin soi lại (FR-84) — kể cả loại mình chưa xử lý.
        systemLogService.warn(LOG_MODULE, "Nhận event: " + truncate(rawBody));

        for (JsonNode entry : root.path("entry")) {
            for (JsonNode change : entry.path("changes")) {
                JsonNode value = change.path("value");
                String platformPostId = value.path("post_id").asText(null);
                String verb = value.path("verb").asText("");
                String item = value.path("item").asText("");
                // Chỉ phản ứng khi chính BÀI bị gỡ (item status/post). Xoá comment/reaction cũng
                // mang post_id + verb=remove nhưng bài vẫn còn — không được đánh FAILED.
                if (platformPostId == null || !"remove".equalsIgnoreCase(verb) || !REMOVED_POST_ITEMS.contains(item)) {
                    continue;
                }
                postRepository.findByPlatformPostIdAndDeletedAtIsNull(platformPostId)
                        .ifPresent(post -> markRemoved(post, platformPostId));
            }
        }
    }

    // EX-02 sau khi đăng: bài bị nền tảng gỡ → pipeline FAILED (BR-07: dừng, không retry) + báo user.
    private void markRemoved(Post post, String platformPostId) {
        post.setStatus(PostStatus.FAILED);
        PostSchedule schedule = post.getSchedule();
        schedule.setStatus(ScheduleStatus.FAILED);
        ContentVersion version = schedule.getContentVersion();
        version.setStatus(ContentLifecycle.FAILED);
        ContentItem item = version.getContentItem();
        item.setStatus(ContentLifecycle.FAILED);

        PlatformAccount account = schedule.getPlatformAccount();
        log.warn("[Webhook] Bài {} ({}) đã bị {} gỡ sau khi đăng", post.getId(), platformPostId, post.getPlatformName());
        systemLogService.warn(LOG_MODULE, "Bài " + post.getId() + " bị " + post.getPlatformName()
                + " gỡ sau khi đăng (platform post " + platformPostId + ")");
        notificationService.notify(account.getUser(), NotificationType.POST_FAILED,
                "Bài đã đăng bị nền tảng gỡ",
                post.getPlatformName() + " đã gỡ bài của bạn trên " + account.getAccountName()
                        + " (có thể do vi phạm chính sách). Hãy kiểm tra chi tiết trên nền tảng,"
                        + " chỉnh sửa nội dung rồi đăng lại nếu phù hợp.",
                post.getId());
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
