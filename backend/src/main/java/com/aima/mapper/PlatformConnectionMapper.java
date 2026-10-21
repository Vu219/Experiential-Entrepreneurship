package com.aima.mapper;

import com.aima.dto.response.PlatformConnectionResponse;
import com.aima.dto.response.DataDeletionStatusResponse;
import com.aima.dto.response.MetaDataDeletionCallbackResponse;
import com.aima.entity.MetaDataDeletionRequest;
import com.aima.entity.PlatformAccount;
import com.aima.dto.response.OAuthResultResponse;
import com.aima.dto.response.OAuthSkippedChannelResponse;
import com.aima.enums.InstagramLinkStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformLockReason;
import com.aima.service.MetaOAuthService;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Mapper(componentModel = "spring")
public interface PlatformConnectionMapper {

    @Mapping(target = "platform", source = "platformName")
    @Mapping(target = "parentConnectionId", source = "parentConnection.id")
    @Mapping(target = "tokenDaysRemaining", source = "tokenExpiredAt", qualifiedByName = "daysUntil")
    @Mapping(target = "instagramLinkStatus", ignore = true)
    @Mapping(target = "locked", ignore = true)
    @Mapping(target = "lockReason", ignore = true)
    PlatformConnectionResponse toResponse(PlatformAccount account);

    List<PlatformConnectionResponse> toResponseList(List<PlatformAccount> accounts);

    /** Kèm trạng thái liên kết Instagram của Trang (analytics giai đoạn 2, account_sync_state). */
    @Mapping(target = "platform", source = "account.platformName")
    @Mapping(target = "parentConnectionId", source = "account.parentConnection.id")
    @Mapping(target = "tokenDaysRemaining", source = "account.tokenExpiredAt", qualifiedByName = "daysUntil")
    @Mapping(target = "locked", expression = "java(lockReason != null)")
    PlatformConnectionResponse toResponse(PlatformAccount account, InstagramLinkStatus instagramLinkStatus,
                                          PlatformLockReason lockReason);

    /** Kèm trạng thái liên kết IG của Trang + lý do khoá theo nền tảng (khoá hệ thống / ngoài gói, tính khi đọc). */
    default List<PlatformConnectionResponse> toResponseList(List<PlatformAccount> accounts,
                                                            Map<UUID, InstagramLinkStatus> instagramLinks,
                                                            Map<Platform, PlatformLockReason> lockReasons) {
        return accounts.stream().map(account -> toResponse(account, instagramLinks.get(account.getId()),
                lockReasons.get(account.getPlatformName()))).toList();
    }

    // --- Kết quả OAuth callback (kênh không được thêm) ---

    OAuthSkippedChannelResponse toSkippedChannel(MetaOAuthService.SkippedChannel skipped);

    List<OAuthSkippedChannelResponse> toSkippedChannels(List<MetaOAuthService.SkippedChannel> skipped);

    OAuthResultResponse toOAuthResult(Platform platform, int connectedCount, List<OAuthSkippedChannelResponse> skipped);

    // --- Meta Data Deletion Callback ---

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    MetaDataDeletionRequest toDataDeletionRequest(String confirmationCode, int connectionsRemoved,
                                                  int schedulesHeld, LocalDateTime completedAt);

    MetaDataDeletionCallbackResponse toDataDeletionCallbackResponse(String url, String confirmationCode);

    @Mapping(target = "requestedAt", source = "createdAt")
    @Mapping(target = "status", constant = "COMPLETED")
    DataDeletionStatusResponse toDataDeletionStatusResponse(MetaDataDeletionRequest request);

    @Named("daysUntil")
    default Long daysUntil(LocalDateTime tokenExpiredAt) {
        return tokenExpiredAt == null ? null : ChronoUnit.DAYS.between(LocalDateTime.now(), tokenExpiredAt);
    }
}
