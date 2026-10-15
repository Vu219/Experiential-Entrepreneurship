package com.aima.posting;

import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.FailedPostStateFilter;
import com.aima.enums.FailureResolution;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorType;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Truy vấn "Bài lỗi" đã chuyển JPQL → native SQL (PostRepository.LAST_FAILED_JOB — bản JPQL làm parser ANTLR cấp phát
 * ~2,3GB/câu lúc khởi động, OOM trên container 512MB). Kiểm trên PostgreSQL THẬT rằng bản native trả ĐÚNG tập bài
 * như JPQL cũ (chạy lại qua EntityManager) với mọi tổ hợp mode × state, gồm các ca biên: nhiều chu kỳ đăng, lỗi cũ
 * đã bỏ qua, job FAILED thiếu end_time, bài của user khác, bài đã xoá mềm.
 * Chạy: {@code -Disolated.postgres=true} (docker compose -f isolated/compose.yml up -d postgres).
 */
@EnabledIfSystemProperty(named = "isolated.postgres", matches = "true")
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
})
class FailedPostQueryPgTest {

    static final String URL = "jdbc:postgresql://127.0.0.1:55432/aima_isolated";
    static final String SCHEMA = "failedquery_" + UUID.randomUUID().toString().replace("-", "");

    /** Bản JPQL trước khi chuyển sang native (commit 04f0e74) — chuẩn để so sánh hành vi. */
    static final String OLD_LAST_FAILED_JOB = "select j from PostingJob j where j.post = p "
            + "and j.status = com.aima.enums.PostingJobStatus.FAILED "
            + "and not exists (select j2 from PostingJob j2 where j2.post = p "
            + "and j2.status = com.aima.enums.PostingJobStatus.FAILED and j2.endTime > j.endTime)";
    static final String OLD_USER_FAILED_WHERE = "from Post p where p.status = com.aima.enums.PostStatus.FAILED and p.deletedAt is null "
            + "and p.schedule.platformAccount.user.id = :userId "
            + "and ((:state in ('AUTO_RETRYING', 'ACTIVE', 'ALL') "
            + "      and p.schedule.status = com.aima.enums.ScheduleStatus.POSTING "
            + "      and exists (select r from PostingJob r where r.post = p "
            + "                  and r.status = com.aima.enums.PostingJobStatus.RETRYING)) "
            + "  or (p.schedule.status = com.aima.enums.ScheduleStatus.FAILED "
            + "      and ((:state in ('NEEDS_ACTION', 'ACTIVE', 'ALL') and not exists (" + OLD_LAST_FAILED_JOB
            + "            and j.resolution = com.aima.enums.FailureResolution.DISMISSED)) "
            + "        or (:state in ('DISMISSED', 'ALL') and exists (" + OLD_LAST_FAILED_JOB
            + "            and j.resolution = com.aima.enums.FailureResolution.DISMISSED))))) "
            + "and (:mode = 'ALL' "
            + "  or (:mode = 'POLICY' and exists (" + OLD_LAST_FAILED_JOB
            + "      and j.errorType = com.aima.enums.PublishErrorType.POLICY_VIOLATION)) "
            + "  or (:mode = 'TECHNICAL' and not exists (" + OLD_LAST_FAILED_JOB
            + "      and j.errorType = com.aima.enums.PublishErrorType.POLICY_VIOLATION))) ";
    static final String OLD_ADMIN = "select p.id from Post p where p.status = com.aima.enums.PostStatus.FAILED "
            + "and p.deletedAt is null and p.schedule.status = com.aima.enums.ScheduleStatus.FAILED "
            + "and (:violationOnly = false or exists (select j from PostingJob j where j.post = p "
            + "and j.status = com.aima.enums.PostingJobStatus.FAILED "
            + "and j.errorType = com.aima.enums.PublishErrorType.POLICY_VIOLATION "
            + "and not exists (select j2 from PostingJob j2 where j2.post = p "
            + "and j2.status = com.aima.enums.PostingJobStatus.FAILED and j2.endTime > j.endTime)))";

