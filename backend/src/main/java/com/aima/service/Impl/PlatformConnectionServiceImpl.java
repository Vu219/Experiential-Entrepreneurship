package com.aima.service.Impl;

import com.aima.config.AimaProperties;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.AuthorizationUrlResponse;
import com.aima.dto.response.ConnectionStatsResponse;
import com.aima.dto.response.PlatformConnectionResponse;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlatformConnectionMapper;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.UserRepository;
import com.aima.service.MetaOAuthService;
import com.aima.service.PlatformConnectionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class PlatformConnectionServiceImpl implements PlatformConnectionService {

    MetaOAuthService metaOAuthService;
    PlatformAccountRepository accountRepository;
    UserRepository userRepository;
    PlatformConnectionMapper connectionMapper;
    AimaProperties aimaProperties;

    @Override
    public ApiResponse<AuthorizationUrlResponse> getAuthorizationUrl(Platform platform, String email) {
        User user = currentUser(email);
        String url = metaOAuthService.buildAuthorizationUrl(platform, user.getId());
        return ApiResponse.success("Tạo URL liên kết thành công",
                AuthorizationUrlResponse.builder().authorizationUrl(url).build());
    }

    @Override
    public String handleCallbackRedirect(Platform platform, String code, String state, String error) {
        try {
            if (error != null && !error.isBlank()) {
                log.warn("[OAuth] Nền tảng trả lỗi callback {}: {}", platform, error);
                return aimaProperties.oauth().frontendErrorRedirect();
            }
            if (code == null || code.isBlank() || state == null || state.isBlank()) {
                return aimaProperties.oauth().frontendErrorRedirect();
            }
            List<PlatformAccount> created = metaOAuthService.handleCallback(platform, code, state);
            log.info("[OAuth] Đã tạo/cập nhật {} kết nối cho nền tảng {}", created.size(), platform);
            return UriComponentsBuilder.fromUriString(aimaProperties.oauth().frontendSuccessRedirect())
                    .replaceQueryParam("status", "success")
                    .build().toUriString();
        } catch (Exception e) {
            log.error("[OAuth] Xử lý callback thất bại", e);
            return aimaProperties.oauth().frontendErrorRedirect();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PlatformConnectionResponse>> listConnections(String email) {
        List<PlatformAccount> accounts =
                accountRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(currentUser(email).getId());
        return ApiResponse.success("Lấy danh sách kết nối thành công",
                connectionMapper.toResponseList(accounts));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ConnectionStatsResponse> getStats(String email) {
        UUID userId = currentUser(email).getId();
        ConnectionStatsResponse stats = ConnectionStatsResponse.builder()
                .total(accountRepository.countByUser_IdAndDeletedAtIsNull(userId))
                .active(accountRepository.countByUser_IdAndConnectionStatusAndDeletedAtIsNull(userId, ConnectionStatus.ACTIVE))
                .expired(accountRepository.countByUser_IdAndConnectionStatusAndDeletedAtIsNull(userId, ConnectionStatus.EXPIRED))
                .error(accountRepository.countByUser_IdAndConnectionStatusAndDeletedAtIsNull(userId, ConnectionStatus.ERROR))
                .build();
        return ApiResponse.success("Lấy tổng quan kết nối thành công", stats);
    }

    @Override
    public ApiResponse<PlatformConnectionResponse> validateConnection(UUID id, String email) {
        PlatformAccount account = find(id, email);
        PlatformAccount validated = metaOAuthService.validate(account);
        return ApiResponse.success("Kiểm tra kết nối thành công",
                connectionMapper.toResponse(validated));
    }

    @Override
    public ApiResponse<PlatformConnectionResponse> refreshConnection(UUID id, String email) {
        PlatformAccount account = find(id, email);
        PlatformAccount refreshed = metaOAuthService.refresh(account);
        return ApiResponse.success("Làm mới token thành công",
                connectionMapper.toResponse(refreshed));
    }

    @Override
    public ApiResponse<Void> disconnect(UUID id, String email) {
        PlatformAccount account = find(id, email);
        metaOAuthService.disconnect(account);
        return ApiResponse.success("Đã ngắt kết nối tài khoản");
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }

    private PlatformAccount find(UUID id, String email) {
        return accountRepository.findByIdAndUser_IdAndDeletedAtIsNull(id, currentUser(email).getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONNECTION_NOT_FOUND));
    }
}
