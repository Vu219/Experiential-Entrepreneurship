package com.aima.content;

import com.aima.dto.ai.ContentVersionPayload;
import com.aima.dto.ai.FormatPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.dto.request.ContentFormatRequest;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentFormattingJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.User;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.ReviewStatus;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentFormattingJobRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentFormattingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Empirical Stress Test: Verify Brand Voice and Image Prompt inheritance across
 * all platform permutations (FACEBOOK, INSTAGRAM, THREADS), repeated re-formatting chains,
 * and edge cases in ContentFormattingWorkerServiceImpl.
 */
@SpringBootTest
class ContentFormattingInheritanceStressTest {

    @MockitoBean AiServiceClient aiServiceClient;
    @Autowired ContentFormattingService formattingService;
    @Autowired ContentFormattingJobRepository jobRepository;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;

    String email;
    ContentItem item;
    ContentVersion fbVersion;
    ContentVersion igVersion;
    ContentVersion thVersion;

    @BeforeEach
    void setup() {
        email = "stress-fmt-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Stress Test User").password("{noop}secret")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());

        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Stress Test Brand");
        brand.setIndustry("Technology");
        brand.setTargetAudience("Developers");
        brand = brandProfileRepository.save(brand);

        item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.GENERATED);
        item.setReviewStatus(ReviewStatus.APPROVED);
        item = contentItemRepository.save(item);

        // FB initial version
        fbVersion = new ContentVersion();
        fbVersion.setContentItem(item);
        fbVersion.setPlatformName(Platform.FACEBOOK);
        fbVersion.setFormattedCaption("FB Initial Caption");
        fbVersion.setMediaPrompt("FB Initial Media Prompt");
        fbVersion.setImagePrompt("FB Realistic Tech Office Banner");
        fbVersion.setScript("FB Script Hook-Body-CTA");
        fbVersion.setVoiceAligned(true);
        fbVersion.setVoiceScore(95);
        fbVersion.setVoiceNotes("FB: High authority, clear and persuasive");
        fbVersion.setStatus(ContentVersionStatus.GENERATED);
        fbVersion = contentVersionRepository.save(fbVersion);

        // IG initial version
        igVersion = new ContentVersion();
        igVersion.setContentItem(item);
        igVersion.setPlatformName(Platform.INSTAGRAM);
        igVersion.setFormattedCaption("IG Initial Caption");
        igVersion.setMediaPrompt("IG Initial Media Prompt");
        igVersion.setImagePrompt("IG Aesthetic Pastel Workspace Visual");
        igVersion.setScript("IG Reel Visual Script");
        igVersion.setVoiceAligned(true);
        igVersion.setVoiceScore(82);
        igVersion.setVoiceNotes("IG: Vibrant, conversational, highly visual");
        igVersion.setStatus(ContentVersionStatus.GENERATED);
        igVersion = contentVersionRepository.save(igVersion);

        // THREADS initial version
        thVersion = new ContentVersion();
        thVersion.setContentItem(item);
        thVersion.setPlatformName(Platform.THREADS);
        thVersion.setFormattedCaption("TH Initial Caption");
        thVersion.setMediaPrompt("TH Initial Media Prompt");
        thVersion.setImagePrompt("TH Minimalist Graphic Prompt");
        thVersion.setScript("TH Short Opinion Script");
        thVersion.setVoiceAligned(false);
        thVersion.setVoiceScore(65);
        thVersion.setVoiceNotes("TH: Slightly aggressive, needs softening");
        thVersion.setStatus(ContentVersionStatus.GENERATED);
        thVersion = contentVersionRepository.save(thVersion);
    }

    @Test
    @DisplayName("Permutation: All 3 platforms formatted in a single job inherit distinct brand voice and image prompt")
    void allPlatformsFormattingInheritsDistinctBrandVoiceMetrics() {
        when(aiServiceClient.format(any())).thenAnswer(inv -> {
            FormatPayload payload = inv.getArgument(0);
            String platformStr = payload.getPlatforms().getFirst();
            return FormatResultPayload.builder().versions(List.of(
                    ContentVersionPayload.builder()
                            .platformName(platformStr)
                            .formattedCaption("AI formatted caption for " + platformStr)
                            .formattedHashtags(List.of("tag_" + platformStr.toLowerCase()))
                            .cta("CTA for " + platformStr)
                            .mediaFormat("image")
                            .build()
            )).build();
        });

        ContentFormattingJob job = runFormatting(List.of(Platform.FACEBOOK, Platform.INSTAGRAM, Platform.THREADS));
        assertEquals(GenerationJobStatus.SUCCESS, job.getStatus(), job.getErrorMessage());

        // Verify FACEBOOK inheritance
        List<ContentVersion> activeFb = activeVersions(Platform.FACEBOOK);
        assertEquals(1, activeFb.size());
        ContentVersion fbFormatted = activeFb.getFirst();
        assertNotEquals(fbVersion.getId(), fbFormatted.getId());
        assertEquals(fbVersion.getId(), fbFormatted.getSourceVersionId());
        assertEquals(ContentVersionStatus.FORMATTED, fbFormatted.getStatus());
        assertEquals("FB Realistic Tech Office Banner", fbFormatted.getImagePrompt());
        assertEquals("FB Initial Media Prompt", fbFormatted.getMediaPrompt());
        assertEquals("FB Script Hook-Body-CTA", fbFormatted.getScript());
        assertEquals(Boolean.TRUE, fbFormatted.getVoiceAligned());
        assertEquals(95, fbFormatted.getVoiceScore());
        assertEquals("FB: High authority, clear and persuasive", fbFormatted.getVoiceNotes());

        // Verify INSTAGRAM inheritance
        List<ContentVersion> activeIg = activeVersions(Platform.INSTAGRAM);
        assertEquals(1, activeIg.size());
        ContentVersion igFormatted = activeIg.getFirst();
        assertNotEquals(igVersion.getId(), igFormatted.getId());
        assertEquals(igVersion.getId(), igFormatted.getSourceVersionId());
        assertEquals(ContentVersionStatus.FORMATTED, igFormatted.getStatus());
        assertEquals("IG Aesthetic Pastel Workspace Visual", igFormatted.getImagePrompt());
        assertEquals("IG Initial Media Prompt", igFormatted.getMediaPrompt());
        assertEquals("IG Reel Visual Script", igFormatted.getScript());
        assertEquals(Boolean.TRUE, igFormatted.getVoiceAligned());
        assertEquals(82, igFormatted.getVoiceScore());
        assertEquals("IG: Vibrant, conversational, highly visual", igFormatted.getVoiceNotes());

        // Verify THREADS inheritance
        List<ContentVersion> activeTh = activeVersions(Platform.THREADS);
        assertEquals(1, activeTh.size());
        ContentVersion thFormatted = activeTh.getFirst();
        assertNotEquals(thVersion.getId(), thFormatted.getId());
        assertEquals(thVersion.getId(), thFormatted.getSourceVersionId());
        assertEquals(ContentVersionStatus.FORMATTED, thFormatted.getStatus());
        assertEquals("TH Minimalist Graphic Prompt", thFormatted.getImagePrompt());
        assertEquals("TH Initial Media Prompt", thFormatted.getMediaPrompt());
        assertEquals("TH Short Opinion Script", thFormatted.getScript());
        assertEquals(Boolean.FALSE, thFormatted.getVoiceAligned());
        assertEquals(65, thFormatted.getVoiceScore());
        assertEquals("TH: Slightly aggressive, needs softening", thFormatted.getVoiceNotes());

        // Verify initial versions are soft deleted
        assertTrue(contentVersionRepository.findById(fbVersion.getId()).orElseThrow().getDeletedAt() != null);
        assertTrue(contentVersionRepository.findById(igVersion.getId()).orElseThrow().getDeletedAt() != null);
        assertTrue(contentVersionRepository.findById(thVersion.getId()).orElseThrow().getDeletedAt() != null);
    }

    @Test
    @DisplayName("Repeated re-formatting chains preserve root sourceVersionId and brand voice without degradation")
    void repeatedReformattingChainsPreserveSourceLineageAndBrandVoice() {
        when(aiServiceClient.format(any())).thenAnswer(inv -> {
            FormatPayload payload = inv.getArgument(0);
            String platformStr = payload.getPlatforms().getFirst();
            return FormatResultPayload.builder().versions(List.of(
                    ContentVersionPayload.builder()
                            .platformName(platformStr)
                            .formattedCaption("AI formatted caption round")
                            .formattedHashtags(List.of("reformat"))
                            .cta("Check now")
                            .mediaFormat("image")
                            .build()
            )).build();
        });

        UUID rootSourceId = fbVersion.getId();

        // Round 1: Format from GENERATED to FORMATTED (v1)
        ContentFormattingJob job1 = runFormatting(List.of(Platform.FACEBOOK));
        assertEquals(GenerationJobStatus.SUCCESS, job1.getStatus());
        ContentVersion v1 = activeVersions(Platform.FACEBOOK).getFirst();
        assertEquals(rootSourceId, v1.getSourceVersionId());
        assertEquals(95, v1.getVoiceScore());
        assertEquals("FB Realistic Tech Office Banner", v1.getImagePrompt());

        // Round 2: Re-format from v1 to v2 ("Định dạng lại" round 1)
        ContentFormattingJob job2 = runFormatting(List.of(Platform.FACEBOOK));
        assertEquals(GenerationJobStatus.SUCCESS, job2.getStatus());
        ContentVersion v2 = activeVersions(Platform.FACEBOOK).getFirst();
        assertNotEquals(v1.getId(), v2.getId());
        // Crucial: sourceVersionId must remain the ROOT source ID, not v1!
        assertEquals(rootSourceId, v2.getSourceVersionId(), "Re-formatting must trace back to the root source version");
        assertEquals(Boolean.TRUE, v2.getVoiceAligned());
        assertEquals(95, v2.getVoiceScore());
        assertEquals("FB: High authority, clear and persuasive", v2.getVoiceNotes());
        assertEquals("FB Realistic Tech Office Banner", v2.getImagePrompt());
        assertEquals("FB Initial Media Prompt", v2.getMediaPrompt());

        // Round 3: Re-format from v2 to v3 ("Định dạng lại" round 2)
        ContentFormattingJob job3 = runFormatting(List.of(Platform.FACEBOOK));
        assertEquals(GenerationJobStatus.SUCCESS, job3.getStatus());
        ContentVersion v3 = activeVersions(Platform.FACEBOOK).getFirst();
        assertNotEquals(v2.getId(), v3.getId());
        assertEquals(rootSourceId, v3.getSourceVersionId(), "Chain length 3 must still point to root source");
        assertEquals(Boolean.TRUE, v3.getVoiceAligned());
        assertEquals(95, v3.getVoiceScore());
        assertEquals("FB: High authority, clear and persuasive", v3.getVoiceNotes());
        assertEquals("FB Realistic Tech Office Banner", v3.getImagePrompt());

        // Round 4: Re-format from v3 to v4 ("Định dạng lại" round 3)
        ContentFormattingJob job4 = runFormatting(List.of(Platform.FACEBOOK));
        assertEquals(GenerationJobStatus.SUCCESS, job4.getStatus());
        ContentVersion v4 = activeVersions(Platform.FACEBOOK).getFirst();
        assertNotEquals(v3.getId(), v4.getId());
        assertEquals(rootSourceId, v4.getSourceVersionId(), "Chain length 4 must still point to root source");
        assertEquals(Boolean.TRUE, v4.getVoiceAligned());
        assertEquals(95, v4.getVoiceScore());
        assertEquals("FB: High authority, clear and persuasive", v4.getVoiceNotes());
        assertEquals("FB Realistic Tech Office Banner", v4.getImagePrompt());

        // Verify intermediate versions v1, v2, v3 are all soft-deleted
        assertNotNull(contentVersionRepository.findById(v1.getId()).orElseThrow().getDeletedAt());
        assertNotNull(contentVersionRepository.findById(v2.getId()).orElseThrow().getDeletedAt());
        assertNotNull(contentVersionRepository.findById(v3.getId()).orElseThrow().getDeletedAt());
        assertNull(v4.getDeletedAt());
    }

    @Test
    @DisplayName("Edge Case: Source version with null brand voice fields reformats gracefully")
    void nullBrandVoiceFieldsReformatGracefully() {
        // Create an item and version with null brand voice fields
        ContentItem nullItem = new ContentItem();
        nullItem.setBrandProfile(fbVersion.getContentItem().getBrandProfile());
        nullItem.applyResolvedStatus(ContentItemStatus.GENERATED);
        nullItem.setReviewStatus(ReviewStatus.APPROVED);
        nullItem = contentItemRepository.save(nullItem);

        ContentVersion nullVersion = new ContentVersion();
        nullVersion.setContentItem(nullItem);
        nullVersion.setPlatformName(Platform.FACEBOOK);
        nullVersion.setFormattedCaption("Null Voice Caption");
        nullVersion.setMediaPrompt("Media Prompt");
        nullVersion.setImagePrompt(null);
        nullVersion.setVoiceAligned(null);
        nullVersion.setVoiceScore(null);
        nullVersion.setVoiceNotes(null);
        nullVersion.setStatus(ContentVersionStatus.GENERATED);
        nullVersion = contentVersionRepository.save(nullVersion);

        when(aiServiceClient.format(any())).thenReturn(FormatResultPayload.builder().versions(List.of(
                ContentVersionPayload.builder()
                        .platformName("Facebook")
                        .formattedCaption("AI caption")
                        .formattedHashtags(List.of("tag"))
                        .cta("CTA")
                        .mediaFormat("image")
                        .build()
        )).build());

        UUID jobId = formattingService.startFormatting(email, nullItem.getId(),
                ContentFormatRequest.builder().platforms(List.of(Platform.FACEBOOK)).build()).getResult().getId();

        ContentFormattingJob job = waitForJob(jobId);
        assertEquals(GenerationJobStatus.SUCCESS, job.getStatus());

        List<ContentVersion> active = contentVersionRepository
                .findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(nullItem.getId(), Platform.FACEBOOK);
        assertEquals(1, active.size());
        ContentVersion formatted = active.getFirst();
        assertNull(formatted.getVoiceScore());
        assertNull(formatted.getVoiceAligned());
        assertNull(formatted.getVoiceNotes());
        assertNull(formatted.getImagePrompt());
    }

    private ContentFormattingJob runFormatting(List<Platform> platforms) {
        UUID jobId = formattingService.startFormatting(email, item.getId(),
                ContentFormatRequest.builder().platforms(platforms).build()).getResult().getId();
        return waitForJob(jobId);
    }

    private ContentFormattingJob waitForJob(UUID jobId) {
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

    private List<ContentVersion> activeVersions(Platform platform) {
        return contentVersionRepository.findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(item.getId(), platform);
    }
}
