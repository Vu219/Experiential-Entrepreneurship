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
                mock(com.aima.repository.AccountSyncStateRepository.class));
    }

    @Test
    void callback_missingPermissions_redirectsWithDedicatedErrorCode() {
        when(metaOAuthService.handleCallback(any(), anyString(), anyString()))
                .thenThrow(new AppException(ErrorCode.META_MISSING_PERMISSIONS));

        String redirect = service.handleCallbackRedirect(Platform.FACEBOOK, "code", "state", null);

        assertEquals("http://fe/settings?tab=connections&error=missing_permissions", redirect);
    }

    @Test
    void callback_otherFailure_redirectsWithGenericError() {
        when(metaOAuthService.handleCallback(any(), anyString(), anyString()))
                .thenThrow(new AppException(ErrorCode.OAUTH_FAILED));

        String redirect = service.handleCallbackRedirect(Platform.FACEBOOK, "code", "state", null);

        assertEquals("http://fe/settings?tab=connections&error=oauth_failed", redirect);
    }
}
