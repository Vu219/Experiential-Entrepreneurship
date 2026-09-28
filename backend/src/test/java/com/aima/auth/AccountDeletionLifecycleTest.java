package com.aima.auth;

import com.aima.config.AccountDeletionScheduler;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.dto.response.DeleteAccountResponse;
import com.aima.entity.AiUsage;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.Role;
import com.aima.entity.TokenCredit;
import com.aima.entity.User;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentLifecycle;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.TokenCreditRepository;
import com.aima.repository.UserRepository;
import com.aima.service.PostScheduleService;
import com.aima.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.AopTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Vòng đời xoá tài khoản (H2 + service thật):
 * <ol>
 *   <li>Yêu cầu xoá → lịch SCHEDULED + bài đang chờ retry chuyển ON_HOLD, dispatcher bỏ qua user, không lên lịch được nữa.</li>
 *   <li>Khôi phục → lịch vẫn ON_HOLD, user tự "Kích hoạt lại".</li>
 *   <li>Xoá cứng → không vỡ khoá ngoại: payments ẨN DANH HOÁ, token_credits xoá, ai_usage tách user.</li>
 * </ol>
 * Mọi lịch đặt giờ ở TƯƠNG LAI để PostingDispatchJob thật trong context không đăng bài.
 */
@SpringBootTest
class AccountDeletionLifecycleTest {

    @Autowired private UserService userService;
    @Autowired private PostScheduleService postScheduleService;
    @Autowired private AccountDeletionScheduler accountDeletionScheduler;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PlanRepository planRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private PostingJobRepository jobRepository;
    @Autowired private PaymentRepository paymentRepository;
    @Autowired private TokenCreditRepository tokenCreditRepository;
    @Autowired private AiUsageRepository aiUsageRepository;
    @Autowired private TransactionTemplate transactionTemplate;

    // ================================================================== dựng dữ liệu

    private User newUser() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "del-" + UUID.randomUUID() + "@it.local";
        return userRepository.save(User.builder()
                .username(email).email(email).fullName("Delete IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
    }

    private PlatformAccount newPage(User user) {
        PlatformAccount a = new PlatformAccount();
        a.setUser(user);
        a.setPlatformName(Platform.FACEBOOK);
        a.setPlatformAccountId("page-" + UUID.randomUUID());
        a.setAccountName("Page IT");
        a.setAccountType(PlatformAccountType.PAGE);
        a.setTokenType(TokenType.PAGE_TOKEN);
        a.setAccessToken("page-token");
        a.setConnectionStatus(ConnectionStatus.ACTIVE);
        return accountRepository.save(a);
    }

    /** Một lịch cho một version mới (content_version_id là unique). */
    private PostSchedule newSchedule(User user, PlatformAccount page, ScheduleStatus status) {
        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.setStatus(status == ScheduleStatus.POSTING ? ContentLifecycle.POSTING : ContentLifecycle.SCHEDULED);
        item = contentItemRepository.save(item);
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setStatus(item.getStatus());
        version = contentVersionRepository.save(version);
        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(page);
        schedule.setScheduledTime(LocalDateTime.now().plusDays(2));
        schedule.setStatus(status);
        return scheduleRepository.save(schedule);
    }

    /** Lịch đang giữa chu kỳ retry: schedule POSTING, post FAILED, job RETRYING chờ tới lượt. */
    private PostingJob newRetryingJob(User user, PlatformAccount page) {
        PostSchedule schedule = newSchedule(user, page, ScheduleStatus.POSTING);
        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.FAILED);
        post = postRepository.save(post);
        PostingJob job = new PostingJob();
        job.setPost(post);
        job.setRetryCount(1);
        job.setStatus(PostingJobStatus.RETRYING);
        job.setNextRetryAt(LocalDateTime.now().plusMinutes(15));
        return jobRepository.save(job);
    }

    private Payment newPayment(User user, PaymentStatus status) {
        Plan plan = planRepository.findByCodeAndDeletedAtIsNull("PRO").orElseThrow();
        return paymentRepository.saveAndFlush(Payment.builder()
                .user(user).plan(plan).amount(plan.getPrice()).currency("VND")
                .status(status).gateway(PaymentGateway.MANUAL)
                .orderedAt(LocalDateTime.now().minusDays(40))
                .paidAt(status == PaymentStatus.PAID ? LocalDateTime.now().minusDays(40) : null)
                .checkoutUrl("https://pay.local/x").expiresAt(LocalDateTime.now().plusDays(1))
                .invoiceNo("INV-" + UUID.randomUUID().toString().substring(0, 8))
                .rawPayload("{\"counterAccountName\":\"NGUYEN VAN A\"}")
                .build());
    }

