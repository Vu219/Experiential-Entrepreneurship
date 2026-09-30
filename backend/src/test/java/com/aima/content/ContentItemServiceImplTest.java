package com.aima.content;

import com.aima.dto.request.ContentItemReviewRequest;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.request.ContentWizardStateRequest;
import com.aima.dto.response.ContentItemResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentGenerationJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.ContentVersion;
import com.aima.entity.Trend;
import com.aima.entity.TrendResearchSession;
import com.aima.entity.User;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.ReviewStatus;
import com.aima.enums.StrategyStatus;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.TrendRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentItemService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** FR-33/FR-34 sau khi tách duyệt khỏi trạng thái tổng (Phase 1 D2) — repository + resolver thật trên H2. */
@SpringBootTest
class ContentItemServiceImplTest {

    @Autowired ContentItemService service;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired ContentStrategyRepository contentStrategyRepository;
    @Autowired ContentGenerationJobRepository contentGenerationJobRepository;
    @Autowired TrendResearchSessionRepository trendResearchSessionRepository;
    @Autowired TrendRepository trendRepository;

    String email;
    BrandProfile brand;

    @BeforeEach
    void owner() {
        email = "item-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Item IT").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);
    }

    @Test
    void reviewFlowIsSeparateFromAggregateAndRepeatedSubmitIsNoOp() {
        ContentItem item = item(ContentItemStatus.FORMATTED, ReviewStatus.NONE);
        version(item); // bản FORMATTED thật — đổi duyệt tính lại trạng thái tổng từ dữ liệu, phải vẫn FORMATTED

        ContentItemResponse submitted = review(item, ReviewStatus.NEED_REVIEW);
        assertEquals(ReviewStatus.NEED_REVIEW, submitted.getReviewStatus());
        assertEquals(ContentItemStatus.FORMATTED, submitted.getStatus(), "duyệt không đổi trạng thái tổng");
        assertNull(submitted.getWizardStep(), "gửi duyệt dọn trạng thái wizard");

        assertEquals(ReviewStatus.NEED_REVIEW, review(item, ReviewStatus.NEED_REVIEW).getReviewStatus(), "gửi lặp = no-op");
        assertEquals(ReviewStatus.APPROVED, review(item, ReviewStatus.APPROVED).getReviewStatus());
        assertEquals(ReviewStatus.APPROVED, review(item, ReviewStatus.APPROVED).getReviewStatus(), "duyệt lặp = no-op");

        AppException invalid = assertThrows(AppException.class, () -> review(item, ReviewStatus.CHANGES_REQUESTED));
        assertEquals(ErrorCode.INVALID_CONTENT_STATUS_TRANSITION, invalid.getErrorCode());
        assertEquals(ErrorCode.INVALID_CONTENT_STATUS_TRANSITION,
                assertThrows(AppException.class, () -> review(item, ReviewStatus.NONE)).getErrorCode());
    }

    @Test
    void approvalRequiresSubmissionAndReturnForEditsCanBeResubmitted() {
        ContentItem item = item(ContentItemStatus.GENERATED, ReviewStatus.NONE);
        assertEquals(ErrorCode.INVALID_CONTENT_STATUS_TRANSITION,
                assertThrows(AppException.class, () -> review(item, ReviewStatus.APPROVED)).getErrorCode());
        review(item, ReviewStatus.NEED_REVIEW);
        assertEquals(ReviewStatus.CHANGES_REQUESTED, review(item, ReviewStatus.CHANGES_REQUESTED).getReviewStatus());
        assertEquals(ReviewStatus.NEED_REVIEW, review(item, ReviewStatus.NEED_REVIEW).getReviewStatus());
    }

    @Test
    void editingApprovedContentRequiresReviewAgainButKeepsAggregate() {
        ContentItem item = item(ContentItemStatus.FORMATTED, ReviewStatus.APPROVED);
        ContentVersion version = version(item);

        ContentItemResponse edited = service.updateVersion(email, item.getId(), version.getId(),
                ContentVersionUpdateRequest.builder().caption("Caption mới").build()).getResult();
        assertEquals(ReviewStatus.NEED_REVIEW, edited.getReviewStatus());
        assertEquals(ContentItemStatus.FORMATTED, edited.getStatus());
        assertEquals("Caption mới", edited.getVersions().getFirst().getFormattedCaption());
    }

    @Test
    void onlyPostingBlocksEditsScheduledHeldAndPostedStayEditable() {
        ContentItem posting = item(ContentItemStatus.POSTING, ReviewStatus.APPROVED);
        assertEquals(ErrorCode.CONTENT_ITEM_NOT_EDITABLE, assertThrows(AppException.class,
                () -> service.updateItem(email, posting.getId(),
                        com.aima.dto.request.ContentItemUpdateRequest.builder().caption("x").build())).getErrorCode());
        for (ContentItemStatus editable : new ContentItemStatus[]{ContentItemStatus.SCHEDULED, ContentItemStatus.ON_HOLD,
                ContentItemStatus.POSTED, ContentItemStatus.FAILED, ContentItemStatus.PARTIALLY_POSTED}) {
            ContentItem item = item(editable, ReviewStatus.NONE);
            ContentVersion version = version(item);
            assertEquals("y", service.updateVersion(email, item.getId(), version.getId(),
                    ContentVersionUpdateRequest.builder().caption("y").build()).getResult()
                    .getVersions().getFirst().getFormattedCaption(), editable.name());
        }
    }

    @Test
    void wizardAutosaveAndDeleteOnlyBeforeReviewAndScheduling() {
        ContentItem formatted = item(ContentItemStatus.FORMATTED, ReviewStatus.NONE);
        assertEquals(2, service.updateWizardState(email, formatted.getId(),
                ContentWizardStateRequest.builder().step(2).build()).getResult().getWizardStep(),
                "bài đã định dạng nhưng chưa gửi duyệt vẫn là bài dở của wizard");

        ContentItem inReview = item(ContentItemStatus.FORMATTED, ReviewStatus.NEED_REVIEW);
        assertEquals(ErrorCode.CONTENT_ITEM_NOT_EDITABLE, assertThrows(AppException.class,
                () -> service.updateWizardState(email, inReview.getId(), ContentWizardStateRequest.builder().step(3).build()))
                .getErrorCode());
        assertEquals(ErrorCode.CONTENT_ITEM_NOT_DELETABLE,
                assertThrows(AppException.class, () -> service.delete(email, inReview.getId())).getErrorCode());

        ContentItem scheduled = item(ContentItemStatus.SCHEDULED, ReviewStatus.NONE);
        assertEquals(ErrorCode.CONTENT_ITEM_NOT_DELETABLE,
                assertThrows(AppException.class, () -> service.delete(email, scheduled.getId())).getErrorCode());

        ContentItem returned = item(ContentItemStatus.GENERATED, ReviewStatus.CHANGES_REQUESTED);
        assertNotNull(service.delete(email, returned.getId()).getResult());
    }

    @Test
    void newItemStartsAsDraftWithoutReview() {
        ContentItem item = item(ContentItemStatus.DRAFT, ReviewStatus.NONE);
        ContentItemResponse response = service.getItem(email, item.getId()).getResult();
        assertEquals(ContentItemStatus.DRAFT, response.getStatus());
        assertEquals(ReviewStatus.NONE, response.getReviewStatus());
        assertFalse(response.isNeedsAttention());
    }

    @Test
    void detailExposesGenerationSourceFromLatestSuccessfulJob() {
        ContentItem item = item(ContentItemStatus.GENERATED, ReviewStatus.NEED_REVIEW);
        assertNull(service.getItem(email, item.getId()).getResult().getSource().getStrategyName(),
                "chưa có job sinh → không có chiến lược");

        ContentStrategy strategy = new ContentStrategy();
        strategy.setBrandProfile(brand);
        strategy.setName("Chiến lược IT");
        strategy.setGoals(new java.util.ArrayList<>(List.of("Tăng nhận diện", "Bán hàng")));
        strategy.setFrequencyCount(3);
        strategy.setStatus(StrategyStatus.ACTIVE);
        strategy = contentStrategyRepository.save(strategy);

        TrendResearchSession session = new TrendResearchSession();
        session.setBrandProfile(brand);
        session.setIndustry("Beauty");
        session.setPlatform(Platform.FACEBOOK);
        session.setResearchTime(LocalDateTime.now());
        session = trendResearchSessionRepository.save(session);
        Trend trend = new Trend();
        trend.setResearchSession(session);
        trend.setTrendName("Skincare tối giản");
        trend.setPlatform(Platform.FACEBOOK);
        trend = trendRepository.save(trend);

        job(item, strategy, trend.getId(), GenerationJobStatus.SUCCESS);
        job(item, strategy, UUID.randomUUID(), GenerationJobStatus.FAILED); // job lỗi sau đó không đổi nguồn

        var source = service.getItem(email, item.getId()).getResult().getSource();
        assertEquals("Chiến lược IT", source.getStrategyName());
        assertEquals(List.of("Tăng nhận diện", "Bán hàng"), source.getGoals());
        assertEquals("Skincare tối giản", source.getTrendName());
        assertNull(source.getIdeaTitle());
    }

    private void job(ContentItem item, ContentStrategy strategy, UUID trendId, GenerationJobStatus status) {
        ContentGenerationJob job = new ContentGenerationJob();
        job.setContentItem(item);
        job.setContentStrategy(strategy);
        job.setPlatform(Platform.FACEBOOK);
        job.setTrendId(trendId);
        job.setStatus(status);
        contentGenerationJobRepository.save(job);
    }

    private ContentItemResponse review(ContentItem item, ReviewStatus target) {
        return service.updateReview(email, item.getId(), ContentItemReviewRequest.builder().reviewStatus(target).build())
                .getResult();
    }

    private ContentItem item(ContentItemStatus status, ReviewStatus review) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(status); // fixture: trạng thái tổng dựng sẵn cho kiểm tra guard
        item.setReviewStatus(review);
        item.setWizardStep(3);
        return contentItemRepository.save(item);
    }

    private ContentVersion version(ContentItem item) {
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setFormattedCaption("Caption");
        version.setStatus(ContentVersionStatus.FORMATTED);
        return contentVersionRepository.save(version);
    }
}
