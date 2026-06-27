package com.aima.mapper;

import com.aima.dto.response.PlatformConnectionResponse;
import com.aima.entity.PlatformAccount;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Mapper(componentModel = "spring")
public interface PlatformConnectionMapper {

    @Mapping(target = "platform", source = "platformName")
    @Mapping(target = "parentConnectionId", source = "parentConnection.id")
    @Mapping(target = "tokenDaysRemaining", ignore = true) // tính ở @AfterMapping
    PlatformConnectionResponse toResponse(PlatformAccount account);

    List<PlatformConnectionResponse> toResponseList(List<PlatformAccount> accounts);

    @AfterMapping
    default void fillTokenDaysRemaining(PlatformAccount account, @MappingTarget PlatformConnectionResponse response) {
        if (account.getTokenExpiredAt() != null) {
            response.setTokenDaysRemaining(ChronoUnit.DAYS.between(LocalDateTime.now(), account.getTokenExpiredAt()));
        }
    }
}
