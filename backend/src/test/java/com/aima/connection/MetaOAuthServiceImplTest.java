package com.aima.connection;

import com.aima.config.AimaProperties;
import com.aima.config.MetaProperties;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.MetaApiClient;
import com.aima.service.MetaOAuthService;
import com.aima.service.NotificationService;
import com.aima.service.Impl.MetaOAuthServiceImpl;
import com.aima.service.PlatformVersionService;
import com.aima.service.ScheduleHoldService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class MetaOAuthServiceImplTest {

    private MetaApiClient metaApiClient;
    private PlatformVersionService versionService;
    private PlatformAccountRepository accountRepository;
    private UserRepository userRepository;
    private ScheduleHoldService holdService;
    private NotificationService notificationService;
    @SuppressWarnings("unchecked")
    private final RedisTemplate<String, String> redisTemplate = mock(RedisTemplate.class);
    @SuppressWarnings("unchecked")
    private final ValueOperations<String, String> valueOps = mock(ValueOperations.class);

    private MetaOAuthServiceImpl service;

    @BeforeEach
    void setUp() {
        metaApiClient = mock(MetaApiClient.class);
        versionService = mock(PlatformVersionService.class);
        accountRepository = mock(PlatformAccountRepository.class);
        userRepository = mock(UserRepository.class);
        holdService = mock(ScheduleHoldService.class);
        notificationService = mock(NotificationService.class);
        service = newService(null);

        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        lenient().when(versionService.getCurrentVersion(any())).thenReturn("v25.0");
    }

    private MetaOAuthServiceImpl newService(String facebookConfigId) {
        MetaProperties props = new MetaProperties(
                new MetaProperties.App("fbid", "fbsecret", "http://localhost/cb", "pages_show_list,instagram_basic",
                        facebookConfigId),
                new MetaProperties.App("thid", "thsecret", "http://localhost/thcb", "threads_basic", null),
                "https://graph.facebook.com", "https://graph.threads.net", false,
                new MetaProperties.Webhook("verify-token"));
        AimaProperties aima = new AimaProperties(
                new AimaProperties.Encryption("key"),
                new AimaProperties.OAuth(10, "http://fe/success", "http://fe/error"));
        return new MetaOAuthServiceImpl(mock(ActivityLogService.class), metaApiClient, versionService,
                accountRepository, userRepository, props, aima, redisTemplate, new ObjectMapper(),
                holdService, notificationService);
    }

    @Test
    void buildAuthorizationUrl_facebook_containsClientAndState() {
        String url = service.buildAuthorizationUrl(Platform.FACEBOOK, UUID.randomUUID());

        assertTrue(url.contains("client_id=fbid"));
        assertTrue(url.contains("v25.0/dialog/oauth"));
        assertTrue(url.contains("state="));
        assertTrue(url.contains("scope=pages_show_list,instagram_basic"));
        assertFalse(url.contains("config_id="));
        verify(valueOps).set(startsWith("oauth_state:"), anyString(), any());
    }

    @Test
    void buildAuthorizationUrl_facebook_withConfigId_sendsConfigIdInsteadOfScope() {
        String url = newService("123456789").buildAuthorizationUrl(Platform.FACEBOOK, UUID.randomUUID());

        assertTrue(url.contains("config_id=123456789"));
        assertFalse(url.contains("scope="));
        assertTrue(url.contains("response_type=code"));
        assertTrue(url.contains("redirect_uri=http://localhost/cb"));
        assertTrue(url.contains("state="));
    }

    @Test
    void buildAuthorizationUrl_threads_usesThreadsDomain() {
        String url = service.buildAuthorizationUrl(Platform.THREADS, UUID.randomUUID());
        assertTrue(url.contains("threads.net/oauth/authorize"));
        assertTrue(url.contains("client_id=thid"));
    }

    @Test
    void handleCallback_invalidState_throws() {
        when(valueOps.get(anyString())).thenReturn(null);

        AppException ex = assertThrows(AppException.class,
                () -> service.handleCallback(Platform.FACEBOOK, "code", "bad-state"));
        assertEquals(ErrorCode.INVALID_OAUTH_STATE, ex.getErrorCode());
    }

    private User stubFacebookCallback(List<String> grantedPermissions) {
        UUID userId = UUID.randomUUID();
        User user = User.builder().email("u@gmail.com").build();
        user.setId(userId);

        when(valueOps.get(anyString())).thenReturn(userId + "|FACEBOOK");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(metaApiClient.exchangeCodeForToken(eq(Platform.FACEBOOK), any()))
                .thenReturn(new MetaApiClient.MetaTokenResult("short", 3600L));
        when(metaApiClient.getLongLivedUserToken(eq(Platform.FACEBOOK), any()))
                .thenReturn(new MetaApiClient.MetaTokenResult("long", 5184000L));
        when(metaApiClient.getGrantedPermissions("long")).thenReturn(grantedPermissions);
        lenient().when(metaApiClient.getMe(eq(Platform.FACEBOOK), any()))
                .thenReturn(new MetaApiClient.MetaUser("me1", "Owner", null, null));
        lenient().when(metaApiClient.getMyAccounts(any()))
                .thenReturn(List.of(new MetaApiClient.MetaPage("p1", "Page", "ptok", "Brand")));
        lenient().when(metaApiClient.getInstagramBusinessAccount(any(), any())).thenReturn(Optional.empty());
        lenient().when(accountRepository.findByUser_IdAndPlatformNameAndPlatformAccountIdAndDeletedAtIsNull(any(), any(), any()))
                .thenReturn(Optional.empty());
        lenient().when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        return user;
    }

    @Test
    void handleCallback_facebook_persistsUserAndPageWithGrantedScopes() {
        stubFacebookCallback(List.of("pages_show_list", "pages_manage_posts", "public_profile"));

        List<PlatformAccount> created = service.handleCallback(Platform.FACEBOOK, "code", "state");

        assertEquals(2, created.size()); // user-level + 1 page
        verify(redisTemplate).delete(startsWith("oauth_state:"));
        verify(accountRepository, times(2)).save(any());
        // Scope lưu = quyền user thực cấp, KHÔNG phải scope trong config (instagram_basic).
        assertEquals("[\"pages_show_list\",\"pages_manage_posts\",\"public_profile\"]", created.get(0).getScopes());
        assertEquals(created.get(0).getScopes(), created.get(1).getScopes());
    }

    @Test
    void handleCallback_facebook_instagramLookupFails_stillSavesPage() {
        stubFacebookCallback(List.of("pages_show_list", "pages_manage_posts"));
        // Như lỗi thật 28/9: Graph code 2500 khi tra instagram_business_account của Page.
        when(metaApiClient.getInstagramBusinessAccount("p1", "ptok"))
                .thenThrow(new AppException(ErrorCode.META_API_ERROR));

        List<PlatformAccount> created = service.handleCallback(Platform.FACEBOOK, "code", "state");

        assertEquals(2, created.size(), "USER + Page vẫn được lưu, chỉ bỏ qua IG");
        assertEquals(PlatformAccountType.PAGE, created.get(1).getAccountType());
        assertEquals("p1", created.get(1).getPlatformAccountId());
        verify(accountRepository, times(2)).save(any());
    }

    @Test
    void handleCallback_facebook_missingPagePermission_throwsAndSavesNothing() {
        stubFacebookCallback(List.of("pages_show_list", "public_profile")); // bỏ tick pages_manage_posts

        AppException ex = assertThrows(AppException.class,
                () -> service.handleCallback(Platform.FACEBOOK, "code", "state"));

        assertEquals(ErrorCode.META_MISSING_PERMISSIONS, ex.getErrorCode());
        verify(accountRepository, never()).save(any());
        verify(metaApiClient, never()).getMyAccounts(any());
    }

    // ---------- Disconnect / Meta callbacks ----------

    private PlatformAccount account(String platformId, PlatformAccountType type, PlatformAccount parent, User owner) {
        PlatformAccount a = new PlatformAccount();
        a.setId(UUID.randomUUID());
        a.setUser(owner);
        a.setPlatformName(Platform.FACEBOOK);
        a.setPlatformAccountId(platformId);
        a.setAccountName("acc-" + platformId);
        a.setAccountType(type);
        a.setAccessToken("secret-token-" + platformId);
        a.setRefreshToken("refresh-" + platformId);
        a.setConnectionStatus(ConnectionStatus.ACTIVE);
        a.setParentConnection(parent);
        return a;
    }

    /** Cây: user-level root → Page → IG; Page có 2 lịch SCHEDULED. */
    private record Tree(PlatformAccount root, PlatformAccount page, PlatformAccount ig, List<PostSchedule> pageSchedules) {
    }

    private Tree stubTree(String fbUserId) {
        User owner = User.builder().email("owner@gmail.com").build();
        owner.setId(UUID.randomUUID());
        PlatformAccount root = account(fbUserId, PlatformAccountType.USER, null, owner);
        PlatformAccount page = account("page1", PlatformAccountType.PAGE, root, owner);
        PlatformAccount ig = account("ig1", PlatformAccountType.BUSINESS_ACCOUNT, page, owner);
        PostSchedule s1 = new PostSchedule();
        s1.setStatus(ScheduleStatus.SCHEDULED);
        PostSchedule s2 = new PostSchedule();
        s2.setStatus(ScheduleStatus.SCHEDULED);

        lenient().when(accountRepository.findByPlatformNameAndAccountTypeAndPlatformAccountIdAndDeletedAtIsNull(
                Platform.FACEBOOK, PlatformAccountType.USER, fbUserId)).thenReturn(List.of(root));
        lenient().when(accountRepository.findByParentConnection_IdAndDeletedAtIsNull(root.getId())).thenReturn(List.of(page));
        lenient().when(accountRepository.findByParentConnection_IdAndDeletedAtIsNull(page.getId())).thenReturn(List.of(ig));
        lenient().when(accountRepository.findByParentConnection_IdAndDeletedAtIsNull(ig.getId())).thenReturn(List.of());
        // Tạm giữ thật (khóa bài + resolver) được kiểm ở PostScheduleServiceImplTest; ở đây chỉ mô phỏng kết quả.
        lenient().doAnswer(i -> {
            java.util.Collection<UUID> ids = i.getArgument(0);
            if (!ids.contains(page.getId())) {
                return 0;
            }
            s1.setStatus(ScheduleStatus.ON_HOLD);
            s2.setStatus(ScheduleStatus.ON_HOLD);
            return 2;
        }).when(holdService).holdForAccounts(any(), any());
        lenient().when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(accountRepository.findWithUserByIdAndUserId(root.getId(), owner.getId())).thenReturn(Optional.of(root));
        for (PlatformAccount a : List.of(root, page, ig)) {
            lenient().when(accountRepository.findByIdAndDeletedAtIsNull(a.getId())).thenReturn(Optional.of(a));
        }
        return new Tree(root, page, ig, List.of(s1, s2));
    }

    @Test
    void deleteFacebookUserData_softDeletesTreeScrubsTokensAndHoldsSchedules() {
        Tree t = stubTree("fb-user-1");

        MetaOAuthService.CleanupResult result = service.deleteFacebookUserData("fb-user-1");

        assertEquals(3, result.connections());
        assertEquals(2, result.schedulesHeld());
        for (PlatformAccount a : List.of(t.root(), t.page(), t.ig())) {
            assertNotNull(a.getDeletedAt());
            assertEquals(ConnectionStatus.DISCONNECTED, a.getConnectionStatus());
            assertEquals("", a.getAccessToken());
            assertNull(a.getRefreshToken());
        }
        t.pageSchedules().forEach(s -> assertEquals(ScheduleStatus.ON_HOLD, s.getStatus()));
        verify(notificationService).notify(eq(t.root().getUser()), any(), any(), any(), any());
        verify(metaApiClient, never()).revokeToken(any(), any()); // user đã gỡ app — không gọi Meta
    }

    @Test
    void deleteFacebookUserData_unknownUser_isNoOp() {
        when(accountRepository.findByPlatformNameAndAccountTypeAndPlatformAccountIdAndDeletedAtIsNull(any(), any(), any()))
                .thenReturn(List.of());

        MetaOAuthService.CleanupResult result = service.deleteFacebookUserData("nobody");

        assertEquals(0, result.connections());
        assertEquals(0, result.schedulesHeld());
        verify(accountRepository, never()).save(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void revokeFacebookUser_marksTreeRevokedKeepsRowsAndHoldsSchedules() {
        Tree t = stubTree("fb-user-2");

        MetaOAuthService.CleanupResult result = service.revokeFacebookUser("fb-user-2");

        assertEquals(3, result.connections());
        assertEquals(2, result.schedulesHeld());
        for (PlatformAccount a : List.of(t.root(), t.page(), t.ig())) {
            assertEquals(ConnectionStatus.REVOKED, a.getConnectionStatus());
            assertNull(a.getDeletedAt()); // giữ bản ghi: kết nối lại sẽ upsert đúng dòng cũ
        }
        t.pageSchedules().forEach(s -> assertEquals(ScheduleStatus.ON_HOLD, s.getStatus()));
    }

    @Test
    void disconnect_root_revokesRemotelyHoldsSchedulesAndScrubsTokens() {
        Tree t = stubTree("fb-user-3");

        service.disconnect(t.root().getUser().getId(), t.root().getId());

        verify(metaApiClient).revokeToken(Platform.FACEBOOK, "secret-token-fb-user-3");
        t.pageSchedules().forEach(s -> assertEquals(ScheduleStatus.ON_HOLD, s.getStatus()));
        assertEquals("", t.page().getAccessToken());
        assertNotNull(t.ig().getDeletedAt());
    }

    @Test
    void disconnect_connectionOfAnotherUser_throwsNotFoundAndTouchesNothing() {
        Tree t = stubTree("fb-other");

        AppException ex = assertThrows(AppException.class,
                () -> service.disconnect(UUID.randomUUID(), t.root().getId()));

        assertEquals(ErrorCode.CONNECTION_NOT_FOUND, ex.getErrorCode());
        assertNull(t.root().getDeletedAt());
        verify(metaApiClient, never()).revokeToken(any(), any());
    }

    private static void assertDisconnected(Tree t) {
        for (PlatformAccount a : List.of(t.root(), t.page(), t.ig())) {
            assertNotNull(a.getDeletedAt());
            assertEquals(ConnectionStatus.DISCONNECTED, a.getConnectionStatus());
            assertEquals("", a.getAccessToken());
            assertNull(a.getRefreshToken());
        }
        t.pageSchedules().forEach(s -> assertEquals(ScheduleStatus.ON_HOLD, s.getStatus()));
    }

    @Test
    void disconnect_tokenExpired_skipsRevokeAndStillDeletes() {
        Tree t = stubTree("fb-exp");
        t.root().setTokenExpiredAt(LocalDateTime.now().minusDays(1));

        service.disconnect(t.root().getUser().getId(), t.root().getId());

        verify(metaApiClient, never()).revokeToken(any(), any());
        assertDisconnected(t);
    }

    @Test
    void disconnect_statusExpiredOrRevoked_skipsRevoke() {
        for (ConnectionStatus status : List.of(ConnectionStatus.EXPIRED, ConnectionStatus.REVOKED)) {
            Tree t = stubTree("fb-" + status);
            t.root().setConnectionStatus(status);

            service.disconnect(t.root().getUser().getId(), t.root().getId());

            assertDisconnected(t);
        }
        verify(metaApiClient, never()).revokeToken(any(), any());
    }

    @Test
    void disconnect_metaReturns190_stillDeletes() {
        Tree t = stubTree("fb-190");
        doThrow(new AppException(ErrorCode.META_TOKEN_INVALID)).when(metaApiClient).revokeToken(any(), any());

        assertDoesNotThrow(() -> service.disconnect(t.root().getUser().getId(), t.root().getId()));

        assertDisconnected(t);
    }

    @Test
    void disconnect_metaTimeout_stillDeletes() {
        Tree t = stubTree("fb-timeout");
        doThrow(new RuntimeException(new TimeoutException("Did not observe any item within 5000ms")))
                .when(metaApiClient).revokeToken(any(), any());

        assertDoesNotThrow(() -> service.disconnect(t.root().getUser().getId(), t.root().getId()));

        assertDisconnected(t);
    }

    @Test
    void disconnect_inTransaction_revokesOnlyAfterCommitWithOriginalToken() {
        Tree t = stubTree("fb-tx");
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.disconnect(t.root().getUser().getId(), t.root().getId());

            verify(metaApiClient, never()).revokeToken(any(), any()); // chưa commit → chưa gọi Meta
            assertEquals("", t.root().getAccessToken());

            doThrow(new RuntimeException("network down")).when(metaApiClient).revokeToken(any(), any());
            assertDoesNotThrow(() -> TransactionSynchronizationManager.getSynchronizations()
                    .forEach(TransactionSynchronization::afterCommit));
            verify(metaApiClient).revokeToken(Platform.FACEBOOK, "secret-token-fb-tx");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // ---------- validate ----------

    @Test
    void validate_graphCode190_marksRevoked() {
        Tree t = stubTree("fb-v1");
        when(metaApiClient.getMe(any(), any())).thenThrow(new AppException(ErrorCode.META_TOKEN_INVALID));

        PlatformAccount result = service.validate(t.page().getId());

        assertEquals(ConnectionStatus.REVOKED, result.getConnectionStatus());
    }

    @Test
    void validate_transientGraphError_keepsStatusAndThrows() {
        Tree t = stubTree("fb-v2");
        when(metaApiClient.getMe(any(), any())).thenThrow(new AppException(ErrorCode.META_API_ERROR)); // 5xx/rate limit

        AppException ex = assertThrows(AppException.class, () -> service.validate(t.page().getId()));

        assertEquals(ErrorCode.CONNECTION_VALIDATION_FAILED, ex.getErrorCode());
        assertEquals(ConnectionStatus.ACTIVE, t.page().getConnectionStatus());
        verify(accountRepository, never()).save(t.page());
    }

    @Test
    void validate_networkError_keepsStatusAndThrows() {
        Tree t = stubTree("fb-v3");
        when(metaApiClient.getMe(any(), any())).thenThrow(new RuntimeException("Connection reset"));

        AppException ex = assertThrows(AppException.class, () -> service.validate(t.page().getId()));

        assertEquals(ErrorCode.CONNECTION_VALIDATION_FAILED, ex.getErrorCode());
        assertEquals(ConnectionStatus.ACTIVE, t.page().getConnectionStatus());
    }
}
