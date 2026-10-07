package com.aima.service;

import com.aima.enums.Platform;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Wrapper duy nhất để gọi Meta API (Graph + Threads). Version lấy động từ {@link PlatformVersionService}
 * (KHÔNG hardcode trong code). Mọi log đều che (mask) token & app secret.
 */
public interface MetaApiClient {

    MetaTokenResult exchangeCodeForToken(Platform platform, String code);

    MetaTokenResult getLongLivedUserToken(Platform platform, String shortLivedToken);

    /** Danh sách Facebook Page mà user quản lý (mỗi Page kèm page access token). */
    List<MetaPage> getMyAccounts(String userToken);

    /** Instagram Business Account gắn với một Page (nếu có). */
    Optional<MetaIgAccount> getInstagramBusinessAccount(String pageId, String pageToken);

    /** Quyền user THỰC SỰ đã cấp: GET /me/permissions, chỉ lấy status=granted. */
    List<String> getGrantedPermissions(String userToken);

    /** Hồ sơ cơ bản của token hiện tại (dùng để validate). */
    MetaUser getMe(Platform platform, String token);

    void revokeToken(Platform platform, String token);

    /** appsecret_proof = HMAC-SHA256(token, appSecret) hex — bắt buộc ở production. */
    String generateAppSecretProof(String token, String appSecret);

    // --- Đăng bài (FR-53/FR-54) — lỗi ném PublishException kèm mã lỗi gốc + phân loại (FR-35/FR-37) ---

    /** Đăng bài text lên Facebook Page: POST /{page-id}/feed (dùng page token). */
    MetaPostResult publishPagePost(String pageId, String pageToken, String message);

    /** Đăng bài text lên Threads: tạo container (media_type=TEXT) rồi publish. */
    MetaPostResult publishThreadsPost(String token, String text);

    /**
     * FR-59: số liệu tương tác của một bài đã đăng. Metric nền tảng không cung cấp → null
     * (Threads không có saves; FB Page cần read_insights cho views — thiếu quyền thì views null).
     * FB: {@code likes} = tổng MỌI cảm xúc (reactions), views = {@code post_media_view}.
     * Lỗi nền tảng ném {@link com.aima.exception.MetricsFetchException} đã phân loại
     * (NOT_FOUND / RATE_LIMIT / PERMISSION / TOKEN_INVALID / UNSUPPORTED / ...) để job quyết định backoff.
     */
    MetaPostMetrics getPostMetrics(Platform platform, String platformPostId, String token);

    // --- Số liệu cấp Trang (analytics giai đoạn 2) — lỗi ném MetricsFetchException đã phân loại ---

    /**
     * Mọi bài đã đăng của Trang từ {@code since} (kể cả bài người dùng tự đăng ngoài AIMA):
     * {@code GET /{page-id}/published_posts}, phân trang theo cursor, có trần số trang. Cần pages_read_engagement.
     */
    List<MetaPublishedPost> getPagePublishedPosts(String pageId, String pageToken, Instant since);

    /**
     * Insights theo NGÀY của Trang trong [{@code since}, {@code until}] (tối đa 90 ngày, ngày theo giờ Thái Bình
     * Dương như Meta tính): {@code GET /{page-id}/insights?period=day}. Metric bị Meta từ chối (đã khai tử) được bỏ
     * qua kèm log ERROR, không làm mất các metric còn lại. Cần read_insights.
     */
    MetaPageInsights getPageInsights(String pageId, String pageToken, LocalDate since, LocalDate until);

    /** Tổng người theo dõi hiện tại của Trang ({@code ?fields=followers_count}); null khi Meta không trả. */
    Long getPageFollowersCount(String pageId, String pageToken);

    /**
     * Đăng ký app nhận webhook của Trang: {@code POST /{page-id}/subscribed_apps?subscribed_fields=...} (giai đoạn 3).
     * Cần pages_manage_metadata. Lỗi ném {@link com.aima.exception.MetricsFetchException} đã phân loại.
     */
    void subscribePageWebhook(String pageId, String pageToken, String subscribedFields);

    // --- Kết quả trả về ---
    record MetaTokenResult(String accessToken, Long expiresInSeconds) {
    }

    record MetaPage(String id, String name, String accessToken, String category) {
    }

    record MetaIgAccount(String id, String username, String name, String profilePictureUrl) {
    }

    record MetaUser(String id, String name, String username, String pictureUrl) {
    }

    record MetaPostResult(String platformPostId) {
    }

    /** {@code raw} = phản hồi gốc (JSON) của nền tảng, lưu vào snapshot để tính lại khi Meta đổi metric. */
    record MetaPostMetrics(Long views, Long likes, Long comments, Long shares, Long saves, String raw) {
    }

    /**
     * Một bài của Trang. {@code attachmentType} = {@code attachments.media_type} của Graph (photo/video/album/
     * link...), null khi bài không có đính kèm; {@code attachmentTypeKnown} = false khi Meta từ chối trường
     * attachments nên không biết loại nội dung.
     */
    record MetaPublishedPost(String id, Instant createdTime, String permalinkUrl, String message,
                             String attachmentType, boolean attachmentTypeKnown) {
    }

    /** Giá trị theo ngày của từng metric: tên metric → (ngày → giá trị). Metric không có số thì vắng mặt. */
    record MetaPageInsights(Map<String, Map<LocalDate, Long>> values) {
    }
}
