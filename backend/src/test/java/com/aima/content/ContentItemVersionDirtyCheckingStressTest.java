package com.aima.content;

import com.aima.dto.common.ScriptSectionDto;
import com.aima.dto.common.ScriptStepDto;
import com.aima.dto.common.VideoScriptDto;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentItemResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.User;
import com.aima.enums.*;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentItemService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Adversarial empirical stress tests for ContentItemServiceImpl dirty-checking,
 * revision bumping, DB persistence, and ContentVersionUpdateRequest partial mapping.
 */
@SpringBootTest
class ContentItemVersionDirtyCheckingStressTest {

    @Autowired ContentItemService service;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;

    private String email;
    private BrandProfile brand;

    @BeforeEach
    void setupOwner() {
        email = "dirty-check-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Dirty Check Challenger").password("{noop}secret")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Stress Test Brand");
        brand.setIndustry("Cosmetics");
        brand.setTargetAudience("Gen Z");
        brand = brandProfileRepository.save(brand);
    }

    private ContentItem createItemWithVersion(Boolean voiceAligned, Integer voiceScore, String voiceNotes) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        item.setReviewStatus(ReviewStatus.NONE);
        item = contentItemRepository.save(item);

        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setFormattedCaption("Ban dau caption");
        version.setFormattedHashtag("aima,beauty");
        version.setCta("Nhan link ngay");
        version.setMediaPrompt("Video quay gan 15 giay");
        version.setVoiceAligned(voiceAligned);
        version.setVoiceScore(voiceScore);
        version.setVoiceNotes(voiceNotes);
        version.setStatus(ContentVersionStatus.FORMATTED);
        version.setRevision(1);

        version = contentVersionRepository.save(version);
        item.getContentVersions().add(version);
        return contentItemRepository.save(item);
    }

    @Test
    @DisplayName("Solely updating voiceScore must bump revision and persist to DB")
    void soleVoiceScoreUpdateBumpsRevisionAndPersistsToDb() {
        ContentItem item = createItemWithVersion(true, 80, "Giong van on dinh");
        UUID versionId = item.getContentVersions().getFirst().getId();

        ApiResponse<ContentItemResponse> response = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceScore(95).build()
        );

        assertEquals(200, response.getCode());
        assertEquals("Cập nhật bản nội dung thành công", response.getMessage());

        // Verify response payload
        ContentItemResponse itemResp = response.getResult();
        var verResp = itemResp.getVersions().stream()
                .filter(v -> v.getId().equals(versionId)).findFirst().orElseThrow();
        assertEquals(95, verResp.getVoiceScore());
        assertEquals(Boolean.TRUE, verResp.getVoiceAligned());
        assertEquals("Giong van on dinh", verResp.getVoiceNotes());
        assertEquals("Ban dau caption", verResp.getFormattedCaption());

        // Verify direct reload from database
        ContentVersion reloaded = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(95, reloaded.getVoiceScore());
        assertEquals(2, reloaded.getRevision(), "Revision must be incremented from 1 to 2");
        assertEquals(Boolean.TRUE, reloaded.getVoiceAligned());
        assertEquals("Giong van on dinh", reloaded.getVoiceNotes());
        assertEquals("Ban dau caption", reloaded.getFormattedCaption());
    }

    @Test
    @DisplayName("Updating with identical voiceScore must return 'Nội dung không đổi' and NOT bump revision")
    void identicalVoiceScoreUpdateReturnsNoChangesAndDoesNotBumpRevision() {
        ContentItem item = createItemWithVersion(true, 95, "Giong van on dinh");
        UUID versionId = item.getContentVersions().getFirst().getId();

        // Send exact same voiceScore
        ApiResponse<ContentItemResponse> response = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceScore(95).build()
        );

        assertEquals(200, response.getCode());
        assertEquals("Nội dung không đổi", response.getMessage());

        // Verify database entity is untouched
        ContentVersion reloaded = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(1, reloaded.getRevision(), "Revision must remain 1 when content is unchanged");
        assertEquals(95, reloaded.getVoiceScore());
    }

    @Test
    @DisplayName("Solely updating voiceAligned bumps revision, and repeating it returns 'Nội dung không đổi'")
    void soleVoiceAlignedUpdateDirtyChecking() {
        ContentItem item = createItemWithVersion(true, 85, "Initial notes");
        UUID versionId = item.getContentVersions().getFirst().getId();

        // 1. Update voiceAligned to false
        ApiResponse<ContentItemResponse> resp1 = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceAligned(false).build()
        );
        assertEquals("Cập nhật bản nội dung thành công", resp1.getMessage());

        ContentVersion reloaded1 = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(Boolean.FALSE, reloaded1.getVoiceAligned());
        assertEquals(2, reloaded1.getRevision());

        // 2. Submit voiceAligned=false again -> no-op
        ApiResponse<ContentItemResponse> resp2 = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceAligned(false).build()
        );
        assertEquals("Nội dung không đổi", resp2.getMessage());

        ContentVersion reloaded2 = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(2, reloaded2.getRevision(), "Revision must not bump on identical update");
    }

    @Test
    @DisplayName("Solely updating voiceNotes bumps revision, and repeating it returns 'Nội dung không đổi'")
    void soleVoiceNotesUpdateDirtyChecking() {
        ContentItem item = createItemWithVersion(true, 85, "Initial notes");
        UUID versionId = item.getContentVersions().getFirst().getId();

        // 1. Update voiceNotes
        ApiResponse<ContentItemResponse> resp1 = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceNotes("Dieu chinh them ve CTA").build()
        );
        assertEquals("Cập nhật bản nội dung thành công", resp1.getMessage());

        ContentVersion reloaded1 = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals("Dieu chinh them ve CTA", reloaded1.getVoiceNotes());
        assertEquals(2, reloaded1.getRevision());

        // 2. Repeat exact notes
        ApiResponse<ContentItemResponse> resp2 = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceNotes("Dieu chinh them ve CTA").build()
        );
        assertEquals("Nội dung không đổi", resp2.getMessage());

        ContentVersion reloaded2 = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(2, reloaded2.getRevision());
    }

    @Test
    @DisplayName("Null to value transition for brand voice fields triggers dirty checking properly")
    void nullToValueTransitionTriggersDirtyCheck() {
        // Initial version with all brand voice fields null
        ContentItem item = createItemWithVersion(null, null, null);
        UUID versionId = item.getContentVersions().getFirst().getId();

        ApiResponse<ContentItemResponse> response = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder()
                        .voiceAligned(true)
                        .voiceScore(88)
                        .voiceNotes("Xac lap brand voice moi")
                        .build()
        );

        assertEquals("Cập nhật bản nội dung thành công", response.getMessage());

        ContentVersion reloaded = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(Boolean.TRUE, reloaded.getVoiceAligned());
        assertEquals(88, reloaded.getVoiceScore());
        assertEquals("Xac lap brand voice moi", reloaded.getVoiceNotes());
        assertEquals(2, reloaded.getRevision());
    }

    @Test
    @DisplayName("MapStruct partial update does not overwrite omitted fields with null")
    void mapstructPartialUpdatePreservesOmittedFields() {
        ContentItem item = createItemWithVersion(true, 92, "Original voice notes");
        UUID versionId = item.getContentVersions().getFirst().getId();

        // Send update with ONLY voiceScore = 93. Caption, hashtags, script, etc. are null in request.
        service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceScore(93).build()
        );

        ContentVersion reloaded = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(93, reloaded.getVoiceScore());
        // Verify all other fields are intact and NOT set to null
        assertEquals(Boolean.TRUE, reloaded.getVoiceAligned());
        assertEquals("Original voice notes", reloaded.getVoiceNotes());
        assertEquals("Ban dau caption", reloaded.getFormattedCaption());
        assertEquals("aima,beauty", reloaded.getFormattedHashtag());
        assertEquals("Nhan link ngay", reloaded.getCta());
        assertEquals("Video quay gan 15 giay", reloaded.getMediaPrompt());

        // Now update ONLY caption
        service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().caption("Caption da sua").build()
        );

        ContentVersion reloaded2 = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals("Caption da sua", reloaded2.getFormattedCaption());
        // Brand voice fields must still be intact
        assertEquals(93, reloaded2.getVoiceScore());
        assertEquals(Boolean.TRUE, reloaded2.getVoiceAligned());
        assertEquals("Original voice notes", reloaded2.getVoiceNotes());
        assertEquals(3, reloaded2.getRevision());
    }

    @Test
    @DisplayName("Approved item demotes to NEED_REVIEW when brand voice changes, but stays APPROVED on no-op")
    void approvedItemDemotesOnBrandVoiceChange() {
        ContentItem item = createItemWithVersion(true, 85, "Good voice");
        item.setReviewStatus(ReviewStatus.APPROVED);
        item = contentItemRepository.save(item);
        UUID versionId = item.getContentVersions().getFirst().getId();

        // 1. Submit identical voiceScore -> no-op -> remains APPROVED
        ApiResponse<ContentItemResponse> noOpResp = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceScore(85).build()
        );
        assertEquals("Nội dung không đổi", noOpResp.getMessage());
        assertEquals(ReviewStatus.APPROVED, noOpResp.getResult().getReviewStatus());

        // 2. Submit changed voiceScore -> changes content -> demoted to NEED_REVIEW
        ApiResponse<ContentItemResponse> changeResp = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().voiceScore(70).build()
        );
        assertEquals("Cập nhật bản nội dung thành công", changeResp.getMessage());
        assertEquals(ReviewStatus.NEED_REVIEW, changeResp.getResult().getReviewStatus());
    }

    @Test
    @DisplayName("Updating structured script preserves brand voice fields")
    void updatingScriptPreservesBrandVoiceFields() {
        ContentItem item = createItemWithVersion(true, 90, "Brand notes");
        UUID versionId = item.getContentVersions().getFirst().getId();

        VideoScriptDto newScript = VideoScriptDto.builder()
                .hook(ScriptSectionDto.builder().content("New Hook Content").timing("0-2s").build())
                .steps(List.of(ScriptStepDto.builder().index(1).content("New Step 1").build()))
                .cta(ScriptSectionDto.builder().content("Follow us").timing("10-15s").build())
                .build();

        ApiResponse<ContentItemResponse> resp = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().script(newScript).build()
        );
        assertEquals("Cập nhật bản nội dung thành công", resp.getMessage());

        ContentVersion reloaded = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(2, reloaded.getRevision());
        assertEquals(90, reloaded.getVoiceScore());
        assertEquals(Boolean.TRUE, reloaded.getVoiceAligned());
        assertEquals("Brand notes", reloaded.getVoiceNotes());
        assertNotNull(reloaded.getScript());
        assertTrue(reloaded.getScript().contains("New Hook Content"));
    }

    @Test
    @DisplayName("Empty request returns 'Nội dung không đổi' and does not bump revision")
    void emptyUpdateRequestReturnsNoChanges() {
        ContentItem item = createItemWithVersion(true, 90, "Brand notes");
        UUID versionId = item.getContentVersions().getFirst().getId();

        ApiResponse<ContentItemResponse> resp = service.updateVersion(
                email, item.getId(), versionId,
                ContentVersionUpdateRequest.builder().build()
        );
        assertEquals("Nội dung không đổi", resp.getMessage());

        ContentVersion reloaded = contentVersionRepository.findById(versionId).orElseThrow();
        assertEquals(1, reloaded.getRevision());
    }
}
