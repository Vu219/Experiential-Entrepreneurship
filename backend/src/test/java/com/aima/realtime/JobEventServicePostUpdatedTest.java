package com.aima.realtime;

import com.aima.dto.realtime.PostUpdatedEvent;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostScheduleHold;
import com.aima.entity.PostingJob;
import com.aima.entity.User;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.RealtimeEventType;
import com.aima.enums.ScheduleStatus;
import com.aima.mapper.RealtimeMapperImpl;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.service.Impl.JobEventServiceImpl;
import com.aima.service.NotificationService;
import com.aima.service.RealtimeEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Bước 4: {@code post.updated} phản ánh đúng trạng thái lịch, chu kỳ retry và lý do tạm giữ. */
class JobEventServicePostUpdatedTest {

    private final RealtimeEventPublisher publisher = mock(RealtimeEventPublisher.class);
    private JobEventServiceImpl service;
    private PostSchedule schedule;
    private User user;

    @BeforeEach
    void setUp() {
        service = new JobEventServiceImpl(mock(ContentGenerationJobRepository.class), mock(TrendResearchSessionRepository.class),
                mock(NotificationService.class), publisher, new RealtimeMapperImpl());
        user = new User();
        user.setId(UUID.randomUUID());
        PlatformAccount account = new PlatformAccount();
        account.setUser(user);
        ContentItem item = new ContentItem();
        item.setId(UUID.randomUUID());
        item.setBrandProfile(new BrandProfile());
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        schedule = new PostSchedule();
        schedule.setId(UUID.randomUUID());
        schedule.setPlatformAccount(account);
        schedule.setContentVersion(version);
    }

    private PostUpdatedEvent captured() {
        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(publisher).toUser(eq(user.getId()), eq(RealtimeEventType.POST_UPDATED), payload.capture());
        return (PostUpdatedEvent) payload.getValue();
    }

    private PostingJob job(PostingJobStatus status, int retryCount) {
        PostingJob job = new PostingJob();
        job.setStatus(status);
        job.setRetryCount(retryCount);
        return job;
    }

    @Test
    void retryCycle_isReportedAsRetryingWithAttemptAndNextRetry() {
        Post post = new Post();
        post.setId(UUID.randomUUID());
        PostingJob failed = job(PostingJobStatus.FAILED, 0);
        failed.setErrorCode(PublishErrorCode.NETWORK_TIMEOUT);
        PostingJob retry = job(PostingJobStatus.RETRYING, 1);
        Instant next = Instant.now().plusSeconds(300);
        retry.setNextRetryAt(next);
        post.getPostingJobs().add(failed);
        post.getPostingJobs().add(retry);
        schedule.setPost(post);
        schedule.setStatus(ScheduleStatus.POSTING);

        service.postUpdated(schedule);

        PostUpdatedEvent event = captured();
        assertEquals("RETRYING", event.getStatus());
        assertEquals(1, event.getAttempt());
        assertEquals(next, event.getNextRetryAt());
        assertEquals("FACEBOOK", event.getPlatform());
        assertEquals(schedule.getContentVersion().getContentItem().getId(), event.getItemId());
    }

    @Test
    void jobUpdated_keepsPlatform_andFormattingProgressCarriesCounts() {
        UUID jobId = UUID.randomUUID();
        service.jobUpdated(user.getId(), com.aima.enums.RealtimeJobKind.REGEN, jobId, "RUNNING", null, Platform.THREADS, null);
        service.formattingProgress(user.getId(), jobId, null, 1, 3, Platform.FACEBOOK);

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(publisher, times(2)).toUser(eq(user.getId()), eq(RealtimeEventType.JOB_UPDATED), payload.capture());
        var regen = (com.aima.dto.realtime.JobUpdatedEvent) payload.getAllValues().get(0);
        assertEquals("THREADS", regen.getPlatform(), "không lấy nhầm progress.platform");
        var progress = (com.aima.dto.realtime.JobUpdatedEvent) payload.getAllValues().get(1);
        assertEquals("FORMATTING", progress.getKind());
        assertEquals(1, progress.getProgress().getDone());
        assertEquals(3, progress.getProgress().getTotal());
        assertEquals("FACEBOOK", progress.getProgress().getPlatform());
    }

    @Test
    void onHold_carriesHoldReason_finalFailureCarriesErrorCode() {
        PostScheduleHold hold = new PostScheduleHold();
        hold.setReason(HoldReason.ACCOUNT_ISSUE);
        schedule.getHolds().add(hold);
        schedule.setStatus(ScheduleStatus.ON_HOLD);
        service.postUpdated(schedule);
        PostUpdatedEvent held = captured();
        assertEquals("ON_HOLD", held.getStatus());
        assertEquals("ACCOUNT_ISSUE", held.getHoldReason());
        assertNull(held.getPostId());

        reset(publisher);
        schedule.getHolds().clear();
        Post post = new Post();
        PostingJob failed = job(PostingJobStatus.FAILED, 3);
        failed.setErrorCode(PublishErrorCode.POLICY_VIOLATION);
        post.getPostingJobs().add(failed);
        schedule.setPost(post);
        schedule.setStatus(ScheduleStatus.FAILED);
        service.postUpdated(schedule);
        PostUpdatedEvent finalFailure = captured();
        assertEquals("FAILED", finalFailure.getStatus());
        assertEquals("POLICY_VIOLATION", finalFailure.getErrorCode());
        assertNull(finalFailure.getNextRetryAt());
    }
}
