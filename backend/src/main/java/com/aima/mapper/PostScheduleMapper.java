package com.aima.mapper;

import com.aima.dto.ai.GoldenHourPayload;
import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.response.GoldenHourResponse;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.enums.Platform;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Mapper cho concern Scheduling (FR-47..FR-51): tạo lịch, entity → response và
 * payload/kết quả golden-hours của AI (FR-48). Dùng lại toContentVersionResponse của
 * {@link ContentFormattingMapper} và parsePlatform của {@link TrendResearchMapper}.
 */
@Mapper(componentModel = "spring", uses = {ContentFormattingMapper.class, TrendResearchMapper.class})
public interface PostScheduleMapper {

    // ===== Create =====

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", constant = "SCHEDULED")
    @Mapping(target = "post", ignore = true)
    @Mapping(target = "createdAt", ignore = true) // audit fields của BaseEntity — có ở cả hai source bean
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    PostSchedule toSchedule(ContentVersion contentVersion, PlatformAccount platformAccount, LocalDateTime scheduledTime);

    // ===== Entity → response =====

    @Mapping(target = "platformName", source = "contentVersion.platformName")
    @Mapping(target = "platformAccountId", source = "platformAccount.id")
    @Mapping(target = "platformAccountName", source = "platformAccount.accountName")
    @Mapping(target = "platformAccountAvatarUrl", source = "platformAccount.avatarUrl")
    @Mapping(target = "contentItemId", source = "contentVersion.contentItem.id")
    PostScheduleResponse toResponse(PostSchedule schedule);

    List<PostScheduleResponse> toResponseList(List<PostSchedule> schedules);

    // ===== Golden hours (FR-48) =====

    default GoldenHourPayload toGoldenHourPayload(Platform platform) {
        return GoldenHourPayload.builder().platform(platform.name()).build();
    }

    @Mapping(target = "platform", source = "platform", qualifiedByName = "parsePlatform")
    GoldenHourResponse toGoldenHourResponse(GoldenHourResultPayload payload);
}
