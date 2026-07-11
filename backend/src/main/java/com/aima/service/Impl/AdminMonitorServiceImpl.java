package com.aima.service.Impl;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.entity.Post;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.LogLevel;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.mapper.AdminMonitorMapper;
import com.aima.mapper.SystemLogMapper;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.SystemLogRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AdminMonitorService;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * FR-81..FR-83: tổng quan hệ thống + danh sách bài thất bại cho admin. Health check các
 * dependency là best-effort — một dependency chết không làm hỏng cả response.
 */
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AdminMonitorServiceImpl implements AdminMonitorService {

    static final String STATUS_UP = "UP";
    static final String STATUS_DOWN = "DOWN";

    UserRepository userRepository;
    PlatformAccountRepository platformAccountRepository;
    PostRepository postRepository;
    PostScheduleRepository postScheduleRepository;
    SystemLogRepository systemLogRepository;
    AdminMonitorMapper adminMonitorMapper;
    SystemLogMapper systemLogMapper;
    StringRedisTemplate stringRedisTemplate;
    WebClient aiServiceWebClient;

    public AdminMonitorServiceImpl(UserRepository userRepository,
                                   PlatformAccountRepository platformAccountRepository,
                                   PostRepository postRepository,
                                   PostScheduleRepository postScheduleRepository,
                                   SystemLogRepository systemLogRepository,
                                   AdminMonitorMapper adminMonitorMapper,
                                   SystemLogMapper systemLogMapper,
                                   StringRedisTemplate stringRedisTemplate,
                                   @Qualifier("aiServiceWebClient") WebClient aiServiceWebClient) {
        this.userRepository = userRepository;
        this.platformAccountRepository = platformAccountRepository;
        this.postRepository = postRepository;
        this.postScheduleRepository = postScheduleRepository;
        this.systemLogRepository = systemLogRepository;
        this.adminMonitorMapper = adminMonitorMapper;
        this.systemLogMapper = systemLogMapper;
        this.stringRedisTemplate = stringRedisTemplate;
        this.aiServiceWebClient = aiServiceWebClient;
    }

    // Không @Transactional bao ngoài: health check AI service là HTTP (rule #24);
    // từng count là query đơn tự commit.
    @Override
    public ApiResponse<AdminSystemStatusResponse> systemStatus() {
        List<AdminSystemStatusResponse.ServiceHealthResponse> services = new ArrayList<>();
        services.add(checkDatabase());
        services.add(checkRedis());
        services.add(checkAiService());

        LocalDateTime last24h = LocalDateTime.now().minusHours(24);
        long totalUsers = safeCount(() -> userRepository.count());
        long activeConnections = safeCount(() ->
                platformAccountRepository.countByConnectionStatusAndDeletedAtIsNull(ConnectionStatus.ACTIVE));
        long postedLast24h = safeCount(() ->
                postRepository.countByStatusAndPublishedAtAfterAndDeletedAtIsNull(PostStatus.POSTED, last24h));
        long failedLast24h = safeCount(() ->
                postRepository.countByStatusAndUpdatedAtAfterAndDeletedAtIsNull(PostStatus.FAILED, last24h));
        long pendingSchedules = safeCount(() ->
                postScheduleRepository.countByStatusAndDeletedAtIsNull(ScheduleStatus.SCHEDULED));

        List<SystemLogResponse> alerts = systemLogMapper.toResponseList(
                systemLogRepository.findTop5ByLevelAndDeletedAtIsNullOrderByCreatedAtDesc(LogLevel.ERROR));

        AdminSystemStatusResponse response = adminMonitorMapper.toStatusResponse(
                services, totalUsers, activeConnections, postedLast24h, failedLast24h, pendingSchedules, alerts);
        return ApiResponse.success("Lấy trạng thái hệ thống thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<AdminFailedPostResponse>> listFailedPosts(boolean violationOnly,
                                                                              int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        Page<Post> posts = postRepository.findFailedForAdmin(violationOnly, pageable);

        List<AdminFailedPostResponse> content = posts.getContent().stream()
                .map(this::toFailedPost)
                .toList();
        PageResponse<AdminFailedPostResponse> response = PageResponse.from(posts, content);
        return ApiResponse.success("Lấy danh sách bài thất bại thành công", response);
    }

    // Job FAILED cuối = nguồn errorType/thời điểm; PublishResult lỗi cuối = mã + message gốc (FR-35).
    private AdminFailedPostResponse toFailedPost(Post post) {
        PostingJob lastFailedJob = post.getPostingJobs().stream()
                .filter(j -> j.getStatus() == PostingJobStatus.FAILED)
                .max(Comparator.comparing(PostingJob::getEndTime,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
        PublishResult lastError = post.getPublishResults().stream()
                .filter(r -> Boolean.FALSE.equals(r.getIsSuccess()))
                .max(Comparator.comparing(PublishResult::getCreatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
        return adminMonitorMapper.toFailedPost(post, lastFailedJob, lastError);
    }

    private AdminSystemStatusResponse.ServiceHealthResponse checkDatabase() {
        try {
            userRepository.count();
            return adminMonitorMapper.toServiceHealth("database", STATUS_UP, null);
        } catch (Exception e) {
            return adminMonitorMapper.toServiceHealth("database", STATUS_DOWN, e.getMessage());
        }
    }

    private AdminSystemStatusResponse.ServiceHealthResponse checkRedis() {
        try {
            String pong = stringRedisTemplate.getConnectionFactory().getConnection().ping();
            return adminMonitorMapper.toServiceHealth("redis",
                    "PONG".equalsIgnoreCase(pong) ? STATUS_UP : STATUS_DOWN, null);
        } catch (Exception e) {
            return adminMonitorMapper.toServiceHealth("redis", STATUS_DOWN, e.getMessage());
        }
    }

    // FastAPI luôn phục vụ /openapi.json — đủ làm health probe mà không cần endpoint riêng.
    private AdminSystemStatusResponse.ServiceHealthResponse checkAiService() {
        try {
            aiServiceWebClient.get()
                    .uri("/openapi.json")
                    .retrieve()
                    .toBodilessEntity()
                    .block(Duration.ofSeconds(5));
            return adminMonitorMapper.toServiceHealth("aiService", STATUS_UP, null);
        } catch (Exception e) {
            return adminMonitorMapper.toServiceHealth("aiService", STATUS_DOWN, e.getMessage());
        }
    }

    private long safeCount(java.util.function.LongSupplier supplier) {
        try {
            return supplier.getAsLong();
        } catch (Exception e) {
            log.warn("[AdminMonitor] Không đếm được số liệu: {}", e.getMessage());
            return -1;
        }
    }
}
