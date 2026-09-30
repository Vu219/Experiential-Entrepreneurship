package com.aima.mapper;

import com.aima.dto.ai.GoldenHourPayload;
import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.request.PublishingSettingsRequest;
import com.aima.dto.response.GoldenHourResponse;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.dto.response.PublishingSettingsResponse;
import com.aima.dto.response.ScheduleBatchResponse;
import com.aima.dto.response.ScheduleRowResult;
import com.aima.dto.response.ScheduleWarning;
import com.aima.dto.response.SuggestedSlotResponse;
import com.aima.entity.ContentVersion;
import com.aima.entity.IdempotencyRecord;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostScheduleHold;
import com.aima.entity.UserPublishingSettings;
import com.aima.enums.HoldReason;
import com.aima.enums.IdempotencyOperation;
import com.aima.enums.Platform;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;

import java.time.Instant;
import java.util.List;

/**
 * Mapper cho concern Scheduling (FR-47..FR-51): tạo lịch, entity → response và
 * payload/kết quả golden-hours của AI (FR-48). Dùng lại toContentVersionResponse của
 * {@link ContentFormattingMapper} và parsePlatform của {@link TrendResearchMapper}.
 */
@Mapper(componentModel = "spring", uses = {ContentFormattingMapper.class, TrendResearchMapper.class})
public interface PostScheduleMapper {
    // ===== Cài đặt đăng bài (settings theo User) =====

    PublishingSettingsResponse toSettingsResponse(UserPublishingSettings settings);

    @Mapping(target = "userId", ignore = true)
    void updateSettings(PublishingSettingsRequest request, @MappingTarget UserPublishingSettings settings);

    /** Dòng settings mặc định cho user chưa có (timezone VN, không bắt buộc duyệt, cửa sổ 60 phút). */
    default UserPublishingSettings toDefaultSettings(java.util.UUID userId) {
        UserPublishingSettings settings = new UserPublishingSettings();
        settings.setUserId(userId);
        return settings;
    }

    // ===== Create =====

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", constant = "SCHEDULED")
    @Mapping(target = "post", ignore = true)
    @Mapping(target = "holds", ignore = true)
    @Mapping(target = "createdAt", ignore = true) // audit fields của BaseEntity — có ở cả hai source bean
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    PostSchedule toSchedule(ContentVersion contentVersion, PlatformAccount platformAccount, Instant scheduledTime);

    // ===== Entity → response =====

    @Mapping(target = "platformName", source = "contentVersion.platformName")
    @Mapping(target = "platformAccountId", source = "platformAccount.id")
    @Mapping(target = "platformAccountName", source = "platformAccount.accountName")
    @Mapping(target = "platformAccountAvatarUrl", source = "platformAccount.avatarUrl")
    @Mapping(target = "contentItemId", source = "contentVersion.contentItem.id")
    @Mapping(target = "holdReasons", source = "holds", qualifiedByName = "holdReasons")
    @Mapping(target = "overdue", expression = "java(isOverdue(schedule))")
    @Mapping(target = "jobId", ignore = true)    // chỉ có khi chính lời gọi tạo job (service gán)
    @Mapping(target = "warnings", ignore = true) // cảnh báo trùng lịch — service tính khi tạo/dời
    PostScheduleResponse toResponse(PostSchedule schedule);

    // ===== Phase 3: batch / idempotency / gợi ý giờ =====

    ScheduleRowResult toRowResult(String clientRowId, int code, String message, PostScheduleResponse schedule);

    ScheduleBatchResponse toBatchResponse(List<ScheduleRowResult> rows, int succeeded, int failed);

    @Mapping(target = "id", ignore = true)
    IdempotencyRecord toIdempotencyRecord(java.util.UUID ownerId, IdempotencyOperation operation, String idempotencyKey,
                                          String requestHash, java.util.UUID scheduleId, java.util.UUID jobId, Instant createdAt);

    SuggestedSlotResponse toSuggestedSlot(Instant time, String window);

    @Mapping(target = "type", constant = "CONFLICT")
    @Mapping(target = "scheduleId", source = "id")
    ScheduleWarning toConflictWarning(PostSchedule schedule);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "schedule", source = "schedule")
    @Mapping(target = "createdAt", source = "createdAt") // tham số, không phải audit createdAt của lịch
    PostScheduleHold toHold(PostSchedule schedule, HoldReason reason, Instant createdAt);

    @Named("holdReasons")
    default List<HoldReason> holdReasons(List<PostScheduleHold> holds) {
        return holds == null ? List.of() : holds.stream().map(PostScheduleHold::getReason).sorted().toList();
    }

    /** Lịch tạm giữ đã qua giờ đăng: không tự đăng khi hết lý do — user phải chọn giờ mới. */
    default boolean isOverdue(PostSchedule schedule) {
        return schedule.getStatus() == com.aima.enums.ScheduleStatus.ON_HOLD
                && schedule.getScheduledTime() != null && schedule.getScheduledTime().isBefore(Instant.now());
    }

    List<PostScheduleResponse> toResponseList(List<PostSchedule> schedules);

    // ===== Golden hours (FR-48) =====

    default GoldenHourPayload toGoldenHourPayload(Platform platform) {
        return GoldenHourPayload.builder().platform(platform.name()).build();
    }

    @Mapping(target = "platform", source = "platform", qualifiedByName = "parsePlatform")
    GoldenHourResponse toGoldenHourResponse(GoldenHourResultPayload payload);
}
