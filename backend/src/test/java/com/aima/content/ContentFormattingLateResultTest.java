package com.aima.content;

import com.aima.dto.ai.ContentVersionPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.dto.request.ContentFormatRequest;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.request.PostScheduleRequest;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentFormattingJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentFormattingJobRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentFormattingService;
import com.aima.service.ContentItemService;
import com.aima.service.PostScheduleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** Job định dạng hoàn tất TRỄ (plan Phase 2): không ghi đè bản đã sửa, và nhận lại lịch chưa đăng khi thay bản. */
@SpringBootTest
class ContentFormattingLateResultTest {

    @MockitoBean AiServiceClient aiServiceClient;
    @Autowired ContentFormattingService formattingService;
    @Autowired ContentItemService contentItemService;
    @Autowired PostScheduleService scheduleService;
    @Autowired ContentFormattingJobRepository jobRepository;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired PlatformAccountRepository accountRepository;
    @Autowired PostScheduleRepository scheduleRepository;
    @Autowired TransactionTemplate tx;

    String email;
    ContentItem item;
    ContentVersion version;
    PlatformAccount page;

    @BeforeEach
    void fixture() {
        email = "format-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Format IT").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);
        item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        item.setReviewStatus(ReviewStatus.APPROVED);
        item = contentItemRepository.save(item);
        version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setFormattedCaption("Ban goc");
        version.setMediaPrompt("Media prompt ban goc");
        version.setImagePrompt("Anh vuong ban trang diem toi gian, tong pastel.");
        version.setVoiceAligned(true);
        version.setVoiceScore(92);
        version.setVoiceNotes("Giong van tu tin, chuyen nghiep");
        version.setStatus(ContentVersionStatus.FORMATTED);
        version = contentVersionRepository.save(version);
        page = new PlatformAccount();
        page.setUser(user);
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId("page-" + UUID.randomUUID());
        page.setAccountName("Page IT");
        page.setAccountType(PlatformAccountType.PAGE);
        page.setTokenType(TokenType.PAGE_TOKEN);
        page.setAccessToken("fake");
        page.setConnectionStatus(ConnectionStatus.ACTIVE);
        page = accountRepository.save(page);
    }

    @Test
    void resultIsDiscardedWhenTheVersionWasEditedDuringFormatting() {
        when(aiServiceClient.format(any())).thenAnswer(inv -> {
            contentItemService.updateVersion(email, item.getId(), version.getId(),
                    ContentVersionUpdateRequest.builder().caption("Sua tay trong luc dinh dang").build());
            return result("Ket qua AI cu");
        });

        ContentFormattingJob job = runFormatting();
        assertEquals(GenerationJobStatus.FAILED, job.getStatus());
        assertTrue(job.getErrorMessage().contains("định dạng lại"), job.getErrorMessage());
        List<ContentVersion> active = activeVersions();
        assertEquals(1, active.size());
        assertEquals(version.getId(), active.getFirst().getId());
        assertEquals("Sua tay trong luc dinh dang", active.getFirst().getFormattedCaption());
    }

    @Test
    void replacementVersionTakesOverAScheduleCreatedDuringFormatting() {
        when(aiServiceClient.format(any())).thenAnswer(inv -> {
            scheduleService.create(email, PostScheduleRequest.builder().contentVersionId(version.getId())
                    .platformAccountId(page.getId()).scheduledTime(Instant.now().plus(Duration.ofDays(1))).build(), null);
            return result("Ket qua AI moi");
        });

        ContentFormattingJob job = runFormatting();
        assertEquals(GenerationJobStatus.SUCCESS, job.getStatus(), job.getErrorMessage());
        List<ContentVersion> active = activeVersions();
        assertEquals(1, active.size());
        ContentVersion replacement = active.getFirst();
        assertNotEquals(version.getId(), replacement.getId());
        assertEquals("Media prompt ban goc", replacement.getMediaPrompt());
        assertEquals("Anh vuong ban trang diem toi gian, tong pastel.", replacement.getImagePrompt());
        assertEquals(Boolean.TRUE, replacement.getVoiceAligned());
        assertEquals(92, replacement.getVoiceScore());
        assertEquals("Giong van tu tin, chuyen nghiep", replacement.getVoiceNotes());
        tx.executeWithoutResult(s -> {
            PostSchedule schedule = scheduleRepository.findByContentVersion_IdAndDeletedAtIsNull(replacement.getId()).orElseThrow();
            assertEquals(ScheduleStatus.SCHEDULED, schedule.getStatus());
            ContentItem fresh = contentItemRepository.findById(item.getId()).orElseThrow();
            assertEquals(ReviewStatus.NEED_REVIEW, fresh.getReviewStatus(), "định dạng lại = nội dung đổi → bỏ duyệt cũ");
            assertEquals(ContentItemStatus.SCHEDULED, fresh.getStatus());
        });
    }

    @Test
    void formattedVersionInheritsBrandVoiceAndImagePromptFromSource() {
        when(aiServiceClient.format(any())).thenReturn(result("Ket qua dinh dang moi"));

        ContentFormattingJob job = runFormatting();
        assertEquals(GenerationJobStatus.SUCCESS, job.getStatus(), job.getErrorMessage());

        List<ContentVersion> active = activeVersions();
        assertEquals(1, active.size());
        ContentVersion formatted = active.getFirst();
        assertNotEquals(version.getId(), formatted.getId());
        assertEquals(version.getId(), formatted.getSourceVersionId());
        assertEquals(ContentVersionStatus.FORMATTED, formatted.getStatus());
        assertEquals("Ket qua dinh dang moi", formatted.getFormattedCaption());
        assertEquals("Media prompt ban goc", formatted.getMediaPrompt());
        assertEquals("Anh vuong ban trang diem toi gian, tong pastel.", formatted.getImagePrompt());
        assertEquals(Boolean.TRUE, formatted.getVoiceAligned());
        assertEquals(92, formatted.getVoiceScore());
        assertEquals("Giong van tu tin, chuyen nghiep", formatted.getVoiceNotes());
    }

    private ContentFormattingJob runFormatting() {
        UUID jobId = formattingService.startFormatting(email, item.getId(),
                ContentFormatRequest.builder().platforms(List.of(Platform.FACEBOOK)).build()).getResult().getId();
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            ContentFormattingJob job = jobRepository.findById(jobId).orElseThrow();
            if (job.getStatus() == GenerationJobStatus.SUCCESS || job.getStatus() == GenerationJobStatus.FAILED) {
                return job;
            }
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }
        return fail("Job định dạng không kết thúc");
    }

    private List<ContentVersion> activeVersions() {
        return contentVersionRepository.findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(item.getId(), Platform.FACEBOOK);
    }

    private static FormatResultPayload result(String caption) {
        return FormatResultPayload.builder().versions(List.of(ContentVersionPayload.builder()
                .platformName("Facebook").formattedCaption(caption).formattedHashtags(List.of("aima")).cta("Xem ngay")
                .mediaFormat("image").build())).build();
    }
}
