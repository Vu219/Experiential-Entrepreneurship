package com.aima.connection;

import com.aima.config.AimaProperties;
import com.aima.config.MetaProperties;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.UserRepository;
import com.aima.service.MetaApiClient;
import com.aima.service.Impl.MetaOAuthServiceImpl;
import com.aima.service.PlatformVersionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class MetaOAuthServiceImplTest {

    private MetaApiClient metaApiClient;
    private PlatformVersionService versionService;
    private PlatformAccountRepository accountRepository;
    private UserRepository userRepository;
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

        MetaProperties props = new MetaProperties(
                new MetaProperties.App("fbid", "fbsecret", "http://localhost/cb", "pages_show_list,instagram_basic"),
                new MetaProperties.App("thid", "thsecret", "http://localhost/thcb", "threads_basic"),
                "https://graph.facebook.com", "https://graph.threads.net", false);
        AimaProperties aima = new AimaProperties(
                new AimaProperties.Encryption("key"),
                new AimaProperties.OAuth(10, "http://fe/success", "http://fe/error"));

        service = new MetaOAuthServiceImpl(metaApiClient, versionService, accountRepository, userRepository,
                props, aima, redisTemplate, new ObjectMapper());

        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        lenient().when(versionService.getCurrentVersion(any())).thenReturn("v25.0");
    }

    @Test
    void buildAuthorizationUrl_facebook_containsClientAndState() {
        String url = service.buildAuthorizationUrl(Platform.FACEBOOK, UUID.randomUUID());

        assertTrue(url.contains("client_id=fbid"));
        assertTrue(url.contains("v25.0/dialog/oauth"));
        assertTrue(url.contains("state="));
        verify(valueOps).set(startsWith("oauth_state:"), anyString(), any());
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

    @Test
    void handleCallback_facebook_persistsUserAndPage() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().email("u@gmail.com").build();
        user.setId(userId);

        when(valueOps.get(anyString())).thenReturn(userId + "|FACEBOOK");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(metaApiClient.exchangeCodeForToken(eq(Platform.FACEBOOK), any()))
                .thenReturn(new MetaApiClient.MetaTokenResult("short", 3600L));
        when(metaApiClient.getLongLivedUserToken(eq(Platform.FACEBOOK), any()))
                .thenReturn(new MetaApiClient.MetaTokenResult("long", 5184000L));
        when(metaApiClient.getMe(eq(Platform.FACEBOOK), any()))
                .thenReturn(new MetaApiClient.MetaUser("me1", "Owner", null, null));
        when(metaApiClient.getMyAccounts(any()))
                .thenReturn(List.of(new MetaApiClient.MetaPage("p1", "Page", "ptok", "Brand")));
        when(metaApiClient.getInstagramBusinessAccount(any(), any())).thenReturn(Optional.empty());
        when(accountRepository.findByUser_IdAndPlatformNameAndPlatformAccountIdAndDeletedAtIsNull(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        List<PlatformAccount> created = service.handleCallback(Platform.FACEBOOK, "code", "state");

        assertEquals(2, created.size()); // user-level + 1 page
        verify(redisTemplate).delete(startsWith("oauth_state:"));
        verify(accountRepository, times(2)).save(any());
    }
}