    private void seedFkData(User user) {
        newPayment(user, PaymentStatus.PAID);
        tokenCreditRepository.save(TokenCredit.builder().user(user).tokensGranted(1000L).build());
        aiUsageRepository.save(AiUsage.builder().user(user).taskCode(AiTaskCode.CONTENT_GENERATION)
                .providerCode(AiProviderCode.GOOGLE).modelCode("gemini-it").totalTokens(42L)
                .clientIp("203.0.113.9").userAgent("JUnit").build());
    }

    /**
     * Gọi thẳng object gốc, BỎ QUA proxy ShedLock: {@code lockAtLeastFor = PT1M} khiến lần gọi
     * thứ hai trong vòng 1 phút (test khác) bị bỏ qua im lặng — đúng thiết kế ở production.
     */
    private void purgeNow() {
        AccountDeletionScheduler target = AopTestUtils.getTargetObject(accountDeletionScheduler);
        target.purgeExpiredAccounts();
    }

    private void markExpiredPendingDelete(User user) {
        User fresh = userRepository.findById(user.getId()).orElseThrow();
        fresh.setStatus(UserStatus.PENDING_DELETE);
        fresh.setDeletionDate(LocalDateTime.now().minusMinutes(1));
        userRepository.save(fresh);
    }

    // ================================================================== yêu cầu xoá / khôi phục

    @Test
    void requestDelete_holdsSchedulesStopsRetriesAndBlocksScheduling() {
        User user = newUser();
        PlatformAccount page = newPage(user);
        PostSchedule waiting = newSchedule(user, page, ScheduleStatus.SCHEDULED);
        PostingJob retrying = newRetryingJob(user, page);

        DeleteAccountResponse response = userService.requestDeleteAccount(user.getEmail()).getResult();

        assertTrue(response.getMessage().contains("2 bài"), response.getMessage());
        assertEquals(ScheduleStatus.ON_HOLD, scheduleRepository.findById(waiting.getId()).orElseThrow().getStatus());
        assertEquals(PostingJobStatus.FAILED, jobRepository.findById(retrying.getId()).orElseThrow().getStatus());
        UUID retryScheduleId = transactionTemplate.execute(tx ->
                jobRepository.findById(retrying.getId()).orElseThrow().getPost().getSchedule().getId());
        assertEquals(ScheduleStatus.ON_HOLD, scheduleRepository.findById(retryScheduleId).orElseThrow().getStatus());

        // Không kích hoạt lại / dời lịch được khi đang chờ xoá.
        AppException ex = assertThrows(AppException.class, () -> postScheduleService.update(user.getEmail(), waiting.getId(),
                PostScheduleUpdateRequest.builder().scheduledTime(LocalDateTime.now().plusDays(3)).build()));
        assertEquals(ErrorCode.SCHEDULING_BLOCKED_PENDING_DELETE, ex.getErrorCode());
    }

    @Test
    void dispatcherQueries_skipPendingDeleteUsers() {
        User user = newUser();
        PlatformAccount page = newPage(user);
        markExpiredPendingDelete(user);
        // Lịch "đến hạn" (giờ đã qua) của user chờ xoá — lọt qua hold thì dispatcher vẫn phải bỏ qua.
        PostSchedule due = newSchedule(user, page, ScheduleStatus.SCHEDULED);
        due.setScheduledTime(LocalDateTime.now().minusMinutes(5));
        scheduleRepository.save(due);

        boolean picked = scheduleRepository
                .findByStatusAndScheduledTimeLessThanEqualAndDeletedAtIsNullAndPlatformAccount_User_StatusNot(
                        ScheduleStatus.SCHEDULED, LocalDateTime.now(), UserStatus.PENDING_DELETE)
                .stream().anyMatch(s -> s.getId().equals(due.getId()));
        assertFalse(picked);

        // Dọn: không để lịch đến hạn tồn tại cho các test khác / dispatcher thật.
        due.setStatus(ScheduleStatus.CANCELLED);
        scheduleRepository.save(due);
    }

