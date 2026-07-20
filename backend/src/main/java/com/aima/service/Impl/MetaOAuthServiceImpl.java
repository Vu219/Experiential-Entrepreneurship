package com.aima.service.Impl;

import com.aima.service.ActivityLogService;
import com.aima.enums.ActivityAction;
import com.aima.config.AimaProperties;
import com.aima.config.MetaProperties;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.TokenType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.UserRepository;
import com.aima.service.MetaApiClient;
import com.aima.service.MetaOAuthService;
import com.aima.service.PlatformVersionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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

    private static final String STATE_PREFIX = "oauth_state:";

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
        return UriComponentsBuilder.fromUriString("https://www.facebook.com")
                .pathSegment(version, "dialog", "oauth")
                .queryParam("client_id", app.appId())
                .queryParam("redirect_uri", app.redirectUri())
                .queryParam("scope", app.scopes())
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
        MetaApiClient.MetaUser me = metaApiClient.getMe(Platform.FACEBOOK, longToken.accessToken());

        PlatformAccount userConn = upsert(user, Platform.FACEBOOK, me.id(),
                me.name() != null ? me.name() : "Facebook User", me.username(), me.pictureUrl(),
                PlatformAccountType.USER, TokenType.LONG_LIVED_USER_TOKEN,
                longToken.accessToken(), null, expiry(longToken.expiresInSeconds()),
                metaProperties.facebook().scopes(), null);
        created.add(userConn);

        for (MetaApiClient.MetaPage page : metaApiClient.getMyAccounts(longToken.accessToken())) {
            PlatformAccount pageConn = upsert(user, Platform.FACEBOOK, page.id(),
                    page.name(), null, null,
                    PlatformAccountType.PAGE, TokenType.PAGE_TOKEN,
                    page.accessToken(), null, null,
                    metaProperties.facebook().scopes(), userConn);
            created.add(pageConn);

            Optional<MetaApiClient.MetaIgAccount> ig =
                    metaApiClient.getInstagramBusinessAccount(page.id(), page.accessToken());
            if (ig.isPresent()) {
                MetaApiClient.MetaIgAccount account = ig.get();
                PlatformAccount igConn = upsert(user, Platform.INSTAGRAM, account.id(),
                        account.name() != null ? account.name() : account.username(), account.username(),
                        account.profilePictureUrl(),
                        PlatformAccountType.BUSINESS_ACCOUNT, TokenType.PAGE_TOKEN,
                        page.accessToken(), null, null,
                        metaProperties.facebook().scopes(), pageConn);
                created.add(igConn);
            }
        }
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
        return accountRepository.save(account);
    }

    // ---------- Validate / Refresh / Disconnect ----------

    @Override
    public PlatformAccount validate(PlatformAccount account) {
        try {
            metaApiClient.getMe(account.getPlatformName(), account.getAccessToken());
            account.setConnectionStatus(ConnectionStatus.ACTIVE);
            account.setLastValidatedAt(LocalDateTime.now());
        } catch (Exception e) {
            log.warn("[OAuth] Validate kết nối {} thất bại: {}", account.getId(), e.getMessage());
            account.setConnectionStatus(ConnectionStatus.REVOKED);
        }
        return accountRepository.save(account);
    }

    @Override
    public PlatformAccount refresh(PlatformAccount account) {
        // Page token không hết hạn → chỉ validate lại.
        if (account.getTokenType() == TokenType.PAGE_TOKEN) {
            return validate(account);
        }
        try {
            MetaApiClient.MetaTokenResult refreshed =
                    metaApiClient.getLongLivedUserToken(account.getPlatformName(), account.getAccessToken());
            account.setAccessToken(refreshed.accessToken());
            account.setTokenIssuedAt(LocalDateTime.now());
            account.setTokenExpiredAt(expiry(refreshed.expiresInSeconds()));
            account.setConnectionStatus(ConnectionStatus.ACTIVE);
            account.setLastValidatedAt(LocalDateTime.now());
            return accountRepository.save(account);
        } catch (Exception e) {
            log.warn("[OAuth] Refresh token kết nối {} thất bại: {}", account.getId(), e.getMessage());
            throw new AppException(ErrorCode.TOKEN_REFRESH_FAILED);
        }
    }

    @Override
    public void disconnect(PlatformAccount account) {
        // Chỉ revoke ở kết nối gốc (user-level) để tránh revoke trùng cho từng Page.
        if (account.getParentConnection() == null) {
            try {
                metaApiClient.revokeToken(account.getPlatformName(), account.getAccessToken());
            } catch (Exception e) {
                log.warn("[OAuth] Revoke token khi disconnect thất bại (vẫn soft delete): {}", e.getMessage());
            }
        }
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SOCIAL_DISCONNECTED, account.getUser().getEmail(),
                "PlatformAccount", account.getId().toString(),
                Map.of("platform", account.getPlatformName().name(),
                        "accountName", String.valueOf(account.getAccountName()))));
        softDeleteCascade(account);
    }

    private void softDeleteCascade(PlatformAccount account) {
        for (PlatformAccount child : accountRepository.findByParentConnection_IdAndDeletedAtIsNull(account.getId())) {
            softDeleteCascade(child);
        }
        account.setDeletedAt(LocalDateTime.now());
        account.setConnectionStatus(ConnectionStatus.DISCONNECTED);
        accountRepository.save(account);
    }

    // ---------- Helpers ----------

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
