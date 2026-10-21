package com.aima.config.init;

import com.aima.config.IsolatedStackConfig;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.PlanSource;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.PlatformAvailabilityService;
import com.aima.service.ScheduleHeldNotifier;
import com.aima.service.ScheduleHoldService;
import com.aima.service.SubscriptionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * DEV-ONLY — dữ liệu xem giao diện giới hạn gói / khoá nền tảng mà KHÔNG cần key Instagram/Threads
 * (docs/PLAN_LIMITS_MANUAL_TEST.md). Chỉ chạy khi:
 * <ol>
 *   <li>profile {@code isolated} (stack cô lập: PG 127.0.0.1:55432/aima_isolated, Redis 56379, stub Meta 58080);</li>
 *   <li>bật tường minh {@code --aima.dev-seed.plan-limits=true};</li>
 *   <li>{@link IsolatedStackConfig#validate} qua VÀ kết nối thật của DataSource trỏ 127.0.0.1/localhost, DB
 *       {@code aima_isolated} — sai bất kỳ điều kiện nào thì TỪ CHỐI, không ghi gì.</li>
 * </ol>
 * Tạo một user mỗi gói FREE/PLUS/PRO + một user gói tự tạo DEV_ALL (cho phép cả 3 nền tảng), mỗi user có Trang
 * Facebook / tài khoản Threads / Instagram GIẢ (token giả, không gọi Meta) và vài lịch; lịch Threads/Instagram chuyển
 * Tạm giữ (PLATFORM_DISABLED) + thông báo SCHEDULE_HELD như luồng admin khoá. Idempotent: đã có user mẫu thì bỏ qua.
 */
@Component
@Profile("isolated")
@Order(20)
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DevPlanLimitsSeeder implements CommandLineRunner {

    static final String PASSWORD = "Dev12345!";
    static final String MARKER_EMAIL = "free.dev@aima.local";

    Environment environment;
    DataSource dataSource;
    TransactionTemplate transactionTemplate;
    PasswordEncoder passwordEncoder;
    UserRepository userRepository;
    RoleRepository roleRepository;
    PlanRepository planRepository;
    SubscriptionRepository subscriptionRepository;
    SubscriptionService subscriptionService;
    BrandProfileRepository brandProfileRepository;
    ContentItemRepository contentItemRepository;
    ContentVersionRepository contentVersionRepository;
    PlatformAccountRepository accountRepository;
    PostScheduleRepository scheduleRepository;
    ScheduleHoldService holdService;
    ScheduleHeldNotifier heldNotifier;
    PlatformAvailabilityService availabilityService;
    ContentItemStatusResolver statusResolver;

    @Override
    public void run(String... args) {
        if (!environment.getProperty("aima.dev-seed.plan-limits", Boolean.class, false)) {
            return;
        }
        if (!safeTarget()) {
            log.error("[DevSeed] TỪ CHỐI seed: DB không phải stack cô lập 127.0.0.1:55432/aima_isolated");
            return;
        }
        if (userRepository.existsByEmail(MARKER_EMAIL)) {
            log.info("[DevSeed] Dữ liệu mẫu giới hạn gói đã có — bỏ qua");
            return;
        }
        // User commit TRƯỚC: getOrCreate ghi subscription trong transaction riêng (REQUIRES_NEW) — cần user đã có trong DB.
        List<User> users = transactionTemplate.execute(status -> List.of(
                newUser("free.dev@aima.local", "Free Dev", UserPlan.FREE),
                newUser("plus.dev@aima.local", "Plus Dev", UserPlan.PLUS),
                newUser("pro.dev@aima.local", "Pro Dev", UserPlan.PRO),
                newUser("allplatforms.dev@aima.local", "All Platforms Dev", UserPlan.PRO)));
        transactionTemplate.executeWithoutResult(status -> seed(users));
        log.info("[DevSeed] Đã tạo dữ liệu mẫu giới hạn gói — đăng nhập {}/{} (xem docs/PLAN_LIMITS_MANUAL_TEST.md)",
                MARKER_EMAIL, PASSWORD);
    }

    /** Hai lớp: cấu hình cô lập hợp lệ + kết nối THẬT của DataSource trỏ máy local, đúng DB cô lập. */
    private boolean safeTarget() {
        try {
            IsolatedStackConfig.validate(environment);
            try (Connection connection = dataSource.getConnection()) {
                String url = connection.getMetaData().getURL();
                return url != null && (url.startsWith("jdbc:postgresql://127.0.0.1:55432/aima_isolated")
                        || url.startsWith("jdbc:postgresql://localhost:55432/aima_isolated"));
            }
        } catch (Exception e) {
            log.error("[DevSeed] Không xác minh được DB đích: {}", e.getMessage());
            return false;
        }
    }

    private void seed(List<User> users) {
        Plan devAll = planRepository.findByCodeAndDeletedAtIsNull("DEV_ALL").orElseGet(() -> planRepository.save(Plan.builder()
                .code("DEV_ALL").nameVi("Dev — đủ nền tảng").nameEn("Dev — all platforms").price(0L).isActive(false)
                .featureLimits(PlanDataInitializer.coreFeatureLimits("PRO"))
                .build()));
        PlanFeatureLimits all = devAll.getFeatureLimits();
        all.setAllowedPlatforms("FACEBOOK,INSTAGRAM,THREADS");
        planRepository.save(devAll);

        List<PlatformAccount> lockedAccounts = new ArrayList<>();
        List<UUID> itemIds = new ArrayList<>();
        lockedAccounts.addAll(seedUser(users.get(0), null, itemIds));
        lockedAccounts.addAll(seedUser(users.get(1), "PLUS", itemIds));
        lockedAccounts.addAll(seedUser(users.get(2), "PRO", itemIds));
        lockedAccounts.addAll(seedUser(users.get(3), "DEV_ALL", itemIds));

        // Trạng thái tổng chỉ do resolver ghi (bài → SCHEDULED; bài có lịch bị giữ → ON_HOLD sau holdForAccounts).
        statusResolver.lockAll(itemIds);
        statusResolver.refreshAll(itemIds);
        // Như luồng admin khoá: lịch Threads/Instagram (nền tảng đang khoá) → Tạm giữ + một thông báo / user.
        List<PlatformAccount> locked = lockedAccounts.stream()
                .filter(a -> !availabilityService.isEnabled(a.getPlatformName())).toList();
        holdService.holdForAccounts(locked.stream().map(PlatformAccount::getId).toList(), HoldReason.PLATFORM_DISABLED);
        for (PlatformAccount account : locked) {
            heldNotifier.notifyBatch(account.getUser(), HoldReason.PLATFORM_DISABLED, account.getPlatformName(), 1,
                    "schedule-held:dev-seed:" + account.getId());
        }
    }

    private User newUser(String email, String name, UserPlan label) {
        return userRepository.save(User.builder()
                .username(email).email(email).fullName(name).password(passwordEncoder.encode(PASSWORD))
                .phone("0900000000").dateOfBirth(LocalDate.of(1995, 1, 1)).profileCompleted(true)
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(label).build());
    }

    /** Subscription gói + thương hiệu + Trang FB / Threads / Instagram giả + mỗi nền tảng một lịch. */
    private List<PlatformAccount> seedUser(User user, String planCode, List<UUID> itemIds) {
        String name = user.getFullName();
        UserPlan label = user.getPlan();
        Subscription subscription = subscriptionService.getOrCreate(user);
        if (planCode != null && subscription != null) {
            subscription.setPlan(planRepository.findByCodeAndDeletedAtIsNull(planCode).orElseThrow());
            subscription.setPlanSource(PlanSource.ADMIN);
            subscription.setPlanStartedAt(LocalDateTime.now());
            subscription.setPlanExpiresAt(LocalDateTime.now().plusDays(30));
            subscriptionRepository.save(subscription);
        }

        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Thương hiệu mẫu " + name);
        brand.setIndustry("Food & Beverage");
        brand.setTargetAudience("Khách hàng 20–35 tuổi");
        brand.setPlatforms(Set.of(Platform.FACEBOOK, Platform.INSTAGRAM, Platform.THREADS));
        brand.setIsActive(true);
        brandProfileRepository.save(brand);

        PlatformAccount page = account(user, Platform.FACEBOOK, PlatformAccountType.PAGE, "Trang mẫu " + name);
        PlatformAccount threads = account(user, Platform.THREADS, PlatformAccountType.PERSONAL, "threads.dev." + label.name().toLowerCase());
        PlatformAccount instagram = account(user, Platform.INSTAGRAM, PlatformAccountType.BUSINESS_ACCOUNT, "ig.dev." + label.name().toLowerCase());

        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.setReviewStatus(ReviewStatus.NONE);
        item.setCaption("Bài mẫu để xem giao diện khoá nền tảng / Tạm giữ");
        contentItemRepository.save(item);
        itemIds.add(item.getId());
        schedule(version(item, Platform.FACEBOOK), page, 1);
        schedule(version(item, Platform.THREADS), threads, 2);
        schedule(version(item, Platform.INSTAGRAM), instagram, 3);
        return List.of(threads, instagram);
    }

    private PlatformAccount account(User user, Platform platform, PlatformAccountType type, String name) {
        PlatformAccount account = new PlatformAccount();
        account.setUser(user);
        account.setPlatformName(platform);
        account.setPlatformAccountId("dev-" + platform.name().toLowerCase() + "-" + user.getId());
        account.setAccountName(name);
        account.setAccountType(type);
        account.setTokenType(type == PlatformAccountType.PAGE || type == PlatformAccountType.BUSINESS_ACCOUNT
                ? TokenType.PAGE_TOKEN : TokenType.LONG_LIVED_USER_TOKEN);
        account.setAccessToken("dev-fake-token");
        account.setConnectionStatus(ConnectionStatus.ACTIVE);
        return accountRepository.save(account);
    }

    private ContentVersion version(ContentItem item, Platform platform) {
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(platform);
        version.setFormattedCaption("Nội dung mẫu cho " + platform.name());
        version.setStatus(ContentVersionStatus.FORMATTED);
        return contentVersionRepository.save(version);
    }

    private void schedule(ContentVersion version, PlatformAccount account, int daysAhead) {
        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(account);
        schedule.setScheduledTime(Instant.now().plus(Duration.ofDays(daysAhead)));
        schedule.setStatus(ScheduleStatus.SCHEDULED);
        scheduleRepository.save(schedule);
    }
}