    @AfterAll
    static void cleanup() throws Exception {
        try (var db = DriverManager.getConnection(URL, "aima_isolated", "isolated-only")) {
            db.createStatement().execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        registry.add("spring.datasource.username", () -> "aima_isolated");
        registry.add("spring.datasource.password", () -> "isolated-only");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
    }

    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private PostingJobRepository jobRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private TransactionTemplate transactionTemplate;

    private record Job(PostingJobStatus status, PublishErrorType type, FailureResolution resolution, Instant end) {
    }

    @Test
    void nativeFailedPostQueries_matchPreviousJpql_forEveryModeAndState() {
        Instant t0 = Instant.now().minus(Duration.ofHours(5));
        Instant t1 = t0.plus(Duration.ofHours(1));
        PlatformAccount me = account();
        PlatformAccount other = account();

        UUID policyNow = post(me, ScheduleStatus.FAILED, false,
                new Job(PostingJobStatus.FAILED, PublishErrorType.POLICY_VIOLATION, null, t1));
        // Chu kỳ cũ vi phạm chính sách, chu kỳ hiện tại lỗi kỹ thuật → TECHNICAL.
        UUID policyOldTechnicalNow = post(me, ScheduleStatus.FAILED, false,
                new Job(PostingJobStatus.FAILED, PublishErrorType.POLICY_VIOLATION, FailureResolution.RETRIED, t0),
                new Job(PostingJobStatus.FAILED, PublishErrorType.PERMANENT, null, t1));
        UUID dismissedNow = post(me, ScheduleStatus.FAILED, false,
                new Job(PostingJobStatus.FAILED, PublishErrorType.PERMANENT, FailureResolution.DISMISSED, t1));
        // Lỗi cũ đã bỏ qua nhưng lỗi mới nhất chưa xử lý → NEEDS_ACTION.
        UUID dismissedOldOpenNow = post(me, ScheduleStatus.FAILED, false,
                new Job(PostingJobStatus.FAILED, PublishErrorType.POLICY_VIOLATION, FailureResolution.DISMISSED, t0),
                new Job(PostingJobStatus.FAILED, PublishErrorType.POLICY_VIOLATION, null, t1));
        UUID autoRetrying = post(me, ScheduleStatus.POSTING, false,
                new Job(PostingJobStatus.FAILED, PublishErrorType.TEMPORARY, null, t0),
                new Job(PostingJobStatus.RETRYING, null, null, null));
        // job FAILED thiếu end_time: JPQL cũ coi nó cũng là "mới nhất" (so sánh với NULL) — bản native phải giữ y vậy.
        UUID nullEndTime = post(me, ScheduleStatus.FAILED, false,
                new Job(PostingJobStatus.FAILED, PublishErrorType.TEMPORARY, null, t1),
                new Job(PostingJobStatus.FAILED, PublishErrorType.POLICY_VIOLATION, FailureResolution.DISMISSED, null));
        UUID noJobs = post(me, ScheduleStatus.FAILED, false);
        UUID deleted = post(me, ScheduleStatus.FAILED, true,
                new Job(PostingJobStatus.FAILED, PublishErrorType.POLICY_VIOLATION, null, t1));
        UUID otherUsers = post(other, ScheduleStatus.FAILED, false,
                new Job(PostingJobStatus.FAILED, PublishErrorType.POLICY_VIOLATION, null, t1));
        UUID userId = transactionTemplate.execute(tx ->
                accountRepository.findById(me.getId()).orElseThrow().getUser().getId());

        for (FailedPostFilter mode : FailedPostFilter.values()) {
            for (FailedPostStateFilter state : FailedPostStateFilter.values()) {
                Set<UUID> expected = oldUserIds(userId, mode.name(), state.name());
                Set<UUID> actual = ids(postRepository.findFailedForUser(userId, mode.name(), state.name(),
                        PageRequest.of(0, 50)).getContent());
                assertEquals(expected, actual, mode + "/" + state);
                assertEquals(expected.size(), postRepository.countFailedForUserByState(userId, mode.name(), state.name()),
                        mode + "/" + state);
                assertEquals(expected.size(), postRepository.findFailedForUser(userId, mode.name(), state.name(),
                        PageRequest.of(0, 2)).getTotalElements(), "count query " + mode + "/" + state);
            }
        }
        // Chốt cả giá trị tuyệt đối (không chỉ "bằng JPQL cũ") cho các ca biên chính.
        assertEquals(Set.of(policyNow, dismissedOldOpenNow, nullEndTime),
                ids(postRepository.findFailedForUser(userId, "POLICY", "ALL", PageRequest.of(0, 50)).getContent()));
        assertEquals(Set.of(policyOldTechnicalNow, noJobs, autoRetrying),
                ids(postRepository.findFailedForUser(userId, "TECHNICAL", "ACTIVE", PageRequest.of(0, 50)).getContent()));
        assertEquals(Set.of(dismissedNow, nullEndTime),
                ids(postRepository.findFailedForUser(userId, "ALL", "DISMISSED", PageRequest.of(0, 50)).getContent()));
        assertFalse(ids(postRepository.findFailedForUser(userId, "ALL", "ALL", PageRequest.of(0, 50)).getContent())
                .contains(deleted));

        for (boolean violationOnly : new boolean[]{false, true}) {
            Set<UUID> expected = new HashSet<>(transactionTemplate.execute(tx -> entityManager
                    .createQuery(OLD_ADMIN, UUID.class).setParameter("violationOnly", violationOnly).getResultList()));
            assertEquals(expected, ids(postRepository.findFailedForAdmin(violationOnly, PageRequest.of(0, 50)).getContent()),
                    "admin violationOnly=" + violationOnly);
        }
        assertEquals(Set.of(policyNow, dismissedOldOpenNow, nullEndTime, otherUsers),
                ids(postRepository.findFailedForAdmin(true, PageRequest.of(0, 50)).getContent()));
    }

    private Set<UUID> oldUserIds(UUID userId, String mode, String state) {
        return new HashSet<>(transactionTemplate.execute(tx -> entityManager
                .createQuery("select p.id " + OLD_USER_FAILED_WHERE, UUID.class)
                .setParameter("userId", userId).setParameter("mode", mode).setParameter("state", state)
                .getResultList()));
    }

    private static Set<UUID> ids(List<Post> posts) {
        Set<UUID> ids = new HashSet<>();
        posts.forEach(p -> ids.add(p.getId()));
        return ids;
    }

    // ================================================================== dựng dữ liệu

    private PlatformAccount account() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "pgq-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("PG Query").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        String pageId = "page" + Math.abs(UUID.randomUUID().getMostSignificantBits());
        PlatformAccount page = new PlatformAccount();
        page.setUser(user);
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId(pageId);
        page.setAccountName("Page PGQ");
        page.setAccountType(PlatformAccountType.PAGE);
        page.setTokenType(TokenType.PAGE_TOKEN);
        page.setAccessToken("page-token-" + pageId);
        page.setConnectionStatus(ConnectionStatus.ACTIVE);
        return accountRepository.save(page);
    }

