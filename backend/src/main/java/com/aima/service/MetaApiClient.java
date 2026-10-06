package com.aima.service;

import com.aima.enums.Platform;

import java.util.List;
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

    record MetaPostMetrics(Long views, Long likes, Long comments, Long shares, Long saves) {
    }
}
