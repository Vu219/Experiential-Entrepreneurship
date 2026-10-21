package com.aima.service.Impl;

import com.aima.config.AimaProperties;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.AuthorizationUrlResponse;
import com.aima.dto.response.ConnectionStatsResponse;
import com.aima.dto.response.PlatformConnectionResponse;
import com.aima.dto.response.OAuthResultResponse;
import com.aima.enums.PlatformLockReason;
import com.aima.service.PlatformAvailabilityService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.RedisTemplate;
import java.time.Duration;
import com.aima.entity.AccountSyncState;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.InstagramLinkStatus;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlatformConnectionMapper;
import com.aima.repository.AccountSyncStateRepository;
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
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PlatformConnectionServiceImpl implements PlatformConnectionService {

    // Mã lỗi gắn vào ?error= của FE_OAUTH_ERROR_URL — FE (Settings.tsx) khớp nguyên văn.
    static final String MISSING_PERMISSIONS_ERROR = "missing_permissions";

    // Số kênh mới bị bỏ qua vì đủ giới hạn gói — gắn vào FE_OAUTH_SUCCESS_URL (giữ cho FE cũ).
    static final String CHANNEL_LIMIT_PARAM = "channel_limit";

    // Id kết quả liên kết (kênh không được thêm + lý do) — FE đọc qua GET /connections/oauth-results/{id}.
    static final String OAUTH_RESULT_PARAM = "result";
    static final String PLATFORM_DISABLED_ERROR = "platform_disabled";
    static final String PLAN_PLATFORM_ERROR = "plan_platform";
    static final String OAUTH_RESULT_PREFIX = "oauth_result:";
    static final Duration OAUTH_RESULT_TTL = Duration.ofMinutes(10);

    MetaOAuthService metaOAuthService;
    PlatformAccountRepository accountRepository;
    UserRepository userRepository;
    PlatformConnectionMapper connectionMapper;
    AimaProperties aimaProperties;
    AccountSyncStateRepository accountSyncStateRepository;
    PlatformAvailabilityService platformAvailabilityService;
    RedisTemplate<String, String> redisTemplate;
    ObjectMapper objectMapper;

    @Override
    public ApiResponse<AuthorizationUrlResponse> getAuthorizationUrl(Platform platform, String email) {
        User user = currentUser(email);
        String url = metaOAuthService.buildAuthorizationUrl(platform, user.getId());
        AuthorizationUrlResponse response = AuthorizationUrlResponse.builder().authorizationUrl(url).build();
        return ApiResponse.success("Tạo URL liên kết thành công", response);
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
            MetaOAuthService.CallbackResult result = metaOAuthService.handleCallback(platform, code, state);
            log.info("[OAuth] Đã tạo/cập nhật {} kết nối cho nền tảng {}", result.connected().size(), platform);
            UriComponentsBuilder redirect = UriComponentsBuilder.fromUriString(aimaProperties.oauth().frontendSuccessRedirect())
                    .replaceQueryParam("status", "success");
            if (result.skippedByPlan() > 0) {
                // FE (Settings.tsx) báo số kênh mới chưa thêm vì gói đã đủ giới hạn CONNECTED_CHANNELS.
                redirect.replaceQueryParam(CHANNEL_LIMIT_PARAM, result.skippedByPlan());
            }
            if (!result.skipped().isEmpty()) {
                redirect.replaceQueryParam(OAUTH_RESULT_PARAM, storeResult(platform, result));
            }
            return redirect.build().toUriString();
        } catch (AppException e) {
            String feError = switch (e.getErrorCode()) {
                // FE hiện thông báo riêng: user bỏ tick quyền Page trong dialog → cần liên kết lại.
                case META_MISSING_PERMISSIONS -> MISSING_PERMISSIONS_ERROR;
                // Nền tảng vừa bị khoá toàn hệ thống / gói không gồm nền tảng trong lúc user ở dialog Meta.
                case PLATFORM_CONNECTION_DISABLED -> PLATFORM_DISABLED_ERROR;
                case PLAN_FEATURE_NOT_INCLUDED -> PLAN_PLATFORM_ERROR;
                default -> null;
            };
            if (feError != null) {
                return UriComponentsBuilder.fromUriString(aimaProperties.oauth().frontendErrorRedirect())
                        .replaceQueryParam("error", feError)
                        .build().toUriString();
            }
            log.error("[OAuth] Xử lý callback thất bại", e);
            return aimaProperties.oauth().frontendErrorRedirect();
        } catch (Exception e) {
            log.error("[OAuth] Xử lý callback thất bại", e);
            return aimaProperties.oauth().frontendErrorRedirect();
        }
    }

    @Override
    @Transactional // không readOnly: quyền theo gói đọc subscription — getOrCreate có thể tạo / lăn kỳ / hạ gói hết hạn
    public ApiResponse<List<PlatformConnectionResponse>> listConnections(String email) {
        User user = currentUser(email);
        List<PlatformAccount> accounts =
                accountRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(user.getId());
        // Trang Facebook không có IG Business liên kết → FE hướng dẫn ở thẻ Instagram (analytics giai đoạn 2).
        Map<UUID, InstagramLinkStatus> instagramLinks = accountSyncStateRepository
                .findByPlatformAccount_IdInAndDeletedAtIsNull(accounts.stream().map(PlatformAccount::getId).toList())
                .stream().filter(state -> state.getInstagramLinkStatus() != null)
                .collect(Collectors.toMap(state -> state.getPlatformAccount().getId(),
                        AccountSyncState::getInstagramLinkStatus, (first, second) -> first));
        // Tài khoản trên nền tảng khoá / ngoài gói: vẫn hiển thị nhưng bị khoá (tính khi đọc, không lưu DB).
        Map<Platform, PlatformLockReason> lockReasons = platformAvailabilityService.lockReasons(user);
        List<PlatformConnectionResponse> responses = connectionMapper.toResponseList(accounts, instagramLinks, lockReasons);
        return ApiResponse.success("Lấy danh sách kết nối thành công", responses);
    }

    @Override
    public ApiResponse<OAuthResultResponse> getOAuthResult(String id, String email) {
        User user = currentUser(email);
        String json = redisTemplate.opsForValue().get(OAUTH_RESULT_PREFIX + user.getId() + ":" + id);
        if (json == null) {
            throw new AppException(ErrorCode.OAUTH_RESULT_NOT_FOUND);
        }
        try {
            OAuthResultResponse response = objectMapper.readValue(json, OAuthResultResponse.class);
            return ApiResponse.success("Kết quả liên kết", response);
        } catch (JsonProcessingException e) {
            log.warn("[OAuth] Không đọc được kết quả liên kết {}: {}", id, e.getMessage());
            throw new AppException(ErrorCode.OAUTH_RESULT_NOT_FOUND);
        }
    }

    /** Lưu kênh không được thêm (Redis, khoá theo user) để FE hiện rõ kênh nào và vì sao; trả id gắn vào redirect. */
    private String storeResult(Platform platform, MetaOAuthService.CallbackResult result) {
        String id = UUID.randomUUID().toString();
        OAuthResultResponse payload = connectionMapper.toOAuthResult(platform, result.connected().size(),
                connectionMapper.toSkippedChannels(result.skipped()));
        try {
            redisTemplate.opsForValue().set(OAUTH_RESULT_PREFIX + result.userId() + ":" + id,
                    objectMapper.writeValueAsString(payload), OAUTH_RESULT_TTL);
        } catch (Exception e) {
            // Best-effort: thiếu kết quả thì FE vẫn còn channel_limit — không làm hỏng lần liên kết đã lưu.
            log.warn("[OAuth] Không lưu được kết quả liên kết của user {}: {}", result.userId(), e.getMessage());
        }
        return id;
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
        PlatformAccount validated = metaOAuthService.validate(account.getId());
        PlatformConnectionResponse response = connectionMapper.toResponse(validated);
        return ApiResponse.success("Kiểm tra kết nối thành công", response);
    }

    @Override
    public ApiResponse<PlatformConnectionResponse> refreshConnection(UUID id, String email) {
        PlatformAccount account = find(id, email);
        PlatformAccount refreshed = metaOAuthService.refresh(account.getId());
        PlatformConnectionResponse response = connectionMapper.toResponse(refreshed);
        return ApiResponse.success("Làm mới token thành công", response);
    }

    @Override
    public ApiResponse<Void> disconnect(UUID id, String email) {
        // Chỉ truyền ID: lớp này không có transaction, entity load ở đây sẽ detached bên MetaOAuthService.
        metaOAuthService.disconnect(currentUser(email).getId(), id);
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
