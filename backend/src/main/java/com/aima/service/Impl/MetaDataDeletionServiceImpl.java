package com.aima.service.Impl;

import com.aima.config.MetaProperties;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.DataDeletionStatusResponse;
import com.aima.dto.response.MetaDataDeletionCallbackResponse;
import com.aima.entity.MetaDataDeletionRequest;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlatformConnectionMapper;
import com.aima.repository.MetaDataDeletionRequestRepository;
import com.aima.service.MetaDataDeletionService;
import com.aima.service.MetaOAuthService;
import com.aima.service.SystemLogService;
import com.aima.util.MetaSignedRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MetaDataDeletionServiceImpl implements MetaDataDeletionService {

    static final String LOG_MODULE = "meta.data-deletion";

    MetaOAuthService metaOAuthService;
    MetaDataDeletionRequestRepository deletionRequestRepository;
    PlatformConnectionMapper connectionMapper;
    MetaProperties metaProperties;
    SystemLogService systemLogService;
    ObjectMapper objectMapper;

    @NonFinal
    @Value("${app.frontend.base-url}")
    String frontendBaseUrl;

    @Override
    @Transactional
    public MetaDataDeletionCallbackResponse requestDeletion(String signedRequest) {
        String platformUserId = verify(signedRequest);
        // Chỉ thao tác DB (không gọi Meta: user đã gỡ app nên token vốn không còn hiệu lực).
        MetaOAuthService.CleanupResult result = metaOAuthService.deleteFacebookUserData(platformUserId);

        String confirmationCode = UUID.randomUUID().toString().replace("-", "");
        MetaDataDeletionRequest request = connectionMapper.toDataDeletionRequest(
                confirmationCode, result.connections(), result.schedulesHeld(), LocalDateTime.now());
        deletionRequestRepository.save(request);
        systemLogService.info(LOG_MODULE, "Xử lý yêu cầu xoá dữ liệu Meta " + confirmationCode + ": xoá "
                + result.connections() + " kết nối, tạm giữ " + result.schedulesHeld() + " lịch");

        String statusUrl = UriComponentsBuilder.fromUriString(frontendBaseUrl)
                .path("/data-deletion")
                .queryParam("code", confirmationCode)
                .build().toUriString();
        return connectionMapper.toDataDeletionCallbackResponse(statusUrl, confirmationCode);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<DataDeletionStatusResponse> getStatus(String confirmationCode) {
        MetaDataDeletionRequest request = deletionRequestRepository
                .findByConfirmationCodeAndDeletedAtIsNull(confirmationCode)
                .orElseThrow(() -> new AppException(ErrorCode.DATA_DELETION_REQUEST_NOT_FOUND));
        DataDeletionStatusResponse response = connectionMapper.toDataDeletionStatusResponse(request);
        return ApiResponse.success("Lấy trạng thái yêu cầu xoá dữ liệu thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<Void> deauthorize(String signedRequest) {
        String platformUserId = verify(signedRequest);
        MetaOAuthService.CleanupResult result = metaOAuthService.revokeFacebookUser(platformUserId);
        systemLogService.info(LOG_MODULE, "Deauthorize Meta: " + result.connections() + " kết nối → REVOKED, tạm giữ "
                + result.schedulesHeld() + " lịch");
        return ApiResponse.success("Đã xử lý deauthorize");
    }

    private String verify(String signedRequest) {
        String appSecret = metaProperties.facebook() == null ? null : metaProperties.facebook().appSecret();
        try {
            return MetaSignedRequest.verifyAndGetUserId(signedRequest, appSecret, objectMapper);
        } catch (AppException e) {
            log.warn("[MetaCallback] signed_request không hợp lệ — từ chối");
            systemLogService.warn(LOG_MODULE, "Từ chối callback: signed_request không hợp lệ");
            throw e;
        }
    }
}
