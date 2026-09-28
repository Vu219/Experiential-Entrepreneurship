package com.aima.connection;

import com.aima.config.MetaProperties;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.DataDeletionStatusResponse;
import com.aima.dto.response.MetaDataDeletionCallbackResponse;
import com.aima.entity.MetaDataDeletionRequest;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlatformConnectionMapperImpl;
import com.aima.repository.MetaDataDeletionRequestRepository;
import com.aima.service.Impl.MetaDataDeletionServiceImpl;
import com.aima.service.MetaOAuthService;
import com.aima.service.SystemLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MetaDataDeletionServiceImplTest {

    private static final String SECRET = "fb-app-secret";
    private static final String PAYLOAD = "{\"algorithm\":\"HMAC-SHA256\",\"issued_at\":1727400000,\"user_id\":\"fb-42\"}";

    private MetaOAuthService metaOAuthService;
    private MetaDataDeletionRequestRepository repository;
    private MetaDataDeletionServiceImpl service;

    @BeforeEach
    void setUp() {
        metaOAuthService = mock(MetaOAuthService.class);
        repository = mock(MetaDataDeletionRequestRepository.class);
        MetaProperties props = new MetaProperties(
                new MetaProperties.App("fbid", SECRET, "http://localhost/cb", "", null),
                new MetaProperties.App("thid", "thsecret", "http://localhost/thcb", "", null),
                "https://graph.facebook.com", "https://graph.threads.net", false,
                new MetaProperties.Webhook("verify-token"));
        service = new MetaDataDeletionServiceImpl(metaOAuthService, repository, new PlatformConnectionMapperImpl(),
                props, mock(SystemLogService.class), new ObjectMapper());
        ReflectionTestUtils.setField(service, "frontendBaseUrl", "https://aima-marketing.id.vn");
    }

    @Test
    void requestDeletion_validSignature_cleansUpAndReturnsMetaShapedBody() throws Exception {
        when(metaOAuthService.deleteFacebookUserData("fb-42")).thenReturn(new MetaOAuthService.CleanupResult(3, 2));

        MetaDataDeletionCallbackResponse body = service.requestDeletion(MetaSignedRequestTest.sign(PAYLOAD, SECRET));

        ArgumentCaptor<MetaDataDeletionRequest> saved = ArgumentCaptor.forClass(MetaDataDeletionRequest.class);
        verify(repository).save(saved.capture());
        assertEquals(3, saved.getValue().getConnectionsRemoved());
        assertEquals(2, saved.getValue().getSchedulesHeld());
        assertNotNull(saved.getValue().getCompletedAt());
        assertNull(saved.getValue().getId());

        String code = saved.getValue().getConfirmationCode();
        assertEquals(code, body.getConfirmationCode());
        assertEquals("https://aima-marketing.id.vn/data-deletion?code=" + code, body.getUrl());

        // Meta đọc hai trường ở cấp cao nhất — kiểm bằng Jackson 3 (serializer tầng HTTP của app).
        String json = new tools.jackson.databind.ObjectMapper().writeValueAsString(body);
        assertTrue(json.contains("\"confirmation_code\":\"" + code + "\""), json);
        assertTrue(json.contains("\"url\":"), json);
    }

    @Test
    void requestDeletion_badSignature_rejectedWithoutTouchingData() throws Exception {
        AppException ex = assertThrows(AppException.class,
                () -> service.requestDeletion(MetaSignedRequestTest.sign(PAYLOAD, "forged-secret")));

        assertEquals(ErrorCode.INVALID_SIGNED_REQUEST, ex.getErrorCode());
        verifyNoInteractions(metaOAuthService);
        verify(repository, never()).save(any());
    }

    @Test
    void getStatus_knownCode_returnsCompleted() {
        MetaDataDeletionRequest request = new MetaDataDeletionRequest();
        request.setConfirmationCode("abc");
        request.setConnectionsRemoved(3);
        request.setSchedulesHeld(1);
        request.setCreatedAt(LocalDateTime.of(2026, 9, 27, 10, 0));
        request.setCompletedAt(LocalDateTime.of(2026, 9, 27, 10, 0, 1));
        when(repository.findByConfirmationCodeAndDeletedAtIsNull("abc")).thenReturn(Optional.of(request));

        ApiResponse<DataDeletionStatusResponse> response = service.getStatus("abc");

        assertEquals("COMPLETED", response.getResult().getStatus());
        assertEquals(request.getCreatedAt(), response.getResult().getRequestedAt());
        assertEquals(3, response.getResult().getConnectionsRemoved());
    }

    @Test
    void getStatus_unknownCode_notFound() {
        when(repository.findByConfirmationCodeAndDeletedAtIsNull("nope")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> service.getStatus("nope"));
        assertEquals(ErrorCode.DATA_DELETION_REQUEST_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void deauthorize_validSignature_revokesConnections() throws Exception {
        when(metaOAuthService.revokeFacebookUser("fb-42")).thenReturn(new MetaOAuthService.CleanupResult(2, 0));

        service.deauthorize(MetaSignedRequestTest.sign(PAYLOAD, SECRET));

        verify(metaOAuthService).revokeFacebookUser("fb-42");
    }

    @Test
    void deauthorize_badSignature_rejected() {
        assertThrows(AppException.class, () -> service.deauthorize("garbage.payload"));
        verifyNoInteractions(metaOAuthService);
    }
}
