package com.aima.mapper;

import com.aima.dto.response.PlatformConnectionResponse;
import com.aima.dto.response.DataDeletionStatusResponse;
import com.aima.dto.response.MetaDataDeletionCallbackResponse;
import com.aima.entity.MetaDataDeletionRequest;
import com.aima.entity.PlatformAccount;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Mapper(componentModel = "spring")
public interface PlatformConnectionMapper {

    @Mapping(target = "platform", source = "platformName")
    @Mapping(target = "parentConnectionId", source = "parentConnection.id")
    @Mapping(target = "tokenDaysRemaining", source = "tokenExpiredAt", qualifiedByName = "daysUntil")
    PlatformConnectionResponse toResponse(PlatformAccount account);

    List<PlatformConnectionResponse> toResponseList(List<PlatformAccount> accounts);

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
