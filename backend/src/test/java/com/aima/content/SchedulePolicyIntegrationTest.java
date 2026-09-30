package com.aima.content;

import com.aima.dto.request.ContentItemReviewRequest;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.dto.request.PublishingSettingsRequest;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.NotificationRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.scheduler.HeldScheduleOverdueJob;
import com.aima.service.ContentItemService;
import com.aima.service.PostScheduleService;
import com.aima.service.PublishingSettingsService;
import com.aima.service.ScheduleHoldService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.AopTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Phase 2: duyệt theo policy, tạm giữ nhiều lý do, sửa bài đã lên lịch, khóa khi đang đăng, chặn IG/brand voice,
 * nhắc lịch tạm giữ quá giờ. Repository + resolver + dịch vụ thật trên H2.
 */
@SpringBootTest
class SchedulePolicyIntegrationTest {

    @Autowired PostScheduleService scheduleService;
    @Autowired ContentItemService contentItemService;
    @Autowired PublishingSettingsService settingsService;
    @Autowired ScheduleHoldService holdService;
    @Autowired HeldScheduleOverdueJob overdueJob;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired PlatformAccountRepository accountRepository;
    @Autowired PostScheduleRepository scheduleRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired TransactionTemplate tx;

    String email;
    User user;
    BrandProfile brand;
    PlatformAccount page;

    @BeforeEach
    void fixture() {
        email = "policy-" + UUID.randomUUID() + "@it.local";
        user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Policy IT").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);
        page = account(Platform.FACEBOOK, PlatformAccountType.PAGE);
    }

    // ===== duyệt theo policy

    @Test
    void requireApprovalHoldsUntilApprovedAndApprovalInTimeResumes() {
        policy(true, false, null);
        ContentItem item = item(ReviewStatus.NONE);
        PostScheduleResponse created = schedule(version(item, Platform.FACEBOOK, 90), Duration.ofDays(1));
        assertEquals(ScheduleStatus.ON_HOLD, created.getStatus());
        assertEquals(List.of(HoldReason.PENDING_REVIEW), created.getHoldReasons());
        assertStatus(item, ContentItemStatus.ON_HOLD);

        review(item, ReviewStatus.NEED_REVIEW);
        assertEquals(List.of(HoldReason.PENDING_REVIEW), reasons(created.getId()));
        review(item, ReviewStatus.APPROVED);
        PostScheduleResponse resumed = get(created.getId());
        assertEquals(ScheduleStatus.SCHEDULED, resumed.getStatus());
        assertEquals(List.of(), resumed.getHoldReasons());
        assertStatus(item, ContentItemStatus.SCHEDULED);
    }

    @Test
    void lateApprovalDoesNotAutoPublishAndMarksOverdue() {
        policy(true, false, null);
        ContentItem item = item(ReviewStatus.NEED_REVIEW);
        UUID id = schedule(version(item, Platform.FACEBOOK, 90), Duration.ofDays(1)).getId();
        movePast(id);

        review(item, ReviewStatus.APPROVED);
        PostScheduleResponse held = get(id);
        assertEquals(ScheduleStatus.ON_HOLD, held.getStatus(), "duyệt muộn không tự đăng");
        assertEquals(List.of(), held.getHoldReasons());
        assertTrue(held.isOverdue());

        PostScheduleResponse rescheduled = scheduleService.update(email, id, PostScheduleUpdateRequest.builder()
                .scheduledTime(Instant.now().plus(Duration.ofHours(2))).build()).getResult();
        assertEquals(ScheduleStatus.SCHEDULED, rescheduled.getStatus(), "chọn giờ mới khi hết lý do → kích hoạt lại");
    }

    @Test
    void togglingPolicyReappliesToExistingSchedules() {
        ContentItem item = item(ReviewStatus.NONE);
        UUID id = schedule(version(item, Platform.FACEBOOK, 90), Duration.ofDays(1)).getId();
        assertEquals(ScheduleStatus.SCHEDULED, get(id).getStatus(), "policy tắt: không chặn vì duyệt");

        policy(true, false, null);
        assertEquals(List.of(HoldReason.PENDING_REVIEW), reasons(id));
        assertStatus(item, ContentItemStatus.ON_HOLD);

        policy(false, false, null);
        assertEquals(ScheduleStatus.SCHEDULED, get(id).getStatus());
        assertStatus(item, ContentItemStatus.SCHEDULED);
    }

    // ===== nhiều lý do, mỗi luồng gỡ đúng lý do của mình

    @Test
    void multipleReasonsAreReleasedIndependently() {
        policy(true, false, null);
        ContentItem item = item(ReviewStatus.NEED_REVIEW);
        UUID id = schedule(version(item, Platform.FACEBOOK, 90), Duration.ofDays(1)).getId();
        assertEquals(1, holdService.holdForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_ISSUE));
        assertEquals(List.of(HoldReason.ACCOUNT_ISSUE, HoldReason.PENDING_REVIEW), reasons(id));

