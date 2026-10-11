package com.aima.mapper;

import com.aima.dto.request.PublishErrorMappingRequest;
import com.aima.dto.response.AdminFailedPostAttemptResponse;
import com.aima.dto.response.AdminFailedPostDetailResponse;
import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminFailedPostSummaryResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.PlatformIncidentResponse;
import com.aima.dto.response.PublishErrorMappingResponse;
import com.aima.dto.response.SystemActivityResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.dto.response.UnclassifiedErrorGroupResponse;
import com.aima.entity.Post;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishErrorMapping;
import com.aima.entity.PublishResult;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.FailureState;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCategory;
import com.aima.enums.PublishErrorCode;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Trang giám sát của admin (FR-81..FR-83): bài thất bại/bị từ chối + tổng quan hệ thống.
 */
@Mapper(componentModel = "spring")
public interface AdminMonitorMapper {

    // job = PostingJob FAILED cuối cùng (mang errorType), error = PublishResult lỗi cuối (mã gốc FR-35).
    @Mapping(target = "id", source = "post.id")
    @Mapping(target = "platformName", source = "post.platformName")
    @Mapping(target = "accountName", source = "post.schedule.platformAccount.accountName")
    @Mapping(target = "ownerEmail", source = "post.schedule.platformAccount.user.email")
    @Mapping(target = "caption", source = "post.schedule.contentVersion.formattedCaption")
    @Mapping(target = "errorType", source = "job.errorType")
    @Mapping(target = "errorCode", source = "error.responseCode")
    // Dòng cũ (trước V13) chưa được redact lúc ghi → redact lúc đọc.
    @Mapping(target = "errorMessage",
            expression = "java(com.aima.util.SensitiveDataRedactor.redact(error == null ? null : error.getResponseMessage()))")
    @Mapping(target = "retryCount", source = "job.retryCount")
    @Mapping(target = "nextRetryAt", source = "job.nextRetryAt")
    @Mapping(target = "failedAt", source = "job.endTime")
    @Mapping(target = "code", source = "code")
    @Mapping(target = "category", expression = "java(code == null ? null : code.category())")
    @Mapping(target = "platformSubcode", source = "job.platformErrorSubcode")
    @Mapping(target = "referenceCode", expression = "java(com.aima.util.PublishReference.of(job == null ? null : job.getId()))")
    AdminFailedPostResponse toFailedPost(Post post, PostingJob job, PublishResult error, PublishErrorCode code);

    PlatformIncidentResponse toIncident(Platform platform, Instant since, long failures, long accounts);

    // ===== Chuẩn hoá lỗi đăng bài — góc nhìn admin (docs/failed-posts-error-handling-plan.md Phase 4)

    @Mapping(target = "retryCount", source = "job.retryCount")
    @Mapping(target = "status", source = "job.status")
    @Mapping(target = "code", source = "code")
    @Mapping(target = "platformCode", source = "platformCode")
    @Mapping(target = "platformSubcode", source = "job.platformErrorSubcode")
    @Mapping(target = "startedAt", source = "job.startTime")
    @Mapping(target = "finishedAt", source = "job.endTime")
    @Mapping(target = "nextRetryAt", source = "job.nextRetryAt")
    @Mapping(target = "referenceCode",
            expression = "java(code == null ? null : com.aima.util.PublishReference.of(job.getId()))")
    @Mapping(target = "resolution", source = "job.resolution")
    @Mapping(target = "resolvedAt", source = "job.resolvedAt")
    @Mapping(target = "resolvedBy", source = "job.resolvedBy")
    @Mapping(target = "errorMessage", expression = "java(com.aima.util.SensitiveDataRedactor.redact(job.getErrorMessage()))")
    @Mapping(target = "errorDetail", expression = "java(com.aima.util.SensitiveDataRedactor.redact(job.getErrorDetail()))")
    AdminFailedPostAttemptResponse toAdminAttempt(PostingJob job, PublishErrorCode code, String platformCode);

    AdminFailedPostDetailResponse toAdminDetail(AdminFailedPostResponse post, UUID scheduleId, UUID contentItemId,
                                                FailureState state, String rawError,
                                                List<AdminFailedPostAttemptResponse> attempts);

    UnclassifiedErrorGroupResponse toUnclassifiedGroup(Platform platform, String platformCode, String platformSubcode,
                                                       String messageSample, long count, long affectedUsers,
                                                       Instant firstSeen, Instant lastSeen, String sampleReferenceCode,
                                                       String sampleDetail);

    AdminFailedPostSummaryResponse.CodeCount toCodeCount(PublishErrorCode code, PublishErrorCategory category, long count);

    AdminFailedPostSummaryResponse.PlatformCount toPlatformCount(Platform platform, long count);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "updatedByEmail", ignore = true)
    PublishErrorMapping toPublishErrorMapping(PublishErrorMappingRequest request);

    PublishErrorMappingResponse toMappingResponse(PublishErrorMapping mapping, int appliedCount);

    AdminFailedPostSummaryResponse.Kpi toKpi(long value, Integer deltaPct,
                                             AdminFailedPostSummaryResponse.DeltaState deltaState,
                                             List<Long> sparkline);

    AdminFailedPostSummaryResponse toFailedPostSummary(FailedPostFilter kind,
                                                       AdminFailedPostSummaryResponse.Kpi total,
                                                       AdminFailedPostSummaryResponse.Kpi policyViolation,
                                                       AdminFailedPostSummaryResponse.Kpi technical,
                                                       AdminFailedPostSummaryResponse.Kpi temporary,
                                                       AdminFailedPostSummaryResponse.Kpi permanent,
                                                       AdminFailedPostSummaryResponse.Kpi affectedUsers,
                                                       LocalDate comparisonFrom, LocalDate comparisonTo,
                                                       List<AdminFailedPostSummaryResponse.CodeCount> topCodes,
                                                       List<AdminFailedPostSummaryResponse.PlatformCount> byPlatform,
                                                       long postedTotal, List<PlatformIncidentResponse> incidents);

    AdminSystemStatusResponse.ServiceHealthResponse toServiceHealth(String name, String status, String detail,
                                                                    Long latencyMs, Integer activeConnections,
                                                                    String memoryUsed, Double hitRate);

    AdminSystemStatusResponse.HostMetricsResponse toHostMetrics(Double cpuLoad, Long memUsedMb, Long memMaxMb,
                                                                Long diskFreeGb, Long diskTotalGb);

    AdminSystemStatusResponse toStatusResponse(List<AdminSystemStatusResponse.ServiceHealthResponse> services,
                                               long totalUsers, long activeConnections, long postedLast24h,
                                               long failedLast24h, long pendingSchedules,
                                               List<SystemLogResponse> alerts,
                                               AdminSystemStatusResponse.HostMetricsResponse host);

    SystemActivityResponse.ActivityBucket toActivityBucket(LocalDateTime time, long posts, long jobs,
                                                           long errors, long total);

    SystemActivityResponse toActivityResponse(String range, String granularity,
                                              List<SystemActivityResponse.ActivityBucket> buckets);
}
