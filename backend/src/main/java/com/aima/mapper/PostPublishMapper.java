package com.aima.mapper;

import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.PostingJobStatus;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDateTime;

/**
 * Mapper cho concern Auto-Posting (FR-52..FR-56): tạo Post/PostingJob/PublishResult
 * cho dispatcher và worker (rule #18 — không hand-build entity trong service/scheduler).
 */
@Mapper(componentModel = "spring")
public interface PostPublishMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "schedule", source = "schedule")
    @Mapping(target = "platformName", source = "schedule.contentVersion.platformName")
    @Mapping(target = "status", constant = "POSTING")
    @Mapping(target = "platformPostId", ignore = true)
    @Mapping(target = "publishedAt", ignore = true)
    @Mapping(target = "postingJobs", ignore = true)
    @Mapping(target = "publishResults", ignore = true)
    @Mapping(target = "postAnalytics", ignore = true)
    Post toPost(PostSchedule schedule);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "startTime", ignore = true)
    @Mapping(target = "endTime", ignore = true)
    @Mapping(target = "errorMessage", ignore = true)
    @Mapping(target = "errorType", ignore = true)
    @Mapping(target = "status", source = "status") // tường minh: lấy param, không phải post.status
    PostingJob toPostingJob(Post post, Integer retryCount, LocalDateTime nextRetryAt, PostingJobStatus status);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    PublishResult toPublishResult(Post post, Boolean isSuccess, String responseCode, String responseMessage);
}
