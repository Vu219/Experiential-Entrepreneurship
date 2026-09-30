package com.aima.content;

import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.request.ContentItemReviewRequest;
import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.dto.request.PublishingSettingsRequest;
import com.aima.dto.request.ScheduleBatchRequest;
import com.aima.dto.request.ScheduleBatchRowRequest;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.dto.response.ScheduleBatchResponse;
import com.aima.dto.response.ScheduleRowResult;
import com.aima.dto.response.SuggestedSlotResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleMode;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentItemService;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PostScheduleService;
import com.aima.service.PostingDispatchService;
import com.aima.service.PublishingSettingsService;
import com.aima.service.ScheduleHoldService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Phase 3: API lịch dùng chung — batch theo dòng + idempotency, đăng ngay dùng chung claim với dispatcher,
 * khung giờ gợi ý, cảnh báo trùng lịch, chuyển tài khoản. Worker đăng bài được mock (không gọi nền tảng);
 * URL Meta trỏ vào cổng đóng để mọi lời gọi lọt ra ngoài đều hỏng tại chỗ.
 */
@SpringBootTest(properties = {
        "meta.graph-base-url=http://127.0.0.1:9",
        "meta.threads-base-url=http://127.0.0.1:9",
})
class ScheduleApiIntegrationTest {

    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    @MockitoBean PostPublishWorkerService worker;
    @MockitoBean AiServiceClient aiServiceClient;
    @Autowired PostScheduleService service;
    @Autowired ContentItemService contentItemService;
    @Autowired PublishingSettingsService settingsService;
    @Autowired ScheduleHoldService holdService;
    @Autowired PostingDispatchService dispatchService;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired PlatformAccountRepository accountRepository;
    @Autowired PostScheduleRepository scheduleRepository;
    @Autowired PostRepository postRepository;
    @Autowired TransactionTemplate tx;

    String email;
    User user;
    BrandProfile brand;
    PlatformAccount page;

    @BeforeEach
    void fixture() {
        email = "api-" + UUID.randomUUID() + "@it.local";
        user = saveUser(email);
        brand = brand(user);
        page = account(user, Platform.FACEBOOK, PlatformAccountType.PAGE);
    }

    @Test
    void batchRowsSucceedAndFailIndependentlyWithOwnershipPerRow() {
        ContentItem item = item(ReviewStatus.NONE);
        ContentVersion ok = version(item, Platform.FACEBOOK);
        ContentVersion ig = version(item, Platform.INSTAGRAM);
        PlatformAccount igAccount = account(user, Platform.INSTAGRAM, PlatformAccountType.BUSINESS_ACCOUNT);
        User stranger = saveUser("stranger-" + UUID.randomUUID() + "@it.local");
        ContentVersion foreign = version(itemOf(brand(stranger)), Platform.FACEBOOK);

        ScheduleBatchResponse result = service.createBatch(email, batch(
                row("ok", ok, page, ScheduleMode.SCHEDULE, in(1)),
                row("ig", ig, igAccount, ScheduleMode.SCHEDULE, in(1)),
                row("foreign", foreign, page, ScheduleMode.SCHEDULE, in(1)),
                row("mismatch", version(item, Platform.FACEBOOK), igAccount, ScheduleMode.SCHEDULE, in(1)))).getResult();

        assertEquals(1, result.getSucceeded());
        assertEquals(3, result.getFailed());
        assertEquals(200, rowOf(result, "ok").getCode());
        assertEquals(ErrorCode.SCHEDULE_PLATFORM_UNSUPPORTED.getCode(), rowOf(result, "ig").getCode());
        assertEquals(ErrorCode.CONTENT_VERSION_NOT_FOUND.getCode(), rowOf(result, "foreign").getCode(), "không lên lịch bài người khác");
        assertEquals(ErrorCode.SCHEDULE_PLATFORM_MISMATCH.getCode(), rowOf(result, "mismatch").getCode());
        assertEquals(ScheduleStatus.SCHEDULED, rowOf(result, "ok").getSchedule().getStatus());
    }