    private UUID post(PlatformAccount account, ScheduleStatus scheduleStatus, boolean deleted, Job... jobs) {
        return transactionTemplate.execute(tx -> {
            PlatformAccount page = accountRepository.findById(account.getId()).orElseThrow();
            BrandProfile brand = new BrandProfile();
            brand.setUser(page.getUser());
            brand.setBrandName("Brand PGQ");
            brand.setIndustry("Beauty");
            brand.setTargetAudience("Everyone");
            brand = brandProfileRepository.save(brand);
            ContentItem item = new ContentItem();
            item.setBrandProfile(brand);
            item.applyResolvedStatus(ContentItemStatus.FAILED);
            item = contentItemRepository.save(item);
            ContentVersion version = new ContentVersion();
            version.setContentItem(item);
            version.setPlatformName(Platform.FACEBOOK);
            version.setFormattedCaption("caption");
            version.setStatus(ContentVersionStatus.FORMATTED);
            version = contentVersionRepository.save(version);
            PostSchedule schedule = new PostSchedule();
            schedule.setContentVersion(version);
            schedule.setPlatformAccount(page);
            schedule.setScheduledTime(Instant.now().plus(Duration.ofDays(3)));
            schedule.setStatus(scheduleStatus);
            schedule = scheduleRepository.save(schedule);
            Post post = new Post();
            post.setSchedule(schedule);
            post.setPlatformName(Platform.FACEBOOK);
            post.setStatus(PostStatus.FAILED);
            if (deleted) {
                post.setDeletedAt(LocalDateTime.now());
            }
            post = postRepository.save(post);
            for (Job spec : jobs) {
                PostingJob job = new PostingJob();
                job.setPost(post);
                job.setRetryCount(0);
                job.setStatus(spec.status());
                job.setErrorType(spec.type());
                job.setResolution(spec.resolution());
                job.setEndTime(spec.end());
                jobRepository.save(job);
            }
            return post.getId();
        });
    }
}
