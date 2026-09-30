package com.aima.mapper;

import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.VideoScriptPayload;
import com.aima.dto.common.VideoScriptDto;
import com.aima.dto.request.ContentItemUpdateRequest;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.request.ContentWizardStateRequest;
import com.aima.dto.response.ContentItemResponse;
import com.aima.dto.response.ContentStatusRepairReport;
import com.aima.dto.response.ContentStatusRepairResult;
import com.aima.dto.response.ContentVersionResponse;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PostSchedule;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
import com.aima.util.ScriptJson;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;
import org.mapstruct.NullValuePropertyMappingStrategy;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring")
public interface ContentItemMapper {

    // B2: response kèm các bản nền tảng còn hiệu lực + tên thương hiệu cho card list.
    @Mapping(target = "script", source = "script", qualifiedByName = "parseScript")
    @Mapping(target = "hashtags", source = "hashtag", qualifiedByName = "splitHashtags")
    @Mapping(target = "versions", source = "contentVersions", qualifiedByName = "activeVersions")
    @Mapping(target = "brandProfileId", source = "brandProfile.id")
    @Mapping(target = "brandName", source = "brandProfile.brandName")
    @Mapping(target = "ideaId", source = "contentIdea.id")
    @Mapping(target = "wizardPlatforms", source = "wizardPlatforms", qualifiedByName = "splitWizardPlatforms")
    @Mapping(target = "needsAttention", source = "contentVersions", qualifiedByName = "needsAttention")
    @Mapping(target = "source", ignore = true) // chỉ màn chi tiết cần — service tự resolve
    ContentItemResponse toResponse(ContentItem item);

