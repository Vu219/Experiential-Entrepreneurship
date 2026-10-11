package com.aima.service.Impl;

import com.aima.dto.publish.PublishFailureNotice;
import com.aima.entity.User;
import com.aima.enums.NotificationType;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import com.aima.repository.UserRepository;
import com.aima.service.EmailService;
import com.aima.service.NotificationPreferenceService;
import com.aima.service.NotificationService;
import com.aima.service.PublishFailureNotifier;
import com.aima.util.EmailConsentPolicy;
import com.aima.util.PublishReference;
import com.aima.util.PublishingTime;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Câu thông báo theo MÃ CHUẨN (một nguồn) — notification hiện lưu câu tiếng Việt cố định như mọi loại
 * thông báo khác (docs/failed-posts-error-handling-plan.md §2.2). Không ghép message gốc của nền tảng.
 *
 * <ul>
 *   <li>Lỗi cấp tài khoản → {@code RECONNECT_NEEDED} (chuông dẫn tới Cài đặt), refId = kết nối,
 *       dedupe {@code publish-account:{account}:{code}:{ngày}} — nhiều bài cùng nguyên nhân chỉ một thông báo.</li>
 *   <li>Lỗi của riêng bài → {@code POST_FAILED} (chuông dẫn tới trang Bài lỗi), refId = bài,
 *       dedupe {@code publish-failed:{job}} — chạy lại không gửi lặp.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PublishFailureNotifierImpl implements PublishFailureNotifier {

    static final String RECONNECT_PATH = "/settings?tab=connections";
    static final String RECONNECT_LABEL = "Kết nối lại tài khoản";
    static final String FAILED_POSTS_PATH = "/failed-posts";
    static final String FAILED_POSTS_LABEL = "Mở trang Bài lỗi & cần xử lý";
    /** Email cho lỗi của riêng bài: tối đa MỘT email/người dùng/ngày (khoá Redis), tránh dội hộp thư. */
    static final String POST_EMAIL_KEY = "publish-email:post:";
    static final DateTimeFormatter EXPIRY_FORMAT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    UserRepository userRepository;
    NotificationService notificationService;
    EmailService emailService;
    NotificationPreferenceService preferenceService;
    StringRedisTemplate redisTemplate;

    // Công tắc máy chủ cho email lỗi đăng bài — mặc định TẮT; còn cần người dùng đồng ý (EmailConsentPolicy).
    @NonFinal
    @Value("${aima.notifications.publish-email-enabled:false}")
    boolean emailEnabled;

    /** Tiêu đề + lý do + bước tiếp theo của một mã. {account}/{platform} được thay khi gửi. */
    private record Copy(String title, String reason, String nextStep) {
    }

    @Override
    public void notifyFailure(PublishFailureNotice notice, int heldSchedules) {
        try {
            User user = userRepository.findById(notice.userId()).orElse(null);
            if (user == null) {
                return;
            }
            PublishErrorCode code = notice.code();
            Copy copy = copyOf(code);
            String held = heldSchedules > 0 ? " " + heldSchedules + " bài đã lên lịch của tài khoản này được tạm giữ." : "";
            String message = fill(copy.reason(), notice) + held + " " + fill(copy.nextStep(), notice)
                    + " Mã tham chiếu: " + PublishReference.of(notice.jobId()) + ".";
            if (code.isAccountLevel()) {
                String dedupeKey = "publish-account:" + notice.accountId() + ":" + code.name() + ":"
                        + LocalDate.now(PublishingTime.LEGACY_ZONE);
                boolean created = notificationService.notifyOnce(user, NotificationType.RECONNECT_NEEDED, copy.title(),
                        message, notice.accountId(), dedupeKey);
                if (created) {
                    email(user, copy.title(), message, RECONNECT_LABEL, RECONNECT_PATH, null);
                }
            } else {
                boolean created = notificationService.notifyOnce(user, NotificationType.POST_FAILED, copy.title(),
                        message, notice.postId(), "publish-failed:" + notice.jobId());
                if (created) {
                    email(user, "Có bài đăng cần bạn xử lý", copy.title() + ". " + message, FAILED_POSTS_LABEL,
                            FAILED_POSTS_PATH, POST_EMAIL_KEY + user.getId() + ":" + LocalDate.now(PublishingTime.LEGACY_ZONE));
                }
            }
        } catch (Exception e) {
            log.error("[PublishNotify] Không gửi được thông báo bài lỗi {} (job {})", notice.postId(), notice.jobId(), e);
        }
    }

    @Override
    public void notifyTokenExpiring(UUID userId, UUID accountId, String accountName, Platform platform,
                                    LocalDateTime expiresAt) {
        try {
            User user = userRepository.findById(userId).orElse(null);
            if (user == null || expiresAt == null) {
                return;
            }
            String title = "Kết nối sắp hết hạn";
            String message = "Kết nối " + platformName(platform) + " của " + (accountName == null ? "tài khoản" : accountName)
                    + " sẽ hết hạn lúc " + EXPIRY_FORMAT.format(expiresAt) + " và AIMA chưa tự gia hạn được. "
                    + "Hãy kết nối lại trong Cài đặt → Kết nối để các bài đã lên lịch không bị lỗi.";
            boolean created = notificationService.notifyOnce(user, NotificationType.RECONNECT_NEEDED, title, message,
                    accountId, "token-expiring:" + accountId + ":" + expiresAt.toLocalDate());
            if (created) {
                email(user, title, message, RECONNECT_LABEL, RECONNECT_PATH, null);
            }
        } catch (Exception e) {
            log.error("[PublishNotify] Không gửi được nhắc token sắp hết hạn cho kết nối {}", accountId, e);
        }
    }

    /**
     * CHỖ DUY NHẤT gửi email lỗi đăng bài: kiểm tra công tắc máy chủ + đồng ý của người dùng TRƯỚC khi gọi Brevo
     * ({@link EmailConsentPolicy}); {@code dailyKey} ≠ null → tối đa một email/ngày cho khoá đó. Best-effort: Brevo
     * lỗi không ảnh hưởng thông báo trong app đã tạo. Mỗi email có link huỷ nhận + header List-Unsubscribe.
     */
    private void email(User user, String title, String message, String actionLabel, String actionPath, String dailyKey) {
        if (!EmailConsentPolicy.shouldSend(emailEnabled, preferenceService.preferenceOf(user.getId()), user.getEmail())) {
            return;
        }
        if (dailyKey != null && !claimDaily(dailyKey)) {
            return;
        }
        try {
            emailService.sendPublishActionRequiredEmail(user.getEmail(), user.getFullName(), title, message,
                    actionLabel, actionPath, preferenceService.unsubscribeToken(user.getId()));
        } catch (Exception e) {
            log.warn("[PublishNotify] Không gửi được email cho user {}: {}", user.getId(), e.getMessage());
        }
    }

    // Redis lỗi → bỏ email (thà thiếu một email tóm tắt còn hơn dội hộp thư người dùng).
    private boolean claimDaily(String key) {
        try {
            return Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(key, "1", Duration.ofDays(2)));
        } catch (Exception e) {
            log.warn("[PublishNotify] Không giữ được khoá email {}: {}", key, e.getMessage());
            return false;
        }
    }

    private static String fill(String template, PublishFailureNotice notice) {
        return template.replace("{account}", notice.accountName() == null ? "tài khoản" : notice.accountName())
                .replace("{platform}", platformName(notice.platform()));
    }

    static String platformName(Platform platform) {
        if (platform == null) {
            return "nền tảng";
        }
        return switch (platform) {
            case FACEBOOK -> "Facebook";
            case INSTAGRAM -> "Instagram";
            case THREADS -> "Threads";
        };
    }

    // Câu thông báo (tiếng Việt) — cùng ý với catalog FE (frontend/src/api/publishErrorCatalog.ts).
    static Copy copyOf(PublishErrorCode code) {
        return switch (code) {
            case POLICY_VIOLATION -> new Copy("Bài bị từ chối do vi phạm chính sách",
                    "{platform} từ chối bài viết trên {account} vì nội dung vi phạm chính sách của nền tảng.",
                    "Hệ thống không tự đăng lại — hãy sửa nội dung rồi đăng lại trong trang Bài lỗi & cần xử lý.");
            case POLICY_TEMPORARY_BLOCK -> new Copy("Tài khoản bị tạm chặn đăng bài",
                    "{platform} đang tạm chặn {account} đăng bài do nghi ngờ vi phạm chính sách.",
                    "Hãy kiểm tra thông báo trên {platform}, chờ hết thời gian chặn rồi xác thực lại kết nối và thử lại.");
            case AUTH_TOKEN_EXPIRED -> new Copy("Cần kết nối lại tài khoản",
                    "Phiên kết nối {platform} của {account} đã hết hạn hoặc bị thu hồi nên AIMA không đăng bài được.",
                    "Hãy kết nối lại trong Cài đặt → Kết nối, sau đó thử lại các bài lỗi.");
            case AUTH_PASSWORD_CHANGED -> new Copy("Cần kết nối lại tài khoản",
                    "Tài khoản {account} trên {platform} vừa đổi mật khẩu nên kết nối cũ không còn hiệu lực.",
                    "Hãy kết nối lại trong Cài đặt → Kết nối, sau đó thử lại các bài lỗi.");
            case AUTH_APP_REMOVED -> new Copy("Cần kết nối lại tài khoản",
                    "AIMA đã bị gỡ khỏi tài khoản {account} trên {platform}.",
                    "Hãy kết nối lại trong Cài đặt → Kết nối, sau đó thử lại các bài lỗi.");
            case AUTH_PERMISSION_MISSING -> new Copy("Thiếu quyền đăng bài",
                    "AIMA chưa được cấp đủ quyền để đăng lên {account} ({platform}).",
                    "Hãy kết nối lại và bật đủ các quyền AIMA yêu cầu, sau đó thử lại các bài lỗi.");
            case AUTH_PAGE_ROLE_MISSING -> new Copy("Thiếu quyền quản lý Trang",
                    "Tài khoản đã kết nối không còn vai trò quản lý trên Trang {account}.",
                    "Hãy nhờ quản trị viên Trang cấp lại vai trò, rồi kết nối lại và thử lại các bài lỗi.");
            case ACCOUNT_CHECKPOINT -> new Copy("Tài khoản cần xác minh",
                    "{platform} yêu cầu xác minh tài khoản {account} trước khi cho đăng bài.",
                    "Hãy đăng nhập {platform} để hoàn tất xác minh, rồi xác thực lại kết nối và thử lại.");
            case ACCOUNT_RESTRICTED -> new Copy("Tài khoản bị nền tảng hạn chế",
                    "{platform} đang hạn chế tài khoản {account} nên không đăng được bài.",
                    "Hãy xử lý hạn chế trên {platform}, rồi xác thực lại kết nối và thử lại.");
            case ACCOUNT_DISCONNECTED -> new Copy("Kết nối không còn hiệu lực",
                    "Kết nối {account} trên {platform} đã bị ngắt hoặc không còn hoạt động.",
                    "Hãy kết nối lại hoặc đổi tài khoản đăng trong Lịch đăng.");
            case ACCOUNT_TYPE_UNSUPPORTED -> new Copy("Facebook chỉ cho đăng lên Trang",
                    "Bài được lên lịch vào tài khoản cá nhân {account}, nơi Facebook không cho ứng dụng đăng bài.",
                    "Hãy huỷ lịch và lên lịch lại vào một Trang Facebook.");
            case RATE_LIMITED, PLATFORM_TEMPORARY, PLATFORM_OUTAGE, NETWORK_TIMEOUT, PUBLISH_INTERRUPTED ->
                    new Copy("Đăng bài thất bại sau nhiều lần thử",
                            "{platform} tạm thời không nhận bài cho {account}; AIMA đã tự thử lại nhưng chưa thành công.",
                            "Bạn có thể bấm \"Thử lại ngay\" trong trang Bài lỗi & cần xử lý.");
            case QUOTA_EXCEEDED -> new Copy("Đã chạm hạn mức đăng bài",
                    "{account} đã dùng hết số bài {platform} cho phép đăng trong 24 giờ.",
                    "Hãy thử lại sau khi hạn mức được làm mới.");
            case CONTENT_TOO_LONG -> new Copy("Nội dung vượt giới hạn của nền tảng",
                    "Caption hoặc số hashtag của bản {platform} vượt giới hạn nền tảng cho phép.",
                    "Hãy rút gọn nội dung rồi đăng lại trong trang Bài lỗi & cần xử lý.");
            case CONTENT_DUPLICATE -> new Copy("Bài bị trùng với bài vừa đăng",
                    "{platform} từ chối vì nội dung giống hệt bài vừa đăng trên {account}.",
                    "Hãy chỉnh nội dung cho khác đi rồi đăng lại.");
            case CONTENT_INVALID -> new Copy("Nội dung bài chưa hợp lệ",
                    "{platform} không chấp nhận nội dung bài viết (ví dụ liên kết hoặc định dạng không hợp lệ).",
                    "Hãy kiểm tra và sửa nội dung rồi đăng lại.");
            case MEDIA_REQUIRED -> new Copy("Bài cần ảnh/video hợp lệ",
                    "{platform} yêu cầu ảnh/video khi đăng bài, trong khi AIMA hiện chỉ đăng bài dạng chữ.",
                    "Hãy dùng media prompt để tự tạo ảnh/video và đăng thủ công, hoặc lên lịch bài này cho Facebook/Threads.");
            case MEDIA_INVALID -> new Copy("Ảnh/video không hợp lệ",
                    "{platform} không xử lý được ảnh/video của bài.",
                    "Hãy kiểm tra định dạng, thời lượng, tỷ lệ khung hình rồi đăng lại.");
            case PLATFORM_UNSUPPORTED, INTERNAL_ERROR, UNKNOWN -> new Copy("Đăng bài thất bại do lỗi hệ thống",
                    "Đăng lên {platform} ({account}) thất bại do một lỗi AIMA chưa xử lý được.",
                    "Lỗi đã được ghi nhận cho quản trị viên; bạn có thể thử lại sau hoặc gửi mã tham chiếu cho hỗ trợ.");
        };
    }
}
