package com.aima.service.Impl;

import java.util.Comparator;
import org.springframework.transaction.annotation.Transactional;
import com.aima.service.RealtimeEventPublisher;
import com.aima.mapper.RealtimeMapper;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.RealtimeJobKind;
import com.aima.enums.RealtimeEventType;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.Platform;
import com.aima.entity.PostingJob;
import com.aima.entity.PostSchedule;
import com.aima.entity.Post;
import com.aima.entity.ContentVersion;
import com.aima.dto.notification.NotificationDraft;
import com.aima.entity.ContentGenerationJob;
import com.aima.entity.TrendResearchSession;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.NotificationRefType;
import com.aima.enums.NotificationType;
import com.aima.enums.ResearchStatus;
import com.aima.enums.ResearchTrigger;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.service.JobEventService;
import com.aima.service.NotificationService;
import com.aima.util.NotificationParams;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class JobEventServiceImpl implements JobEventService {

    /** {@code content_generation_jobs.error_code} khi user bấm Dừng (D12) — không báo lỗi cho chính hành động của user. */
    public static final String CANCELLED_BY_USER = "CANCELLED_BY_USER";

    ContentGenerationJobRepository generationJobRepository;
    TrendResearchSessionRepository sessionRepository;
    NotificationService notificationService;
    RealtimeEventPublisher realtimeEventPublisher;
    RealtimeMapper realtimeMapper;

    @Override
    @Transactional
    public void generationFailed(UUID jobId) {
        try {
            ContentGenerationJob job = generationJobRepository.findById(jobId).orElse(null);
            if (job == null || job.getStatus() != GenerationJobStatus.FAILED) {
                return;
            }
            publishGeneration(job, null);
            if (CANCELLED_BY_USER.equals(job.getErrorCode())) {
                return; // user tự bấm Dừng — chỉ cần sự kiện tiến độ, không báo lỗi
            }
            var brand = job.getContentStrategy().getBrandProfile();
            UUID itemId = job.getContentItem() == null ? null : job.getContentItem().getId();
            notificationService.send(brand.getUser(), NotificationDraft.builder()
                    .type(NotificationType.CONTENT_GENERATION_FAILED)
                    .title("Tạo nội dung thất bại")
                    .message("AI chưa tạo được nội dung " + job.getPlatform() + " cho thương hiệu " + brand.getBrandName()
                            + ". Hãy thử lại trong trang Tạo nội dung.")
                    .refType(itemId == null ? null : NotificationRefType.CONTENT_ITEM).refId(itemId)
                    .params(NotificationParams.of("platform", job.getPlatform(), "brandName", brand.getBrandName(),
                            "errorCode", job.getErrorCode(), "jobId", job.getId()))
                    .dedupeKey("generation-failed:" + job.getId())
                    .build());
        } catch (Exception e) {
            log.warn("[JobEvent] Không báo được job tạo nội dung lỗi {}: {}", jobId, e.toString());
        }
    }

    @Override
    @Transactional
    public void researchFinished(UUID sessionId) {
        try {
            TrendResearchSession session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) return;
            var user = session.getBrandProfile().getUser();
            jobUpdated(user.getId(), RealtimeJobKind.TREND, session.getId(), session.getStatus().name(), null,
                    session.getPlatform(), null);
            if (session.getStatus() == ResearchStatus.COMPLETED) {
                int trends = session.getTrends().size();
                int ideas = session.getTrends().stream().mapToInt(t -> t.getContentIdeas().size()).sum();
                notificationService.send(user, NotificationDraft.builder()
                        .type(NotificationType.TREND_RESEARCH_DONE)
                        .title("Nghiên cứu xu hướng đã xong")
                        .message("Đã tìm thấy " + trends + " xu hướng và " + ideas + " ý tưởng nội dung cho "
                                + session.getPlatform() + ".")
                        .refType(NotificationRefType.TREND_SESSION).refId(session.getId())
                        .params(NotificationParams.of("platform", session.getPlatform(), "trendCount", trends,
                                "ideaCount", ideas, "trigger", session.getTriggerType()))
                        .dedupeKey("trend-research:" + session.getId())
                        .build());
            } else if (session.getStatus() == ResearchStatus.FAILED && session.getTriggerType() == ResearchTrigger.MANUAL) {
                notificationService.send(user, NotificationDraft.builder()
                        .type(NotificationType.TREND_RESEARCH_FAILED)
                        .title("Nghiên cứu xu hướng thất bại")
                        .message("Phiên nghiên cứu " + session.getPlatform() + " chưa hoàn tất. Hãy thử lại trong trang Xu hướng.")
                        .refType(NotificationRefType.TREND_SESSION).refId(session.getId())
                        .params(NotificationParams.of("platform", session.getPlatform()))
                        .dedupeKey("trend-research:" + session.getId())
                        .build());
            }
        } catch (Exception e) {
            log.warn("[JobEvent] Không báo được phiên nghiên cứu {}: {}", sessionId, e.toString());
        }
    }

    @Override
    @Transactional
    public void generationUpdated(UUID jobId, String stage) {
        try {
            generationJobRepository.findById(jobId).ifPresent(job -> publishGeneration(job, stage));
        } catch (Exception e) {
            log.warn("[JobEvent] Không phát được tiến độ job tạo nội dung {}: {}", jobId, e.toString());
        }
    }

    @Override
    public void jobUpdated(UUID userId, RealtimeJobKind kind, UUID jobId, String status, UUID itemId, Platform platform,
                           String errorCode) {
        realtimeEventPublisher.toUser(userId, RealtimeEventType.JOB_UPDATED,
                realtimeMapper.toJobUpdatedEvent(kind, jobId, itemId, platform, status, null, null, errorCode, null));
    }

    @Override
    public void formattingProgress(UUID userId, UUID jobId, UUID itemId, int done, int total, Platform platform) {
        realtimeEventPublisher.toUser(userId, RealtimeEventType.JOB_UPDATED, realtimeMapper.toJobUpdatedEvent(
                RealtimeJobKind.FORMATTING, jobId, itemId, null, GenerationJobStatus.RUNNING.name(), null,
                realtimeMapper.toJobProgress(done, total, platform), null, null));
    }

    @Override
    public void postUpdated(PostSchedule schedule) {
        try {
            Post post = schedule.getPost();
            PostingJob latest = post == null ? null : post.getPostingJobs().stream()
                    .filter(j -> j.getDeletedAt() == null)
                    .max(Comparator.comparing((PostingJob j) -> j.getRetryCount() == null ? 0 : j.getRetryCount())
                            .thenComparing(j -> j.getCreatedAt(), Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);
            boolean retrying = latest != null && latest.getStatus() == PostingJobStatus.RETRYING
                    && schedule.getStatus() == ScheduleStatus.POSTING;
            String status = retrying ? PostingJobStatus.RETRYING.name() : schedule.getStatus().name();
            String holdReason = schedule.getHolds().stream().map(h -> h.getReason().name()).sorted().findFirst().orElse(null);
            String errorCode = latest == null || latest.getErrorCode() == null ? null : latest.getErrorCode().name();
            ContentVersion version = schedule.getContentVersion();
            realtimeEventPublisher.toUser(schedule.getPlatformAccount().getUser().getId(), RealtimeEventType.POST_UPDATED,
                    realtimeMapper.toPostUpdatedEvent(schedule.getId(), post == null ? null : post.getId(),
                            version.getContentItem().getId(), version.getPlatformName(), status,
                            latest == null ? null : latest.getRetryCount(), retrying ? latest.getNextRetryAt() : null,
                            holdReason, errorCode));
        } catch (Exception e) {
            log.warn("[JobEvent] Không phát được post.updated cho lịch {}: {}", schedule.getId(), e.toString());
        }
    }

    private void publishGeneration(ContentGenerationJob job, String stage) {
        UUID userId = job.getContentStrategy().getBrandProfile().getUser().getId();
        UUID itemId = job.getContentItem() == null ? null : job.getContentItem().getId();
        UUID resultId = job.getResultContentVersion() == null ? null : job.getResultContentVersion().getId();
        realtimeEventPublisher.toUser(userId, RealtimeEventType.JOB_UPDATED, realtimeMapper.toJobUpdatedEvent(
                RealtimeJobKind.GENERATION, job.getId(), itemId, job.getPlatform(), job.getStatus().name(), stage, null,
                job.getErrorCode(), resultId));
    }
}