    // Auto-save trạng thái wizard (bài DRAFT) — partial: field null giữ nguyên; ideaId service resolve.
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "wizardStep", source = "step")
    @Mapping(target = "wizardPlatforms", source = "platforms", qualifiedByName = "joinWizardPlatforms")
    @Mapping(target = "wizardNote", source = "note")
    void updateWizardState(ContentWizardStateRequest request, @MappingTarget ContentItem item);

    @Mapping(target = "script", source = "script", qualifiedByName = "formatScript")
    @Mapping(target = "hashtag", source = "hashtags", qualifiedByName = "joinHashtags")
    ContentItem toContentItem(GeneratedContentResult result);

    // B2: kết quả generate của MỘT nền tảng → ContentVersion GIÀU (worker gán platform + item).
    @Mapping(target = "script", source = "script", qualifiedByName = "formatScript")
    @Mapping(target = "formattedCaption", source = "caption")
    @Mapping(target = "formattedHashtag", source = "hashtags", qualifiedByName = "joinHashtags")
    @Mapping(target = "voiceAligned", source = "brandVoiceCheck.aligned")
    @Mapping(target = "voiceScore", source = "brandVoiceCheck.score")
    @Mapping(target = "voiceNotes", source = "brandVoiceCheck.notes")
    @Mapping(target = "status", constant = "GENERATED")
    ContentVersion toGeneratedVersion(GeneratedContentResult result);

    @Mapping(target = "script", source = "script", qualifiedByName = "parseScript")
    @Mapping(target = "formattedHashtags", source = "formattedHashtag", qualifiedByName = "splitHashtags")
    @Mapping(target = "scheduleStatus", source = "postSchedule", qualifiedByName = "liveScheduleStatus")
    ContentVersionResponse toVersionResponse(ContentVersion version);

    // FR-33: partial update — field null giữ nguyên giá trị cũ.
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "script", source = "script", qualifiedByName = "writeScript")
    @Mapping(target = "hashtag", source = "hashtags", qualifiedByName = "joinHashtags")
    void update(ContentItemUpdateRequest request, @MappingTarget ContentItem item);

    // FR-33 trên bản nền tảng (B2) — cùng ngữ nghĩa partial update.
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "script", source = "script", qualifiedByName = "writeScript")
    @Mapping(target = "formattedCaption", source = "caption")
    @Mapping(target = "formattedHashtag", source = "hashtags", qualifiedByName = "joinHashtags")
    void updateVersion(ContentVersionUpdateRequest request, @MappingTarget ContentVersion version);

    /** Chỉ các bản còn hiệu lực (soft-deleted loại ra) — thứ tự giữ như trong item. */
    @Named("activeVersions")
    default List<ContentVersionResponse> activeVersions(List<ContentVersion> versions) {
        if (versions == null) {
            return List.of();
        }
        return versions.stream()
                .filter(v -> v.getDeletedAt() == null)
                .map(this::toVersionResponse)
                .toList();
    }

    /** Lịch còn hiệu lực của bản (CANCELLED/xóa mềm = không có) — cùng quy ước ContentItemStatusResolver. */
    @Named("liveScheduleStatus")
    default ScheduleStatus liveScheduleStatus(PostSchedule schedule) {
        if (schedule == null || schedule.getDeletedAt() != null || schedule.getStatus() == ScheduleStatus.CANCELLED) {
            return null;
        }
        return schedule.getStatus();
    }

    /** Có bản hiện hành đang FAILED/ON_HOLD — user cần xử lý (PARTIALLY_POSTED không tự nói lên điều này). */
    @Named("needsAttention")
    default boolean needsAttention(List<ContentVersion> versions) {
        if (versions == null) {
            return false;
        }
        return versions.stream()
                .filter(v -> v.getDeletedAt() == null)
                .map(v -> liveScheduleStatus(v.getPostSchedule()))
                .anyMatch(s -> s == ScheduleStatus.FAILED || s == ScheduleStatus.ON_HOLD);
    }

    @Named("splitHashtags")
    default List<String> splitHashtags(String hashtag) {
        if (hashtag == null || hashtag.isBlank()) {
            return List.of();
        }
        return Arrays.stream(hashtag.split(","))
                .map(String::trim)
                .filter(h -> !h.isEmpty())
                .collect(Collectors.toList());
    }

    @Named("joinHashtags")
    default String joinHashtags(List<String> hashtags) {
        return (hashtags == null || hashtags.isEmpty()) ? null : String.join(",", hashtags);
    }

    @Named("joinWizardPlatforms")
    default String joinWizardPlatforms(List<Platform> platforms) {
        if (platforms == null || platforms.isEmpty()) {
            return null;
        }
        return platforms.stream().map(Platform::name).collect(Collectors.joining(","));
    }

    /** CSV tên enum → danh sách Platform; token lạ (dữ liệu tay) bị bỏ qua. */
    @Named("splitWizardPlatforms")
    default List<Platform> splitWizardPlatforms(String platforms) {
        if (platforms == null || platforms.isBlank()) {
            return List.of();
        }
        return Arrays.stream(platforms.split(","))
                .map(String::trim)
                .filter(p -> !p.isEmpty())
                .flatMap(p -> Arrays.stream(Platform.values()).filter(v -> v.name().equalsIgnoreCase(p)))
                .toList();
    }

    // ===== Job sửa dữ liệu trạng thái (Phase 6) — chỉ id + trạng thái, không nội dung =====

    ContentStatusRepairReport.Change toRepairChange(UUID itemId, String from, String to, String reason);

    // Viết tay: MapStruct coi tham số Map là nguồn thuộc tính (map → bean) nên không sinh được mapping này.
    default ContentStatusRepairReport toRepairReport(String planToken, Instant generatedAt, String flywayVersion,
                                                     List<ContentStatusRepairReport.Change> itemChanges,
                                                     List<UUID> instagramSchedules, List<UUID> unclassifiedHolds,
                                                     List<UUID> reviewUnknown, Map<String, Map<String, Long>> enumUsage) {
        return ContentStatusRepairReport.builder().planToken(planToken).generatedAt(generatedAt).flywayVersion(flywayVersion)
                .itemChanges(itemChanges).instagramSchedules(instagramSchedules).unclassifiedHolds(unclassifiedHolds)
                .reviewUnknown(reviewUnknown).enumUsage(enumUsage).build();
    }

    // Viết tay: MapStruct 1.5 sinh null-check rỗng khi mọi tham số là kiểu nguyên thủy.
    default ContentStatusRepairResult toRepairResult(int itemsUpdated, int instagramHeld, int remainingChanges) {
        return ContentStatusRepairResult.builder().itemsUpdated(itemsUpdated).instagramHeld(instagramHeld)
                .remainingChanges(remainingChanges).build();
    }

    // AI payload (snake_case) → DTO hợp đồng API (camelCase); MapStruct tự sinh mapping lồng nhau.
    VideoScriptDto toScriptDto(VideoScriptPayload script);

    /** Kết quả AI → chuỗi JSON có cấu trúc lưu vào cột text `script`. */
    @Named("formatScript")
    default String formatScript(VideoScriptPayload script) {
        return ScriptJson.toJson(toScriptDto(script));
    }

    /** Cột text `script` → DTO cho response (bài cũ dạng dòng được parse fallback). */
    @Named("parseScript")
    default VideoScriptDto parseScript(String script) {
        return ScriptJson.parse(script);
    }

    /** DTO từ request PUT → chuỗi JSON lưu vào cột. */
    @Named("writeScript")
    default String writeScript(VideoScriptDto script) {
        return ScriptJson.toJson(script);
    }

    /** Bản phẳng dễ đọc cho payload gửi AI formatter (FormatContentPayload.script). */
    @Named("plainScript")
    default String plainScript(String script) {
        return ScriptJson.toPlainText(script);
    }
}
