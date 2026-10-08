package com.aima.brand;

import com.aima.dto.request.PostScheduleRequest;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.BrandProfileService;
import com.aima.service.PostScheduleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Xóa hồ sơ thương hiệu cascade theo DATA_MODEL.md: xóa mềm chiến lược + bài + bản, hủy lịch CHƯA đăng (không
 * bao giờ được dispatch), giữ bài đã đăng (lịch sử). Repository + resolver + dịch vụ thật trên H2.
 */
@SpringBootTest
class BrandProfileDeleteCascadeTest {

    @Autowired BrandProfileService brandProfileService;
    @Autowired PostScheduleService scheduleService;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentStrategyRepository strategyRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired PlatformAccountRepository accountRepository;
    @Autowired PostScheduleRepository scheduleRepository;
    @Autowired TransactionTemplate tx;

    String email;
    User user;
    BrandProfile brand;
    PlatformAccount page;
    PlatformAccount threads;

    @BeforeEach
    void fixture() {
        email = "cascade-" + UUID.randomUUID() + "@it.local";
        user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Cascade IT").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);
        page = account(Platform.FACEBOOK, PlatformAccountType.PAGE);
        threads = account(Platform.THREADS, PlatformAccountType.PERSONAL);
    }

    @Test
    void deleteCascadesToUnpublishedContentAndKeepsPostedHistory() {
        ContentStrategy strategy = new ContentStrategy();
        strategy.setBrandProfile(brand);
        strategy.setName("Strategy IT");
        strategy.setFrequencyCount(3);
        strategy = strategyRepository.save(strategy);

        // Bài chưa đăng: có lịch SCHEDULED → bài + bản xóa mềm, lịch CANCELLED.
        ContentItem draft = item();
        ContentVersion draftVersion = version(draft, Platform.FACEBOOK);
        UUID draftSchedule = schedule(draftVersion, page);

        // Bài đã đăng một nền tảng: giữ bài + lịch POSTED, lịch chưa đăng còn lại bị hủy.
        ContentItem posted = item();
        UUID postedSchedule = schedule(version(posted, Platform.FACEBOOK), page);
        UUID pendingSchedule = schedule(version(posted, Platform.THREADS), threads);
        tx.executeWithoutResult(s -> scheduleRepository.findById(postedSchedule).orElseThrow()
                .setStatus(ScheduleStatus.POSTED));

        brandProfileService.delete(email, brand.getId());

        assertNotNull(brandProfileRepository.findById(brand.getId()).orElseThrow().getDeletedAt());
        assertNotNull(strategyRepository.findById(strategy.getId()).orElseThrow().getDeletedAt());

        assertNotNull(contentItemRepository.findById(draft.getId()).orElseThrow().getDeletedAt());
        assertNotNull(contentVersionRepository.findById(draftVersion.getId()).orElseThrow().getDeletedAt());
        assertEquals(ScheduleStatus.CANCELLED, scheduleRepository.findById(draftSchedule).orElseThrow().getStatus());

        ContentItem kept = contentItemRepository.findById(posted.getId()).orElseThrow();
        assertNull(kept.getDeletedAt(), "bài đã đăng giữ lại để còn lịch sử");
        assertEquals(ScheduleStatus.POSTED, scheduleRepository.findById(postedSchedule).orElseThrow().getStatus());
        assertEquals(ScheduleStatus.CANCELLED, scheduleRepository.findById(pendingSchedule).orElseThrow().getStatus());
        assertEquals(ContentItemStatus.PARTIALLY_POSTED, kept.getStatus());

        // Tra cứu dùng cho tạo/định dạng nội dung bỏ qua bài của hồ sơ đã xóa.
        assertTrue(tx.execute(s -> contentItemRepository.findOwnedForUpdate(posted.getId(), user.getId())).isEmpty());
    }

    private ContentItem item() {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        item.setReviewStatus(ReviewStatus.NONE);
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

    private UUID schedule(ContentVersion version, PlatformAccount target) {
        return scheduleService.create(email, PostScheduleRequest.builder().contentVersionId(version.getId())
                .platformAccountId(target.getId()).scheduledTime(Instant.now().plus(Duration.ofDays(1))).build(), null)
                .getResult().getId();
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
