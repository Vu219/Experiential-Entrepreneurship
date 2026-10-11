package com.aima.mapper;

import com.aima.dto.publish.PublishFailureFacts;
import com.aima.dto.response.FailedPostAttemptResponse;
import com.aima.dto.response.FailedPostBulkResponse;
import com.aima.dto.response.FailedPostDetailResponse;
import com.aima.dto.response.FailedPostResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.entity.Post;
import com.aima.entity.PostingJob;
import com.aima.enums.HoldReason;
import com.aima.enums.PublishErrorCode;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.UUID;

/**
 * Trang "Bài lỗi & cần xử lý" của user (FR-35..FR-39) — trung tâm hồi phục bài của chính mình.
 * Tách khỏi {@link AdminMonitorMapper} (góc nhìn toàn hệ thống FR-82/83) vì DTO/mục đích khác.
 * KHÔNG map message gốc của nền tảng: người dùng chỉ thấy mã chuẩn hoá (FE dịch qua catalog).
 */
@Mapper(componentModel = "spring")
public interface FailedPostMapper {

    // facts = giá trị suy ra (mã chuẩn, vòng đời, lượt thử, hành động) — PublishRecoveryService.describe.
    @Mapping(target = "id", source = "post.id")
    @Mapping(target = "scheduleId", source = "post.schedule.id")
    @Mapping(target = "contentItemId", source = "post.schedule.contentVersion.contentItem.id")
    @Mapping(target = "contentVersionId", source = "post.schedule.contentVersion.id")
    @Mapping(target = "platformName", source = "post.platformName")
    @Mapping(target = "accountId", source = "post.schedule.platformAccount.id")
    @Mapping(target = "accountName", source = "post.schedule.platformAccount.accountName")
    @Mapping(target = "accountStatus", source = "post.schedule.platformAccount.connectionStatus")
    @Mapping(target = "caption", source = "post.schedule.contentVersion.formattedCaption")
    @Mapping(target = "errorType", expression = "java(facts.code().legacyType())")
    @Mapping(target = "errorCode", source = "facts.platformCode")
    // KHÔNG trả message gốc của nền tảng / chuỗi lỗi nội bộ cho người dùng (chỉ admin) — FE dịch theo mã chuẩn.
    @Mapping(target = "errorMessage", ignore = true)
    @Mapping(target = "failedAt", source = "facts.failedAt")
    @Mapping(target = "code", source = "facts.code")
    @Mapping(target = "category", expression = "java(facts.code().category())")
    @Mapping(target = "severity", expression = "java(facts.code().severity())")
    @Mapping(target = "owner", expression = "java(facts.code().owner())")
    @Mapping(target = "autoRetry", expression = "java(facts.code().isAutoRetry())")
    @Mapping(target = "actions", source = "facts.actions")
    @Mapping(target = "platformSubcode", source = "facts.platformSubcode")
    @Mapping(target = "referenceCode", source = "facts.referenceCode")
    @Mapping(target = "state", source = "facts.state")
    @Mapping(target = "attempt", source = "facts.attempt")
    @Mapping(target = "maxAttempts", source = "facts.maxAttempts")
    @Mapping(target = "nextRetryAt", source = "facts.nextRetryAt")
    @Mapping(target = "contentChanged", source = "facts.contentChanged")
    @Mapping(target = "accountReady", source = "facts.accountReady")
    FailedPostResponse toFailedPost(Post post, PublishFailureFacts facts);

    @Mapping(target = "retryCount", source = "job.retryCount")
    @Mapping(target = "status", source = "job.status")
    @Mapping(target = "code", source = "code")
    @Mapping(target = "platformCode", source = "platformCode")
    @Mapping(target = "startedAt", source = "job.startTime")
    @Mapping(target = "finishedAt", source = "job.endTime")
    @Mapping(target = "nextRetryAt", source = "job.nextRetryAt")
    @Mapping(target = "referenceCode", expression = "java(code == null ? null : com.aima.util.PublishReference.of(job.getId()))")
    @Mapping(target = "resolution", source = "job.resolution")
    FailedPostAttemptResponse toAttempt(PostingJob job, PublishErrorCode code, String platformCode);

    FailedPostDetailResponse toDetail(FailedPostResponse post, List<FailedPostAttemptResponse> attempts);

    FailedPostRetryResponse toRetryResponse(UUID postId, UUID scheduleId, UUID jobId, HoldReason heldReason);

    FailedPostBulkResponse.Row toBulkRow(UUID postId, int code, String message, UUID jobId);

    FailedPostBulkResponse toBulkResponse(int succeeded, int failed, List<FailedPostBulkResponse.Row> results);
}