    @Test
    void sameKeyReplaysAfterReloadAndOtherPayloadIsRejected() {
        ContentVersion version = version(item(ReviewStatus.NONE), Platform.FACEBOOK);
        Instant time = in(2);
        ScheduleBatchRowRequest row = row("r1", version, page, ScheduleMode.SCHEDULE, time);
        UUID first = rowOf(service.createBatch(email, batch(row)).getResult(), "r1").getSchedule().getId();

        ScheduleRowResult again = rowOf(service.createBatch(email, batch(row)).getResult(), "r1");
        assertEquals(200, again.getCode(), "cùng key + cùng payload → trả lại kết quả, không báo trùng");
        assertEquals(first, again.getSchedule().getId());

        ScheduleBatchRowRequest changed = row("r1", version, page, ScheduleMode.SCHEDULE, time.plus(Duration.ofHours(1)));
        changed.setIdempotencyKey(row.getIdempotencyKey());
        assertEquals(ErrorCode.IDEMPOTENCY_KEY_REUSED.getCode(), rowOf(service.createBatch(email, batch(changed)).getResult(), "r1").getCode());
        assertEquals(1, schedulesOf(version).size());
    }

    @Test
    void concurrentRequestsWithTheSameKeyCreateOneSchedule() throws Exception {
        ContentVersion version = version(item(ReviewStatus.NONE), Platform.FACEBOOK);
        ScheduleBatchRowRequest row = row("c1", version, page, ScheduleMode.SCHEDULE, in(3));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<ScheduleRowResult> a = CompletableFuture.supplyAsync(() -> rowOf(service.createBatch(email, batch(row)).getResult(), "c1"), pool);
            CompletableFuture<ScheduleRowResult> b = CompletableFuture.supplyAsync(() -> rowOf(service.createBatch(email, batch(row)).getResult(), "c1"), pool);
            ScheduleRowResult ra = a.get();
            ScheduleRowResult rb = b.get();
            assertEquals(200, ra.getCode(), ra.getMessage());
            assertEquals(200, rb.getCode(), rb.getMessage());
            assertEquals(ra.getSchedule().getId(), rb.getSchedule().getId());
        } finally {
            pool.shutdownNow();
        }
        assertEquals(1, schedulesOf(version).size());
    }

    @Test
    void failedRowCanBeRetriedWithTheSameKey() {
        ContentVersion version = version(item(ReviewStatus.NONE), Platform.FACEBOOK);
        tx.executeWithoutResult(s -> accountRepository.findById(page.getId()).orElseThrow().setConnectionStatus(ConnectionStatus.EXPIRED));
        ScheduleBatchRowRequest row = row("f1", version, page, ScheduleMode.SCHEDULE, in(1));
        assertEquals(ErrorCode.CONNECTION_NOT_ACTIVE.getCode(), rowOf(service.createBatch(email, batch(row)).getResult(), "f1").getCode());

        tx.executeWithoutResult(s -> accountRepository.findById(page.getId()).orElseThrow().setConnectionStatus(ConnectionStatus.ACTIVE));
        assertEquals(200, rowOf(service.createBatch(email, batch(row)).getResult(), "f1").getCode());
    }

    @Test
    void publishNowAndSchedulerClaimOnlyOnce() {
        ContentItem item = item(ReviewStatus.NONE);
        UUID id = create(version(item, Platform.FACEBOOK), in(1)).getId();

        PostScheduleResponse now = service.publishNow(email, id, "pn-" + UUID.randomUUID()).getResult();
        assertNotNull(now.getJobId(), "đăng ngay trả job ngay");
        assertEquals(ScheduleStatus.POSTING, now.getStatus());
        assertEquals(ContentItemStatus.POSTING, contentItemRepository.findById(item.getId()).orElseThrow().getStatus());

        PostingDispatchService.Outcome second = tx.execute(s -> dispatchService.dispatch(id));
        assertNull(second.jobId(), "dispatcher không tạo job thứ hai cho lịch đã claim");
        long jobs = tx.execute(s -> (long) scheduleRepository.findById(id).orElseThrow().getPost().getPostingJobs().size());
        assertEquals(1, jobs);
    }

    @Test
    void modeNowRequiresApprovalAndHeldSchedulesCannotBePublishedNow() {
        settingsService.update(email, PublishingSettingsRequest.builder().timezone("Asia/Ho_Chi_Minh").requireApproval(true)
                .conflictWindowMinutes(60).brandVoiceBlockingEnabled(false).build());
        ContentItem item = item(ReviewStatus.NONE);
        ContentVersion version = version(item, Platform.FACEBOOK);
        ScheduleRowResult now = rowOf(service.createBatch(email, batch(row("n1", version, page, ScheduleMode.NOW, null))).getResult(), "n1");
        assertEquals(ErrorCode.REVIEW_REQUIRED_BEFORE_PUBLISH.getCode(), now.getCode());
        assertEquals(0, schedulesOf(version).size(), "không tạo lịch giữ đã quá giờ");

        UUID held = create(version, in(1)).getId();
        assertEquals(List.of(HoldReason.PENDING_REVIEW), service.get(email, held).getResult().getHoldReasons());
        assertEquals(ErrorCode.SCHEDULE_HELD_CANNOT_PUBLISH,
                assertThrows(AppException.class, () -> service.publishNow(email, held, null)).getErrorCode());
        assertEquals(ErrorCode.SCHEDULE_TIME_IN_PAST.getCode(), rowOf(service.createBatch(email, batch(
                row("past", version(item, Platform.FACEBOOK), page, ScheduleMode.SCHEDULE, Instant.now().minusSeconds(60)))).getResult(), "past").getCode());

        contentItemService.updateReview(email, item.getId(), ContentItemReviewRequest.builder().reviewStatus(ReviewStatus.NEED_REVIEW).build());
        contentItemService.updateReview(email, item.getId(), ContentItemReviewRequest.builder().reviewStatus(ReviewStatus.APPROVED).build());
        assertNotNull(service.publishNow(email, held, null).getResult().getJobId());
    }

    @Test
    void conflictWindowWarnsWithoutBlocking() {
        ContentItem item = item(ReviewStatus.NONE);
        Instant base = in(2);
        create(version(item, Platform.FACEBOOK), base);
        PostScheduleResponse close = create(version(item, Platform.FACEBOOK), base.plus(Duration.ofMinutes(30)));
        assertEquals(ScheduleStatus.SCHEDULED, close.getStatus(), "trùng lịch chỉ cảnh báo");
        assertEquals(1, close.getWarnings().size());
        assertEquals("CONFLICT", close.getWarnings().getFirst().getType());
        assertEquals(0, create(version(item, Platform.FACEBOOK), base.plus(Duration.ofMinutes(90))).getWarnings().size(),
                "cách 60 phút trở lên thì không cảnh báo");
    }

    @Test
    void suggestedSlotsSkipOccupiedWindowAtTheBoundary() {
        when(aiServiceClient.goldenHours(any())).thenReturn(GoldenHourResultPayload.builder()
                .platform("facebook").dataDriven(false).suggestedHours(List.of("20:00-21:00")).build());
        LocalDate tomorrow = LocalDate.now(VN).plusDays(1);
        Instant tomorrow20 = tomorrow.atTime(LocalTime.of(20, 0)).atZone(VN).toInstant();
        ContentItem item = item(ReviewStatus.NONE);
        create(version(item, Platform.FACEBOOK), tomorrow20.minus(Duration.ofMinutes(59))); // trong cửa sổ 60' → chiếm 20:00

        List<SuggestedSlotResponse> slots = service.suggestSlots(email, page.getId(), tomorrow.atStartOfDay(VN).toInstant(), 2).getResult();
        assertEquals(2, slots.size());
        assertEquals(tomorrow20.plus(Duration.ofDays(1)), slots.getFirst().getTime(), "20:00 ngày mai bị chiếm → sang ngày kế");

        PlatformAccount other = account(user, Platform.FACEBOOK, PlatformAccountType.PAGE);
        create(version(item(ReviewStatus.NONE), Platform.FACEBOOK), tomorrow20.minus(Duration.ofMinutes(60)), other);
        assertEquals(tomorrow20, service.suggestSlots(email, other.getId(), tomorrow.atStartOfDay(VN).toInstant(), 1)
                .getResult().getFirst().getTime(), "cách đúng 60 phút không coi là trùng");
        assertEquals(ErrorCode.SUGGESTED_SLOT_COUNT_INVALID,
                assertThrows(AppException.class, () -> service.suggestSlots(email, page.getId(), null, 21)).getErrorCode());
    }

    @Test
    void movingToAnotherAccountClearsAccountHolds() {
        ContentItem item = item(ReviewStatus.NONE);
        UUID id = create(version(item, Platform.FACEBOOK), in(1)).getId();
        holdService.holdForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_REMOVED);
        PlatformAccount replacement = account(user, Platform.FACEBOOK, PlatformAccountType.PAGE);

        PostScheduleResponse moved = service.update(email, id, PostScheduleUpdateRequest.builder()
                .scheduledTime(in(2)).platformAccountId(replacement.getId()).build()).getResult();
        assertEquals(replacement.getId(), moved.getPlatformAccountId());
        assertEquals(ScheduleStatus.SCHEDULED, moved.getStatus());
        assertEquals(List.of(), moved.getHoldReasons());
    }

    // ===== helpers

    private PostScheduleResponse create(ContentVersion version, Instant time) {
        return create(version, time, page);
    }

    private PostScheduleResponse create(ContentVersion version, Instant time, PlatformAccount account) {
        return service.create(email, PostScheduleRequest.builder().contentVersionId(version.getId())
                .platformAccountId(account.getId()).scheduledTime(time).build(), null).getResult();
    }

    private static ScheduleBatchRequest batch(ScheduleBatchRowRequest... rows) {
        return ScheduleBatchRequest.builder().rows(List.of(rows)).build();
    }

    private static ScheduleBatchRowRequest row(String id, ContentVersion version, PlatformAccount account, ScheduleMode mode, Instant time) {
        return ScheduleBatchRowRequest.builder().clientRowId(id).idempotencyKey("key-" + UUID.randomUUID())
                .contentVersionId(version.getId()).platformAccountId(account.getId()).mode(mode).scheduledTime(time).build();
    }

    private static ScheduleRowResult rowOf(ScheduleBatchResponse response, String clientRowId) {
        return response.getRows().stream().filter(r -> r.getClientRowId().equals(clientRowId)).findFirst().orElseThrow();
    }

    private List<UUID> schedulesOf(ContentVersion version) {
        return scheduleRepository.findByContentVersion_IdAndDeletedAtIsNull(version.getId()).stream().map(s -> s.getId()).toList();
    }

    // Giờ từ API luôn là ISO tới mili-giây; Instant.now() có phần dưới micro-giây mà cột timestamp(6) cắt bớt —
    // cắt về giây để phép so "đúng 60 phút" không lệch vài trăm nano.
    private static Instant in(int days) {
        return Instant.now().plus(Duration.ofDays(days)).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
    }

    private User saveUser(String mail) {
        return userRepository.save(User.builder()
                .username(mail).email(mail).fullName("API IT").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
    }

    private BrandProfile brand(User owner) {
        BrandProfile b = new BrandProfile();
        b.setUser(owner);
        b.setBrandName("Brand IT");
        b.setIndustry("Beauty");
        b.setTargetAudience("Everyone");
        return brandProfileRepository.save(b);
    }

    private ContentItem item(ReviewStatus review) {
        ContentItem item = itemOf(brand);
        item.setReviewStatus(review);
        return contentItemRepository.save(item);
    }

    private ContentItem itemOf(BrandProfile owner) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(owner);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        return contentItemRepository.save(item);
    }

    private ContentVersion version(ContentItem item, Platform platform) {
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(platform);
        version.setFormattedCaption("Caption " + UUID.randomUUID());
        version.setStatus(ContentVersionStatus.FORMATTED);
        return contentVersionRepository.save(version);
    }

    private PlatformAccount account(User owner, Platform platform, PlatformAccountType type) {
        PlatformAccount a = new PlatformAccount();
        a.setUser(owner);
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
