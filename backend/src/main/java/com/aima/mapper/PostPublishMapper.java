package com.aima.mapper;

import com.aima.dto.publish.PublishTarget;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
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
    @Mapping(target = "status", source = "jobStatus") // tường minh: lấy param, không phải post.status
    PostingJob toPostingJob(Post post, Integer retryCount, LocalDateTime nextRetryAt, PostingJobStatus jobStatus);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    PublishResult toPublishResult(Post post, Boolean isSuccess, String responseCode, String responseMessage);

    /** Chụp giá trị cho lời gọi nền tảng — gọi TRONG transaction (entity đã JOIN FETCH), dùng ngoài. */
    @Mapping(target = "jobId", source = "job.id")
    @Mapping(target = "postId", source = "job.post.id")
    @Mapping(target = "platform", source = "version.platformName")
    @Mapping(target = "accountId", source = "account.id")
    @Mapping(target = "accountType", source = "account.accountType")
    @Mapping(target = "platformAccountId", source = "account.platformAccountId")
    @Mapping(target = "accountName", source = "account.accountName")
    @Mapping(target = "accessToken", source = "account.accessToken")
    PublishTarget toPublishTarget(PostingJob job, PlatformAccount account, ContentVersion version, String message);
}