        review(item, ReviewStatus.APPROVED);
        assertEquals(ScheduleStatus.ON_HOLD, get(id).getStatus());
        assertEquals(List.of(HoldReason.ACCOUNT_ISSUE), reasons(id));

        assertEquals(1, holdService.releaseForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_ISSUE));
        assertEquals(ScheduleStatus.SCHEDULED, get(id).getStatus());
    }

    @Test
    void reconnectOnlyRemovesAccountIssue() {
        ContentItem item = item(ReviewStatus.NONE);
        UUID id = schedule(version(item, Platform.FACEBOOK, 90), Duration.ofDays(1)).getId();
        holdService.holdForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_ISSUE);
        holdService.holdForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_REMOVED);

        assertEquals(0, holdService.releaseForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_ISSUE));
        assertEquals(ScheduleStatus.ON_HOLD, get(id).getStatus());
        assertEquals(List.of(HoldReason.ACCOUNT_REMOVED), reasons(id));
    }

    @Test
    void pendingDeletionHoldIsLiftedOnRestoreButNeedsReactivation() {
        ContentItem item = item(ReviewStatus.NONE);
        UUID id = schedule(version(item, Platform.FACEBOOK, 90), Duration.ofDays(1)).getId();
        assertEquals(1, scheduleService.holdAllForPendingDeletion(user.getId()));
        assertEquals(List.of(HoldReason.USER_PENDING_DELETE), reasons(id));

        assertEquals(1, scheduleService.releasePendingDeletionHolds(user.getId()));
        assertEquals(ScheduleStatus.ON_HOLD, get(id).getStatus(), "khôi phục không tự đăng lại");
        assertEquals(List.of(), reasons(id));

        assertEquals(ScheduleStatus.SCHEDULED, scheduleService.update(email, id, PostScheduleUpdateRequest.builder()
                .scheduledTime(Instant.now().plus(Duration.ofDays(1))).build()).getResult().getStatus());
    }

    // ===== sửa bài đã lên lịch

    @Test
    void noOpEditKeepsApprovalAndRevision() {
        ContentItem item = item(ReviewStatus.APPROVED);
        ContentVersion version = version(item, Platform.FACEBOOK, 90);
        schedule(version, Duration.ofDays(1));

        var response = contentItemService.updateVersion(email, item.getId(), version.getId(),
                ContentVersionUpdateRequest.builder().caption(version.getFormattedCaption()).build()).getResult();
        assertEquals(ReviewStatus.APPROVED, response.getReviewStatus());
        assertEquals(0, contentVersionRepository.findById(version.getId()).orElseThrow().getRevision());
    }

    @Test
    void editingScheduledContentInvalidatesApprovalAndHoldsOnlyWhenPolicyOn() {
        ContentItem item = item(ReviewStatus.APPROVED);
        ContentVersion version = version(item, Platform.FACEBOOK, 90);
        UUID id = schedule(version, Duration.ofDays(1)).getId();

        var edited = contentItemService.updateVersion(email, item.getId(), version.getId(),
                ContentVersionUpdateRequest.builder().caption("Caption mới").build()).getResult();
        assertEquals(ReviewStatus.NEED_REVIEW, edited.getReviewStatus(), "policy tắt vẫn bỏ hiệu lực duyệt cũ");
        assertEquals(ScheduleStatus.SCHEDULED, get(id).getStatus(), "policy tắt không chặn đăng vì duyệt");
        assertEquals(1, contentVersionRepository.findById(version.getId()).orElseThrow().getRevision());

        policy(true, false, null);
        review(item, ReviewStatus.APPROVED);
        assertEquals(ScheduleStatus.SCHEDULED, get(id).getStatus());
        contentItemService.updateVersion(email, item.getId(), version.getId(),
                ContentVersionUpdateRequest.builder().caption("Caption mới hơn").build());
        assertEquals(List.of(HoldReason.PENDING_REVIEW), reasons(id), "policy bật: sửa → giữ lịch chờ duyệt lại");
        assertStatus(item, ContentItemStatus.ON_HOLD);
    }

    @Test
    void onlyPostingLocksEditing() {
        ContentItem item = item(ReviewStatus.NONE);
        ContentVersion version = version(item, Platform.FACEBOOK, 90);
        UUID id = schedule(version, Duration.ofDays(1)).getId();
        tx.executeWithoutResult(s -> scheduleRepository.findById(id).orElseThrow().setStatus(ScheduleStatus.POSTING));

        AppException locked = assertThrows(AppException.class, () -> contentItemService.updateVersion(email, item.getId(),
                version.getId(), ContentVersionUpdateRequest.builder().caption("x").build()));
        assertEquals(ErrorCode.CONTENT_VERSION_POSTING_LOCKED, locked.getErrorCode());
    }

    // ===== chặn ở BE

    @Test
    void instagramAndLowBrandVoiceAreBlocked() {
        account(Platform.INSTAGRAM, PlatformAccountType.BUSINESS_ACCOUNT);
        ContentItem item = item(ReviewStatus.NONE);
        ContentVersion ig = version(item, Platform.INSTAGRAM, 90);
        assertEquals(ErrorCode.SCHEDULE_PLATFORM_UNSUPPORTED,
                assertThrows(AppException.class, () -> schedule(ig, Duration.ofDays(1))).getErrorCode());

        policy(false, true, 70);
        ContentVersion weak = version(item, Platform.FACEBOOK, 50);
        assertEquals(ErrorCode.BRAND_VOICE_BELOW_THRESHOLD,
                assertThrows(AppException.class, () -> schedule(weak, Duration.ofDays(1))).getErrorCode());
        assertEquals(ScheduleStatus.SCHEDULED, schedule(version(item, Platform.FACEBOOK, 80), Duration.ofDays(1)).getStatus());
    }

    @Test
    void settingsAreValidated() {
        assertEquals(ErrorCode.PUBLISHING_TIMEZONE_INVALID, assertThrows(AppException.class, () -> settingsService.update(email,
                settings("Mars/Olympus", false, false, null))).getErrorCode());
        assertEquals(ErrorCode.BRAND_VOICE_THRESHOLD_INVALID, assertThrows(AppException.class, () -> settingsService.update(email,
                settings("Asia/Ho_Chi_Minh", false, true, null))).getErrorCode());
        assertEquals("Asia/Tokyo", settingsService.update(email, settings("Asia/Tokyo", false, false, null)).getResult().getTimezone());
        assertEquals("Asia/Tokyo", settingsService.get(email).getResult().getTimezone());
    }

    // ===== nhắc lịch tạm giữ quá giờ — một lần/lịch

    @Test
    void overdueHeldScheduleIsRemindedOnce() {
        ContentItem item = item(ReviewStatus.NONE);
        UUID id = schedule(version(item, Platform.FACEBOOK, 90), Duration.ofDays(1)).getId();
        holdService.holdForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_ISSUE);
        movePast(id);

        HeldScheduleOverdueJob job = AopTestUtils.getTargetObject(overdueJob);
        job.run();
        job.run();
        long reminders = notificationRepository.findAll().stream()
                .filter(n -> n.getDedupeKey() != null && n.getDedupeKey().startsWith("schedule-overdue:" + id))
                .count();
        assertEquals(1, reminders);
    }

    // ===== helpers

    private void policy(boolean requireApproval, boolean blockVoice, Integer threshold) {
        settingsService.update(email, settings("Asia/Ho_Chi_Minh", requireApproval, blockVoice, threshold));
    }

    private static PublishingSettingsRequest settings(String tz, boolean approval, boolean block, Integer threshold) {
        return PublishingSettingsRequest.builder().timezone(tz).requireApproval(approval).conflictWindowMinutes(60)
                .brandVoiceBlockingEnabled(block).brandVoiceThreshold(threshold).build();
    }

    private void review(ContentItem item, ReviewStatus target) {
        contentItemService.updateReview(email, item.getId(), ContentItemReviewRequest.builder().reviewStatus(target).build());
    }

    private PostScheduleResponse schedule(ContentVersion version, Duration in) {
        PlatformAccount target = accountRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(user.getId()).stream()
                .filter(a -> a.getPlatformName() == version.getPlatformName()).findFirst().orElseThrow();
        return scheduleService.create(email, PostScheduleRequest.builder().contentVersionId(version.getId())
                .platformAccountId(target.getId()).scheduledTime(Instant.now().plus(in)).build(), null).getResult();
    }

    private PostScheduleResponse get(UUID scheduleId) {
        return scheduleService.get(email, scheduleId).getResult();
    }

    private List<HoldReason> reasons(UUID scheduleId) {
        return get(scheduleId).getHoldReasons();
    }

    private void movePast(UUID scheduleId) {
        tx.executeWithoutResult(s -> {
            PostSchedule schedule = scheduleRepository.findById(scheduleId).orElseThrow();
            schedule.setScheduledTime(Instant.now().minus(Duration.ofMinutes(30)));
        });
    }

    private void assertStatus(ContentItem item, ContentItemStatus expected) {
        assertEquals(expected, contentItemRepository.findById(item.getId()).orElseThrow().getStatus());
    }

    private ContentItem item(ReviewStatus review) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        item.setReviewStatus(review);
        return contentItemRepository.save(item);
    }

    private ContentVersion version(ContentItem item, Platform platform, int voiceScore) {
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(platform);
        version.setFormattedCaption("Caption " + UUID.randomUUID());
        version.setVoiceScore(voiceScore);
        version.setStatus(ContentVersionStatus.FORMATTED);
        return contentVersionRepository.save(version);
    }

    private PlatformAccount account(Platform platform, PlatformAccountType type) {
        PlatformAccount a = new PlatformAccount();
        a.setUser(user);
        a.setPlatformName(platform);
        a.setPlatformAccountId(platform + "-" + UUID.randomUUID());
        a.setAccountName("IT " + platform);
        a.setAccountType(type);
        a.setTokenType(TokenType.PAGE_TOKEN);
        a.setAccessToken("fake-token");
        a.setConnectionStatus(ConnectionStatus.ACTIVE);
        return accountRepository.save(a);
    }
}
