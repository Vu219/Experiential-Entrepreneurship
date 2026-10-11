package com.aima.service.Impl;

import com.aima.dto.publish.PublishFailureFacts;
import com.aima.dto.request.FailedPostBulkRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FailedPostAttemptResponse;
import com.aima.dto.response.FailedPostBulkResponse;
import com.aima.dto.response.FailedPostDetailResponse;
import com.aima.dto.response.FailedPostResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.dto.response.FailedPostSummaryResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlatformIncidentResponse;
import com.aima.entity.Post;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.FailedPostBulkAction;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.FailedPostStateFilter;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorCode;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.FailedPostMapper;
import com.aima.repository.PostRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.FailedPostService;
import com.aima.service.PlatformIncidentService;
import com.aima.service.PublishErrorNormalizer;
import com.aima.service.PublishRecoveryService;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FR-35..FR-39 — trang "Bài lỗi & cần xử lý": bài đăng lỗi của chính user theo vòng đời (đang tự thử lại / cần xử lý
 * / đã bỏ qua), mã lỗi chuẩn hoá + hành động khả dụng, timeline các lần thử, và hành động hồi phục (thử lại ngay,
 * bỏ qua, hàng loạt). Thao tác ghi KHÔNG chạy trong transaction của lớp (NOT_SUPPORTED): {@link PublishRecoveryService}
 * tự mở transaction ngắn và giao worker SAU commit (rule #28).
 */
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional(readOnly = true)
public class FailedPostServiceImpl implements FailedPostService {

    static final int MAX_PAGE_SIZE = 100;

    PostRepository postRepository;
    UserRepository userRepository;
    FailedPostMapper failedPostMapper;
    PublishRecoveryService recoveryService;
    PublishErrorNormalizer errorNormalizer;
    ActivityLogService activityLogService;
    PlatformIncidentService incidentService;
    TransactionTemplate readOnlyTransactionTemplate;

    public FailedPostServiceImpl(PostRepository postRepository,
                                 UserRepository userRepository,
                                 FailedPostMapper failedPostMapper,
                                 PublishRecoveryService recoveryService,
                                 PublishErrorNormalizer errorNormalizer,
                                 ActivityLogService activityLogService,
                                 PlatformIncidentService incidentService,
                                 TransactionTemplate transactionTemplate) {
        this.postRepository = postRepository;
        this.userRepository = userRepository;
        this.failedPostMapper = failedPostMapper;
        this.recoveryService = recoveryService;
        this.errorNormalizer = errorNormalizer;
        this.activityLogService = activityLogService;
        this.incidentService = incidentService;
        // Cùng transaction manager, chỉ đọc — dựng response sau khi thao tác ghi đã commit.
        this.readOnlyTransactionTemplate = new TransactionTemplate(transactionTemplate.getTransactionManager());
        this.readOnlyTransactionTemplate.setReadOnly(true);
    }

    @Override
    public ApiResponse<PageResponse<FailedPostResponse>> list(String email, FailedPostFilter filter,
                                                              FailedPostStateFilter state, int page, int size) {
        User user = currentUser(email);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        String mode = (filter == null ? FailedPostFilter.ALL : filter).name();
        String stateName = (state == null ? FailedPostStateFilter.NEEDS_ACTION : state).name();
        Page<Post> posts = postRepository.findFailedForUser(user.getId(), mode, stateName, pageable);

        List<FailedPostResponse> content = posts.getContent().stream()
                .map(this::toFailedPost)
                .toList();
        PageResponse<FailedPostResponse> response = PageResponse.from(posts, content);
        return ApiResponse.success("Lấy danh sách bài lỗi thành công", response);
    }

    @Override
    public ApiResponse<FailedPostSummaryResponse> summary(String email) {
        User user = currentUser(email);
        long total = postRepository.countFailedForUser(user.getId());
        long policy = postRepository.countPolicyFailedForUser(user.getId());
        String all = FailedPostFilter.ALL.name();
        // Tổng hợp scalar (không phải map entity→DTO): MapStruct sinh guard rỗng với toàn tham số
        // nguyên thủy nên dựng thẳng bằng builder.
        FailedPostSummaryResponse response = FailedPostSummaryResponse.builder()
                .total(total)
                .policyViolation(policy)
                .technical(total - policy)
                .needsAction(postRepository.countFailedForUserByState(user.getId(), all,
                        FailedPostStateFilter.NEEDS_ACTION.name()))
                .autoRetrying(postRepository.countFailedForUserByState(user.getId(), all,
                        FailedPostStateFilter.AUTO_RETRYING.name()))
                .dismissed(postRepository.countFailedForUserByState(user.getId(), all,
                        FailedPostStateFilter.DISMISSED.name()))
                .build();
        return ApiResponse.success("Lấy tổng quan lỗi thành công", response);
    }

    @Override
    public ApiResponse<FailedPostDetailResponse> get(String email, UUID postId) {
        User user = currentUser(email);
        Post post = ownedPost(user, postId);
        FailedPostDetailResponse response = failedPostMapper.toDetail(toFailedPost(post), attemptsOf(post));
        return ApiResponse.success("Lấy chi tiết bài lỗi thành công", response);
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ApiResponse<FailedPostRetryResponse> retry(String email, UUID postId) {
        User user = currentUser(email);
        ownedPost(user, postId);
        PublishRecoveryService.RetryOutcome outcome = recoveryService.retry(postId, user.getId());
        recordActivity(ActivityAction.POST_RETRIED, user, postId, outcome.jobId());
        FailedPostRetryResponse response = failedPostMapper.toRetryResponse(
                outcome.postId(), outcome.scheduleId(), outcome.jobId(), outcome.heldReason());
        String message = outcome.jobId() != null
                ? "Đã bắt đầu đăng lại — kết quả sẽ có sau ít phút"
                : "Bài được chuyển sang Tạm giữ (" + outcome.heldReason() + ") thay vì đăng";
        return ApiResponse.success(message, response);
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ApiResponse<FailedPostResponse> dismiss(String email, UUID postId) {
        User user = currentUser(email);
        ownedPost(user, postId);
        recoveryService.dismiss(postId, user.getId());
        recordActivity(ActivityAction.POST_FAILURE_DISMISSED, user, postId, null);
        FailedPostResponse response = readOnlyTransactionTemplate.execute(tx ->
                toFailedPost(postRepository.findById(postId).orElseThrow(() -> new AppException(ErrorCode.POST_NOT_FOUND))));
        return ApiResponse.success("Đã bỏ qua bài lỗi", response);
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ApiResponse<FailedPostBulkResponse> bulk(String email, FailedPostBulkRequest request) {
        User user = currentUser(email);
        List<FailedPostBulkResponse.Row> rows = new ArrayList<>();
        int succeeded = 0;
        for (UUID postId : request.getPostIds().stream().distinct().toList()) {
            FailedPostBulkResponse.Row row = runBulkRow(user, request.getAction(), postId);
            rows.add(row);
            if (row.getCode() == 200) {
                succeeded++;
            }
        }
        FailedPostBulkResponse response = failedPostMapper.toBulkResponse(succeeded, rows.size() - succeeded, rows);
        return ApiResponse.success("Đã xử lý " + succeeded + "/" + rows.size() + " bài", response);
    }

    @Override
    public ApiResponse<List<PlatformIncidentResponse>> platformStatus() {
        List<PlatformIncidentResponse> response = incidentService.activeIncidents();
        return ApiResponse.success("Lấy trạng thái nền tảng thành công", response);
    }

    private FailedPostBulkResponse.Row runBulkRow(User user, FailedPostBulkAction action, UUID postId) {
        try {
            ownedPost(user, postId);
            UUID jobId = null;
            if (action == FailedPostBulkAction.RETRY) {
                jobId = recoveryService.retry(postId, user.getId()).jobId();
                recordActivity(ActivityAction.POST_RETRIED, user, postId, jobId);
            } else {
                recoveryService.dismiss(postId, user.getId());
                recordActivity(ActivityAction.POST_FAILURE_DISMISSED, user, postId, null);
            }
            return failedPostMapper.toBulkRow(postId, 200, "Success", jobId);
        } catch (AppException e) {
            return failedPostMapper.toBulkRow(postId, e.getErrorCode().getCode(), e.getErrorCode().getMessage(), null);
        } catch (Exception e) {
            log.error("[FailedPost] Thao tác {} bài {} lỗi", action, postId, e);
            return failedPostMapper.toBulkRow(postId, ErrorCode.UNCATEGORIZED_EXCEPTION.getCode(),
                    ErrorCode.UNCATEGORIZED_EXCEPTION.getMessage(), null);
        }
    }

    private FailedPostResponse toFailedPost(Post post) {
        PublishFailureFacts facts = recoveryService.describe(post);
        return failedPostMapper.toFailedPost(post, facts);
    }

    // Timeline mọi lần thử (mọi chu kỳ), cũ → mới. Dòng cũ trước V13 chỉ lần lỗi cuối có mã gốc (publish_result).
    private List<FailedPostAttemptResponse> attemptsOf(Post post) {
        PostingJob lastFailed = recoveryService.lastFailedJob(post);
        PublishResult lastError = recoveryService.lastErrorResult(post);
        return post.getPostingJobs().stream()
                .sorted(Comparator.comparing(PostingJob::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                        .thenComparing(PostingJob::getRetryCount))
                .map(job -> {
                    if (job.getStatus() != PostingJobStatus.FAILED) {
                        return failedPostMapper.toAttempt(job, null, null);
                    }
                    PublishResult result = job == lastFailed ? lastError : null;
                    PublishErrorCode code = errorNormalizer.resolve(post.getPlatformName(), job, result);
                    return failedPostMapper.toAttempt(job, code, errorNormalizer.platformCodeOf(job, result));
                })
                .toList();
    }

    private void recordActivity(ActivityAction action, User user, UUID postId, UUID jobId) {
        activityLogService.record(ActivityLogService.Entry.byActor(action, user.getEmail(), "Post", postId.toString(),
                jobId == null ? null : Map.<String, Object>of("jobId", jobId.toString())));
    }

    private Post ownedPost(User user, UUID postId) {
        return postRepository.findByIdAndSchedule_PlatformAccount_User_IdAndDeletedAtIsNull(postId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.POST_NOT_FOUND));
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
