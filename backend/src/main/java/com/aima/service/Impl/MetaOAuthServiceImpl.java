package com.aima.service.Impl;

import com.aima.service.ActivityLogService;
import com.aima.service.AnalyticsAccountSyncService;
import com.aima.enums.ActivityAction;
import com.aima.config.AimaProperties;
import com.aima.config.MetaProperties;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.NotificationType;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.TokenType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.UserRepository;
import com.aima.service.MetaApiClient;
import com.aima.service.MetaOAuthService;
import com.aima.service.NotificationService;
import com.aima.service.PlatformVersionService;
import com.aima.service.ScheduleHoldService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class MetaOAuthServiceImpl implements MetaOAuthService {

    ActivityLogService activityLogService;

    MetaApiClient metaApiClient;
    PlatformVersionService versionService;
    PlatformAccountRepository accountRepository;
    UserRepository userRepository;
    MetaProperties metaProperties;
    AimaProperties aimaProperties;
    RedisTemplate<String, String> redisTemplate;
    ObjectMapper objectMapper;
    ScheduleHoldService holdService;
    NotificationService notificationService;
    AnalyticsAccountSyncService analyticsAccountSyncService;

    private static final String STATE_PREFIX = "oauth_state:";

    // Thiếu một trong hai → không liệt kê/đăng được lên Page → từ chối kết nối (missing_permissions).
    static final List<String> REQUIRED_FACEBOOK_PERMISSIONS = List.of("pages_show_list", "pages_manage_posts");

    // Giá trị ghi đè access_token khi kết nối bị xoá (cột NOT NULL, vẫn đi qua converter mã hoá).
    static final String SCRUBBED_TOKEN = "";

    // ---------- Authorization URL ----------

    @Override
    public String buildAuthorizationUrl(Platform platform, UUID userId) {
        String state = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
                STATE_PREFIX + state,
                userId + "|" + platform.name(),
                Duration.ofMinutes(aimaProperties.oauth().stateTtlMinutes()));

        if (platform == Platform.THREADS) {
            MetaProperties.App app = metaProperties.threads();
            return UriComponentsBuilder.fromUriString("https://threads.net/oauth/authorize")
                    .queryParam("client_id", app.appId())
                    .queryParam("redirect_uri", app.redirectUri())
                    .queryParam("scope", app.scopes())
                    .queryParam("response_type", "code")
                    .queryParam("state", state)
                    .toUriString();
        }

        // Facebook và Instagram đều dùng Facebook Login dialog (IG business gắn với FB Page).
        MetaProperties.App app = metaProperties.facebook();
        String version = versionService.getCurrentVersion(Platform.FACEBOOK);
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString("https://www.facebook.com")
                .pathSegment(version, "dialog", "oauth")
                .queryParam("client_id", app.appId())
                .queryParam("redirect_uri", app.redirectUri());
        // Facebook Login for Business: quyền nằm trong cấu hình config_id → không gửi scope.
        if (StringUtils.hasText(app.configId())) {
            builder.queryParam("config_id", app.configId());
        } else {
            builder.queryParam("scope", app.scopes());
        }
        return builder
                .queryParam("response_type", "code")
                .queryParam("state", state)
                .toUriString();
    }

    // ---------- Callback ----------

    @Override
    public List<PlatformAccount> handleCallback(Platform platform, String code, String state) {
        String stateKey = STATE_PREFIX + state;
        String stored = redisTemplate.opsForValue().get(stateKey);
        if (stored == null) {
            throw new AppException(ErrorCode.INVALID_OAUTH_STATE);
        }
        redisTemplate.delete(stateKey);

        UUID userId = UUID.fromString(stored.split("\\|")[0]);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        try {
            List<PlatformAccount> connected = platform == Platform.THREADS
                    ? handleThreadsCallback(user, code)
                    : handleFacebookCallback(user, code);
            // Một lần liên kết có thể sinh nhiều kết nối (user + từng Page + IG) — ghi MỘT dòng
            // cho cả thao tác, kèm số kết nối, thay vì làm ngập log bằng mỗi Page một dòng.
            activityLogService.record(ActivityLogService.Entry.of(
                    ActivityAction.SOCIAL_CONNECTED, user.getId(), user.getEmail(),
                    "PlatformAccount", platform.name())
                    .withMetadata(Map.of("platform", platform.name(), "connections", connected.size())));
            // Kết nối lại chỉ gỡ ACCOUNT_ISSUE; lịch còn lý do khác (chưa duyệt, quá giờ...) vẫn giữ.
            holdService.releaseForAccounts(connected.stream().map(PlatformAccount::getId).toList(), HoldReason.ACCOUNT_ISSUE);
            return connected;
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("[OAuth] Callback {} thất bại", platform, e);
            throw new AppException(ErrorCode.OAUTH_FAILED);
        }
    }

    private List<PlatformAccount> handleFacebookCallback(User user, String code) {
        List<PlatformAccount> created = new ArrayList<>();

        MetaApiClient.MetaTokenResult shortToken = metaApiClient.exchangeCodeForToken(Platform.FACEBOOK, code);
        MetaApiClient.MetaTokenResult longToken = metaApiClient.getLongLivedUserToken(Platform.FACEBOOK, shortToken.accessToken());

        // Lưu quyền user THỰC SỰ cấp (user có thể bỏ tick trong dialog), không phải scope trong config.
        List<String> granted = metaApiClient.getGrantedPermissions(longToken.accessToken());
        List<String> missing = REQUIRED_FACEBOOK_PERMISSIONS.stream().filter(p -> !granted.contains(p)).toList();
        if (!missing.isEmpty()) {
            log.warn("[OAuth] User {} thiếu quyền Facebook bắt buộc {} — không lưu kết nối", user.getId(), missing);
            throw new AppException(ErrorCode.META_MISSING_PERMISSIONS);
        }
        String grantedCsv = String.join(",", granted);

        MetaApiClient.MetaUser me = metaApiClient.getMe(Platform.FACEBOOK, longToken.accessToken());

        PlatformAccount userConn = upsert(user, Platform.FACEBOOK, me.id(),
                me.name() != null ? me.name() : "Facebook User", me.username(), me.pictureUrl(),
                PlatformAccountType.USER, TokenType.LONG_LIVED_USER_TOKEN,
                longToken.accessToken(), null, expiry(longToken.expiresInSeconds()),
                grantedCsv, null);
        created.add(userConn);

        List<MetaApiClient.MetaPage> pages = metaApiClient.getMyAccounts(longToken.accessToken());
        List<UUID> pageConnectionIds = new ArrayList<>();
        if (pages.isEmpty()) {
            // Đủ quyền nhưng /me/accounts rỗng = user không chọn Trang nào trong dialog (Facebook Login
            // for Business chỉ trả các Trang được cấp) → chỉ có kết nối USER, không đăng bài được.
            log.warn("[OAuth] User {} kết nối Facebook nhưng Meta trả 0 Trang (/me/accounts rỗng) — chỉ lưu kết nối USER",
                    user.getId());
        }
        for (MetaApiClient.MetaPage page : pages) {
            PlatformAccount pageConn = upsert(user, Platform.FACEBOOK, page.id(),
                    page.name(), null, null,
                    PlatformAccountType.PAGE, TokenType.PAGE_TOKEN,
                    page.accessToken(), null, null,
                    grantedCsv, userConn);
            created.add(pageConn);
            pageConnectionIds.add(pageConn.getId());

            // Best-effort: Page vẫn được lưu (đăng Facebook được) dù không tra được IG Business —
            // callback chỉ được thất bại ở bước đổi token / đọc quyền / /me/accounts.
            Optional<MetaApiClient.MetaIgAccount> ig;
            Boolean igLinked;
            try {
                ig = metaApiClient.getInstagramBusinessAccount(page.id(), page.accessToken());
                igLinked = ig.isPresent();
            } catch (Exception e) {
                log.warn("[OAuth] Không lấy được Instagram Business của Page {} — bỏ qua IG, vẫn lưu Page: {}",
                        page.id(), MetaApiClientImpl.mask(String.valueOf(e.getMessage())));
                ig = Optional.empty();
                igLinked = null; // không tra được ≠ chưa liên kết
            }
            // Trang không có IG Business = IG cá nhân / chưa liên kết → Cài đặt hiện hướng dẫn (analytics GĐ2).
            analyticsAccountSyncService.recordInstagramLink(pageConn, igLinked);
            if (ig.isPresent()) {
                MetaApiClient.MetaIgAccount account = ig.get();
                PlatformAccount igConn = upsert(user, Platform.INSTAGRAM, account.id(),
                        account.name() != null ? account.name() : account.username(), account.username(),
                        account.profilePictureUrl(),
                        PlatformAccountType.BUSINESS_ACCOUNT, TokenType.PAGE_TOKEN,
                        page.accessToken(), null, null,
                        grantedCsv, pageConn);
                created.add(igConn);
            }
        }
        // Đăng ký app nhận webhook "feed" của từng Trang (analytics giai đoạn 3) — SAU commit, ngoài transaction (rule #24).
        // Best-effort: thiếu pages_manage_metadata thì chỉ ghi lỗi, lượt đồng bộ cấp kênh tự thử lại.
        runAfterCommit(() -> pageConnectionIds.forEach(id -> {
            try {
                analyticsAccountSyncService.ensureWebhookSubscribed(id);
            } catch (Exception e) {
                log.warn("[OAuth] Không đăng ký được webhook cho kết nối {}: {}", id,
                        MetaApiClientImpl.mask(String.valueOf(e.getMessage())));
            }
        }));
        return created;
    }

    private List<PlatformAccount> handleThreadsCallback(User user, String code) {
        MetaApiClient.MetaTokenResult shortToken = metaApiClient.exchangeCodeForToken(Platform.THREADS, code);
        MetaApiClient.MetaTokenResult longToken = metaApiClient.getLongLivedUserToken(Platform.THREADS, shortToken.accessToken());
        MetaApiClient.MetaUser me = metaApiClient.getMe(Platform.THREADS, longToken.accessToken());

        PlatformAccount conn = upsert(user, Platform.THREADS, me.id(),
                me.name() != null ? me.name() : me.username(), me.username(), me.pictureUrl(),
                PlatformAccountType.PERSONAL, TokenType.LONG_LIVED_USER_TOKEN,
                longToken.accessToken(), null, expiry(longToken.expiresInSeconds()),
                metaProperties.threads().scopes(), null);
        return List.of(conn);
    }

    // Upsert: tránh vi phạm unique index khi kết nối lại — cập nhật bản ghi cũ nếu đã tồn tại.
    private PlatformAccount upsert(User user, Platform platform, String platformAccountId,
                                   String accountName, String username, String avatarUrl,
                                   PlatformAccountType accountType, TokenType tokenType,
                                   String accessToken, String refreshToken, LocalDateTime expiry,
                                   String scopesCsv, PlatformAccount parent) {
        PlatformAccount account = accountRepository
                .findByUser_IdAndPlatformNameAndPlatformAccountIdAndDeletedAtIsNull(user.getId(), platform, platformAccountId)
                .orElseGet(PlatformAccount::new);

        account.setUser(user);
        account.setPlatformName(platform);
        account.setPlatformAccountId(platformAccountId);
        account.setAccountName(accountName != null ? accountName : platform.name());
        account.setPlatformUsername(username);
        account.setAvatarUrl(avatarUrl);
        account.setAccountType(accountType);
        account.setTokenType(tokenType);
        account.setAccessToken(accessToken);
        account.setRefreshToken(refreshToken);
        account.setTokenIssuedAt(LocalDateTime.now());
        account.setTokenExpiredAt(expiry);
        account.setScopes(toJsonScopes(scopesCsv));
        account.setApiVersionUsed(versionService.getCurrentVersion(platform));
        account.setLastValidatedAt(LocalDateTime.now());
        account.setLastSyncAt(LocalDateTime.now());
        account.setConnectionStatus(ConnectionStatus.ACTIVE);
        account.setParentConnection(parent);
        boolean created = account.getId() == null;
        PlatformAccount saved = accountRepository.save(account);
        if (created) {
            // Kết nối lại sau khi ngắt (dòng cũ đã xoá mềm) → mang lịch sử số liệu sang kết nối mới (không tạo bản trùng).
            analyticsAccountSyncService.adoptPreviousConnections(saved);
        }
        return saved;
    }

    // ---------- Validate / Refresh / Disconnect ----------

    @Override
    public PlatformAccount validate(UUID connectionId) {
        PlatformAccount account = findConnection(connectionId);
        try {
            metaApiClient.getMe(account.getPlatformName(), account.getAccessToken());
            account.setConnectionStatus(ConnectionStatus.ACTIVE);
            account.setLastValidatedAt(LocalDateTime.now());
        } catch (AppException e) {
            if (e.getErrorCode() != ErrorCode.META_TOKEN_INVALID) {
                throw validationFailed(account, e);
            }
            // Chỉ Graph code 190 (token hết hạn/bị thu hồi) mới là bằng chứng kết nối đã mất.
            log.warn("[OAuth] Kết nối {} bị nền tảng từ chối token (190) → REVOKED", account.getId());
            account.setConnectionStatus(ConnectionStatus.REVOKED);
        } catch (Exception e) {
            throw validationFailed(account, e);
        }
        PlatformAccount saved = accountRepository.save(account);
        syncAccountIssueHolds(saved);
        return saved;
    }

    @Override
    public PlatformAccount refresh(UUID connectionId) {
        PlatformAccount account = findConnection(connectionId);
        // Page token không hết hạn → chỉ validate lại.
        if (account.getTokenType() == TokenType.PAGE_TOKEN) {
            return validate(connectionId);
        }
        try {
            MetaApiClient.MetaTokenResult refreshed =
                    metaApiClient.getLongLivedUserToken(account.getPlatformName(), account.getAccessToken());
            account.setAccessToken(refreshed.accessToken());
            account.setTokenIssuedAt(LocalDateTime.now());
            account.setTokenExpiredAt(expiry(refreshed.expiresInSeconds()));
            account.setConnectionStatus(ConnectionStatus.ACTIVE);
            account.setLastValidatedAt(LocalDateTime.now());
            PlatformAccount saved = accountRepository.save(account);
            syncAccountIssueHolds(saved);
            return saved;
        } catch (Exception e) {
            log.warn("[OAuth] Refresh token kết nối {} thất bại: {}", account.getId(), e.getMessage());
            throw new AppException(ErrorCode.TOKEN_REFRESH_FAILED);
        }
    }

    @Override
    public void disconnect(UUID userId, UUID connectionId) {
        // Load lại TRONG transaction này (kèm user) — entity từ lớp gọi đã detached, đụng lazy proxy
        // là LazyInitializationException. Mọi thứ đưa vào afterCommit chỉ là giá trị primitive.
        PlatformAccount account = accountRepository.findWithUserByIdAndUserId(connectionId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.CONNECTION_NOT_FOUND));
        // Chỉ revoke ở kết nối gốc (user-level) để tránh revoke trùng cho từng Page. Đọc token TRƯỚC
        // khi scrub; gọi Meta sau commit để lỗi/treo phía Meta không rollback việc xoá local.
        if (account.getParentConnection() == null && isRevocable(account)) {
            Platform platform = account.getPlatformName();
            String token = account.getAccessToken();
            UUID accountId = account.getId();
            runAfterCommit(() -> {
                try {
                    metaApiClient.revokeToken(platform, token);
                } catch (Exception e) {
                    log.warn("[OAuth] Revoke token khi disconnect {} thất bại (đã xoá local): {}",
                            accountId, MetaApiClientImpl.mask(String.valueOf(e.getMessage())));
                }
            });
        }
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SOCIAL_DISCONNECTED, account.getUser().getEmail(),
                "PlatformAccount", account.getId().toString(),
                Map.of("platform", account.getPlatformName().name(),
                        "accountName", String.valueOf(account.getAccountName()))));
        List<PlatformAccount> tree = subtree(account);
        holdSchedules(account.getUser(), tree, HoldReason.ACCOUNT_REMOVED, "Bạn đã ngắt kết nối " + account.getAccountName()
                + " trên " + account.getPlatformName() + ".");
        softDeleteAndScrub(tree);
    }

    @Override
    public CleanupResult deleteFacebookUserData(String platformUserId) {
        int connections = 0;
        int held = 0;
        for (PlatformAccount root : findFacebookRoots(platformUserId)) {
            List<PlatformAccount> tree = subtree(root);
            held += holdSchedules(root.getUser(), tree, HoldReason.ACCOUNT_REMOVED, "Theo yêu cầu xoá dữ liệu gửi từ Facebook, AIMA đã xoá kết nối "
                    + root.getAccountName() + " cùng các Trang/tài khoản liên quan.");
            softDeleteAndScrub(tree);
            connections += tree.size();
        }
        log.info("[OAuth] Data deletion Meta: xoá {} kết nối, tạm giữ {} lịch", connections, held);
        return new CleanupResult(connections, held);
    }

    @Override
    public CleanupResult revokeFacebookUser(String platformUserId) {
        int connections = 0;
        int held = 0;
        for (PlatformAccount root : findFacebookRoots(platformUserId)) {
            List<PlatformAccount> tree = subtree(root);
            held += holdSchedules(root.getUser(), tree, HoldReason.ACCOUNT_ISSUE, "AIMA đã bị gỡ khỏi tài khoản Facebook " + root.getAccountName()
                    + ", các kết nối liên quan không còn hiệu lực.");
            for (PlatformAccount account : tree) {
                account.setConnectionStatus(ConnectionStatus.REVOKED);
                accountRepository.save(account);
            }
            connections += tree.size();
        }
        log.info("[OAuth] Deauthorize Meta: {} kết nối → REVOKED, tạm giữ {} lịch", connections, held);
        return new CleanupResult(connections, held);
    }

    @Override
    public void revokeAllForUserAfterCommit(UUID userId) {
        // Đọc token (đã giải mã) NGAY: sau commit các dòng platform_accounts đã bị xoá cứng.
        List<PlatformAccount> roots = accountRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream().filter(a -> a.getParentConnection() == null).toList();
        List<Map.Entry<Platform, String>> tokens = roots.stream()
                .map(a -> Map.entry(a.getPlatformName(), a.getAccessToken())).toList();
        if (tokens.isEmpty()) {
            return;
        }
        Runnable revokeAll = () -> tokens.forEach(t -> {
            try {
                metaApiClient.revokeToken(t.getKey(), t.getValue());
            } catch (Exception e) {
                log.warn("[OAuth] Revoke token khi xoá tài khoản {} thất bại (bỏ qua): {}", userId, e.getMessage());
            }
        });
        runAfterCommit(revokeAll);
    }

    // Token đã hết hạn/bị thu hồi thì Meta chắc chắn trả 190 — không tốn một lượt gọi.
    private static boolean isRevocable(PlatformAccount account) {
        ConnectionStatus status = account.getConnectionStatus();
        LocalDateTime expiredAt = account.getTokenExpiredAt();
        return status != ConnectionStatus.EXPIRED && status != ConnectionStatus.REVOKED
                && (expiredAt == null || expiredAt.isAfter(LocalDateTime.now()))
                && StringUtils.hasText(account.getAccessToken());
    }

    // Gọi Meta NGOÀI transaction DB (rule #24) và chỉ khi việc xoá đã commit.
    private static void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private PlatformAccount findConnection(UUID connectionId) {
        return accountRepository.findByIdAndDeletedAtIsNull(connectionId)
                .orElseThrow(() -> new AppException(ErrorCode.CONNECTION_NOT_FOUND));
    }

    private List<PlatformAccount> findFacebookRoots(String platformUserId) {
        return accountRepository.findByPlatformNameAndAccountTypeAndPlatformAccountIdAndDeletedAtIsNull(
                Platform.FACEBOOK, PlatformAccountType.USER, platformUserId);
    }

    /** Kết nối gốc + toàn bộ Page/IG con (đệ quy), gốc đứng đầu. */
    private List<PlatformAccount> subtree(PlatformAccount root) {
        List<PlatformAccount> tree = new ArrayList<>();
        tree.add(root);
        for (PlatformAccount child : accountRepository.findByParentConnection_IdAndDeletedAtIsNull(root.getId())) {
            tree.addAll(subtree(child));
        }
        return tree;
    }

    // Soft delete (giữ bản ghi cho lịch/bài đã tham chiếu) nhưng XOÁ token: kết nối đã ngắt thì
    // không còn lý do giữ credential, kể cả khi đã mã hoá (Threads không có revoke từ xa).
    private void softDeleteAndScrub(List<PlatformAccount> accounts) {
        LocalDateTime now = LocalDateTime.now();
        for (PlatformAccount account : accounts) {
            account.setDeletedAt(now);
            account.setConnectionStatus(ConnectionStatus.DISCONNECTED);
            account.setAccessToken(SCRUBBED_TOKEN);
            account.setRefreshToken(null);
            accountRepository.save(account);
        }
    }

    /** Lịch chưa đăng của các kết nối nhận lý do tạm giữ (FR-18b); báo user một lần nếu có lịch bị giữ. */
    private int holdSchedules(User user, List<PlatformAccount> accounts, HoldReason holdReason, String reason) {
        int held = holdService.holdForAccounts(accounts.stream().map(PlatformAccount::getId).toList(), holdReason);
        if (held > 0) {
            notificationService.notify(user, NotificationType.RECONNECT_NEEDED,
                    "Bài đã lên lịch được tạm giữ",
                    reason + " " + held + " bài đã lên lịch được chuyển sang Tạm giữ (On Hold) — hãy kết nối lại"
                            + " hoặc hủy các bài này trong Lịch đăng.",
                    null);
        }
        return held;
    }

    // Xác thực/làm mới xong: ACTIVE → gỡ ACCOUNT_ISSUE; REVOKED → thêm ACCOUNT_ISSUE cho lịch chưa đăng.
    private void syncAccountIssueHolds(PlatformAccount account) {
        List<UUID> ids = List.of(account.getId());
        if (account.getConnectionStatus() == ConnectionStatus.ACTIVE) {
            holdService.releaseForAccounts(ids, HoldReason.ACCOUNT_ISSUE);
        } else {
            holdService.holdForAccounts(ids, HoldReason.ACCOUNT_ISSUE);
        }
    }

    // ---------- Helpers ----------

    // Lỗi mạng/timeout/5xx/rate limit: KHÔNG đổi trạng thái kết nối (có thể chỉ là sự cố tạm thời).
    private AppException validationFailed(PlatformAccount account, Exception cause) {
        log.warn("[OAuth] Validate kết nối {} không kết luận được, giữ trạng thái {}: {}",
                account.getId(), account.getConnectionStatus(), cause.getMessage());
        return new AppException(ErrorCode.CONNECTION_VALIDATION_FAILED);
    }

    private LocalDateTime expiry(Long expiresInSeconds) {
        return expiresInSeconds == null ? null : LocalDateTime.now().plusSeconds(expiresInSeconds);
    }

    private String toJsonScopes(String scopesCsv) {
        if (scopesCsv == null || scopesCsv.isBlank()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(Arrays.stream(scopesCsv.split(",")).map(String::trim).toList());
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }
}
