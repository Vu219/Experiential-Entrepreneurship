package com.aima.connection;

import com.aima.config.AimaProperties;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlatformConnectionMapper;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.UserRepository;
import com.aima.service.Impl.PlatformConnectionServiceImpl;
import com.aima.service.MetaOAuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PlatformConnectionServiceImplTest {

    private MetaOAuthService metaOAuthService;
    private PlatformConnectionServiceImpl service;

    @BeforeEach
    void setUp() {
        metaOAuthService = mock(MetaOAuthService.class);
        AimaProperties aima = new AimaProperties(
                new AimaProperties.Encryption("key"),
                new AimaProperties.OAuth(10,
                        "http://fe/settings?tab=connections&status=success",
                        "http://fe/settings?tab=connections&error=oauth_failed"));
        service = new PlatformConnectionServiceImpl(metaOAuthService, mock(PlatformAccountRepository.class),
                mock(UserRepository.class), mock(PlatformConnectionMapper.class), aima,
                mock(com.aima.repository.AccountSyncStateRepository.class),
                mock(com.aima.service.PlatformAvailabilityService.class),
                mock(org.springframework.data.redis.core.RedisTemplate.class),
                new com.fasterxml.jackson.databind.ObjectMapper());
    }

    @Test
    void callback_missingPermissions_redirectsWithDedicatedErrorCode() {
        when(metaOAuthService.handleCallback(any(), anyString(), anyString()))
                .thenThrow(new AppException(ErrorCode.META_MISSING_PERMISSIONS));

        String redirect = service.handleCallbackRedirect(Platform.FACEBOOK, "code", "state", null);

        assertEquals("http://fe/settings?tab=connections&error=missing_permissions", redirect);
    }

    /** Nền tảng vừa bị khoá toàn hệ thống / gói không gồm nền tảng trong lúc user ở dialog Meta → mã lỗi riêng cho FE. */
    @Test
    void callback_platformLockedOrNotInPlan_redirectsWithDedicatedErrorCodes() {
        when(metaOAuthService.handleCallback(any(), anyString(), anyString()))
                .thenThrow(new AppException(ErrorCode.PLATFORM_CONNECTION_DISABLED))
                .thenThrow(new AppException(ErrorCode.PLAN_FEATURE_NOT_INCLUDED));

        assertEquals("http://fe/settings?tab=connections&error=platform_disabled",
                service.handleCallbackRedirect(Platform.THREADS, "code", "state", null));
        assertEquals("http://fe/settings?tab=connections&error=plan_platform",
                service.handleCallbackRedirect(Platform.THREADS, "code", "state", null));
    }

    @Test
    void callback_otherFailure_redirectsWithGenericError() {
        when(metaOAuthService.handleCallback(any(), anyString(), anyString()))
                .thenThrow(new AppException(ErrorCode.OAUTH_FAILED));

        String redirect = service.handleCallbackRedirect(Platform.FACEBOOK, "code", "state", null);

        assertEquals("http://fe/settings?tab=connections&error=oauth_failed", redirect);
    }
}
