package com.aima.mapper;

import com.aima.dto.ai.ContentVersionPayload;
import com.aima.dto.ai.FormatContentPayload;
import com.aima.dto.response.ContentFormattingJobResponse;
import com.aima.dto.response.ContentVersionResponse;
import com.aima.entity.ContentFormattingJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.enums.Platform;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.List;

/**
 * Mapper cho concern Platform Formatting (FR-40..FR-46): job, payload gửi AI,
 * AI version → entity, entity → response. Dùng lại splitHashtags/joinHashtags của
 * {@link ContentItemMapper} và parsePlatform của {@link TrendResearchMapper}.
 */
@Mapper(componentModel = "spring", uses = {ContentItemMapper.class, TrendResearchMapper.class})
public interface ContentFormattingMapper {

    // ===== Create job =====

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true) // audit fields — không copy từ item
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "status", ignore = true) // giữ default PENDING — không lấy status của item
    @Mapping(target = "contentItem", source = "item")
    @Mapping(target = "platforms", source = "platforms", qualifiedByName = "joinPlatforms")
    ContentFormattingJob toJob(ContentItem item, List<Platform> platforms);

    // ===== Entity → AI payload =====

    // script trong cột là JSON có cấu trúc → gửi AI formatter bản phẳng dễ đọc.
    @Mapping(target = "script", source = "script", qualifiedByName = "plainScript")
    @Mapping(target = "hashtags", source = "hashtag", qualifiedByName = "splitHashtags")
    FormatContentPayload toFormatContentPayload(ContentItem item);

    // PA2-a: nguồn format là CHÍNH bản nền tảng đã tạo/sửa (mỗi nền tảng format từ version của nó,
    // giữ chỉnh sửa tay của user làm đầu vào). Nội dung nằm ở cột formatted_*/script của version.
    @Mapping(target = "script", source = "script", qualifiedByName = "plainScript")
    @Mapping(target = "caption", source = "formattedCaption")
    @Mapping(target = "hashtags", source = "formattedHashtag", qualifiedByName = "splitHashtags")
    FormatContentPayload toFormatContentPayload(ContentVersion version);

    // ===== AI result → entity =====

    @Mapping(target = "contentItem", ignore = true)
    @Mapping(target = "platformName", source = "platformName", qualifiedByName = "parsePlatform")
    @Mapping(target = "formattedHashtag", source = "formattedHashtags", qualifiedByName = "joinHashtags")
    @Mapping(target = "status", constant = "FORMATTED")
    ContentVersion toContentVersion(ContentVersionPayload payload);

    // ===== Entity → response =====

    @Mapping(target = "script", source = "script", qualifiedByName = "parseScript")
    @Mapping(target = "formattedHashtags", source = "formattedHashtag", qualifiedByName = "splitHashtags")
    @Mapping(target = "scheduleStatus", source = "postSchedule", qualifiedByName = "liveScheduleStatus")
    ContentVersionResponse toContentVersionResponse(ContentVersion version);

    @Mapping(target = "id", source = "job.id")
    @Mapping(target = "status", source = "job.status")
    ContentFormattingJobResponse toJobResponse(ContentFormattingJob job, List<ContentVersionResponse> versions);

    @Named("joinPlatforms")
    default String joinPlatforms(List<Platform> platforms) {
        return String.join(",", platforms.stream().map(Platform::name).toList());
    }
}
