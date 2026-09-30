package com.aima.service.Impl;

import com.aima.entity.ContentItem;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.mapper.PostPublishMapper;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.PostingDispatchService;
import com.aima.service.ScheduleHoldService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional(propagation = Propagation.MANDATORY)
public class PostingDispatchServiceImpl implements PostingDispatchService {

    PostScheduleRepository scheduleRepository;
    PostRepository postRepository;
    PostingJobRepository jobRepository;
    PostPublishMapper postPublishMapper;
    ContentItemStatusResolver statusResolver;
    ScheduleHoldService holdService;

    @Override
    public Outcome dispatch(UUID scheduleId) {
        // Thứ tự khóa item → schedule → job: khóa bài trước khi claim lịch.
        UUID itemId = scheduleRepository.findContentItemId(scheduleId).orElse(null);
        if (itemId == null) {
            return new Outcome(null, null);
        }
        ContentItem item = statusResolver.lock(itemId);
        // Chốt chặn cuối trước khi đăng (lịch cũ/luồng lọt): tạm giữ thay vì để đăng thất bại.
        PostSchedule due = scheduleRepository.findById(scheduleId).orElse(null);
        if (due == null || due.getStatus() != ScheduleStatus.SCHEDULED) {
            return new Outcome(null, null);
        }
        HoldReason blocker = blockerOf(due, item);
        if (blocker != null) {
            holdService.hold(due, blocker);
            statusResolver.refresh(itemId);
            log.warn("[PostingDispatch] Lịch {} đến hạn nhưng bị tạm giữ ({}) — không đăng", scheduleId, blocker);
            return new Outcome(null, blocker);
        }
        // Claim nguyên tử SCHEDULED → POSTING: lịch vừa bị hủy/giữ lại, hoặc instance khác / "Đăng ngay" đã
        // claim trước → 0 row → bỏ qua, không tạo Post/Job trùng.
        if (scheduleRepository.claimForPosting(scheduleId) == 0) {
            return new Outcome(null, null);
        }
        PostSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null) {
            return new Outcome(null, null);
        }

        Post post = schedule.getPost();
        if (post == null) {
            post = postPublishMapper.toPost(schedule);
            schedule.setPost(post);
        } else {
            // Lịch được tái sử dụng sau lần FAILED + hủy trước đó — mở chu kỳ đăng mới trên cùng Post.
            post.setStatus(PostStatus.POSTING);
        }
        // Snapshot trong CÙNG transaction claim + tạo job, dưới khóa bài: sửa bài trước lúc này thì vào bài
        // đăng, sửa sau lúc này thì không đổi bài đang đăng (kể cả các lần retry).
        postPublishMapper.captureSnapshot(schedule.getContentVersion(), Instant.now(), post);
        Post savedPost = postRepository.save(post);

        PostingJob job = postPublishMapper.toPostingJob(savedPost, 0, null, PostingJobStatus.PENDING);
        savedPost.getPostingJobs().add(job);
        PostingJob savedJob = jobRepository.save(job);
        statusResolver.refresh(itemId); // lịch POSTING → bài POSTING
        return new Outcome(savedJob.getId(), null);
    }

    private HoldReason blockerOf(PostSchedule schedule, ContentItem item) {
        if (schedule.getContentVersion().getPlatformName() == Platform.INSTAGRAM) {
            return HoldReason.UNSUPPORTED_MEDIA;
        }
        if (schedule.getPlatformAccount().getDeletedAt() != null) {
            return HoldReason.ACCOUNT_REMOVED;
        }
        if (schedule.getPlatformAccount().getConnectionStatus() != ConnectionStatus.ACTIVE) {
            return HoldReason.ACCOUNT_ISSUE;
        }
        if (item.getReviewStatus() != ReviewStatus.APPROVED
                && holdService.requiresApproval(schedule.getPlatformAccount().getUser().getId())) {
            return HoldReason.PENDING_REVIEW;
        }
        return null;
    }
}
