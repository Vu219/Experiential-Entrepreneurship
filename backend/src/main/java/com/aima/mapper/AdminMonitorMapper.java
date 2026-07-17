package com.aima.mapper;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.SystemActivityResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.entity.Post;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDateTime;
import java.util.List;

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
    @Mapping(target = "errorMessage", source = "error.responseMessage")
    @Mapping(target = "failedAt", source = "job.endTime")
    AdminFailedPostResponse toFailedPost(Post post, PostingJob job, PublishResult error);

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