    @Test
    void restore_keepsSchedulesOnHold_userCanReactivate() {
        User user = newUser();
        PlatformAccount page = newPage(user);
        PostSchedule waiting = newSchedule(user, page, ScheduleStatus.SCHEDULED);
        userService.requestDeleteAccount(user.getEmail());

        DeleteAccountResponse restored = userService.restoreAccount(user.getEmail()).getResult();

        assertTrue(restored.getMessage().contains("Kích hoạt lại"), restored.getMessage());
        assertEquals(ScheduleStatus.ON_HOLD, scheduleRepository.findById(waiting.getId()).orElseThrow().getStatus(),
                "khôi phục KHÔNG tự bật lại lịch");

        postScheduleService.update(user.getEmail(), waiting.getId(),
                PostScheduleUpdateRequest.builder().scheduledTime(LocalDateTime.now().plusDays(5)).build());
        assertEquals(ScheduleStatus.SCHEDULED, scheduleRepository.findById(waiting.getId()).orElseThrow().getStatus());
    }

    // ================================================================== xoá cứng

    @Test
    void hardDeleteWithoutPreparation_violatesForeignKey() {
        // Bằng chứng cho rủi ro: cascade JPA của User KHÔNG phủ payments/token_credits/ai_usage.
        User user = newUser();
        seedFkData(user);

        assertThrows(DataIntegrityViolationException.class, () -> transactionTemplate.executeWithoutResult(tx -> {
            userRepository.delete(userRepository.findById(user.getId()).orElseThrow());
            userRepository.flush();
        }));
    }

    @Test
    void purge_anonymizesPaymentsDropsCreditsDetachesUsage() {
        User user = newUser();
        newPage(user);
        seedFkData(user);
        Payment payment = paymentRepository.findAll().stream()
                .filter(p -> p.getRawPayload() != null && p.getRawPayload().contains("NGUYEN VAN A")
                        && transactionTemplate.execute(tx -> paymentRepository.findById(p.getId()).orElseThrow().getUser().getId())
                        .equals(user.getId()))
                .findFirst().orElseThrow();
        markExpiredPendingDelete(user);

        purgeNow();

        assertTrue(userRepository.findById(user.getId()).isEmpty(), "tài khoản phải bị xoá cứng");
        Payment kept = paymentRepository.findById(payment.getId()).orElseThrow();
        assertNull(kept.getUser(), "đơn được giữ nhưng không còn liên kết người mua");
        assertNull(kept.getRawPayload(), "payload cổng (tên/số tài khoản người chuyển) phải bị bỏ");
        assertEquals(payment.getAmount(), kept.getAmount());
        assertEquals(PaymentStatus.PAID, kept.getStatus());
        // Bảng giao dịch admin (LEFT JOIN) vẫn thấy đơn ẩn danh.
        assertTrue(paymentRepository.search(null, null, null, null, PageRequest.of(0, 500)).getContent()
                .stream().anyMatch(r -> r.getId().equals(payment.getId()) && r.getUserEmail() == null));
        assertTrue(tokenCreditRepository.findAll().stream().noneMatch(c ->
                transactionTemplate.execute(tx -> tokenCreditRepository.findById(c.getId())
                        .map(x -> x.getUser().getId().equals(user.getId())).orElse(false))));
        assertTrue(aiUsageRepository.findAll().stream()
                .filter(a -> "gemini-it".equals(a.getModelCode()) && a.getUser() == null)
                .anyMatch(a -> a.getClientIp() == null && a.getUserAgent() == null));
    }

    @Test
    void purge_userWithPendingPayment_isSkippedUntilOrderCloses() {
        User user = newUser();
        newPayment(user, PaymentStatus.PENDING);
        markExpiredPendingDelete(user);

        purgeNow();

        assertTrue(userRepository.findById(user.getId()).isPresent(), "còn đơn PENDING → chưa được xoá");
    }

    @Test
    void adminDelete_userWithPaymentsCreditsAndUsage_succeeds() {
        User user = newUser();
        seedFkData(user);

        userService.deleteUser("admin@it.local", user.getId());

        assertTrue(userRepository.findById(user.getId()).isEmpty());
    }

    @Test
    void adminDelete_userWithPendingPayment_rejected() {
        User user = newUser();
        newPayment(user, PaymentStatus.PENDING);

        AppException ex = assertThrows(AppException.class, () -> userService.deleteUser("admin@it.local", user.getId()));

        assertEquals(ErrorCode.USER_HAS_PENDING_PAYMENT, ex.getErrorCode());
        assertTrue(userRepository.findById(user.getId()).isPresent());
    }
}
