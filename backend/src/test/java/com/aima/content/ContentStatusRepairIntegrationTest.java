package com.aima.content;

import com.aima.dto.request.ContentStatusRepairRequest;
import com.aima.dto.response.ContentStatusRepairReport;
import com.aima.dto.response.ContentStatusRepairResult;
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
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentStatusRepairService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Phase 6: job sửa trạng thái một lần — dry-run không ghi, apply đúng kế hoạch đã xem, chạy lại không đổi gì,
 * lịch IG bị giữ UNSUPPORTED_MEDIA, hold cũ không lý do và bài duyệt không xác định chỉ được báo cáo.
 * Kế hoạch là toàn cục (H2 dùng chung giữa các test) nên chỉ khẳng định trên dữ liệu của test này.
 */
@SpringBootTest
class ContentStatusRepairIntegrationTest {

    @Autowired ContentStatusRepairService repairService;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired PlatformAccountRepository accountRepository;
    @Autowired PostScheduleRepository scheduleRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate tx;

    User user;
    BrandProfile brand;
    PlatformAccount page;
    PlatformAccount instagram;

    @BeforeEach
    void fixture() {
        String email = "repair-" + UUID.randomUUID() + "@it.local";
        user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Repair IT").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);
        page = account(Platform.FACEBOOK, PlatformAccountType.PAGE);
        instagram = account(Platform.INSTAGRAM, PlatformAccountType.BUSINESS_ACCOUNT);
    }

    @Test
    void dryRunWritesNothingAndApplyIsIdempotent() {
        // V3 đưa bài NEED_REVIEW cũ về GENERATED dù đã có đủ bản FORMATTED → resolver nói FORMATTED.
        ContentItem stale = item(ContentItemStatus.GENERATED, ReviewStatus.NEED_REVIEW);
        version(stale, Platform.FACEBOOK);
        ContentItem igItem = item(ContentItemStatus.SCHEDULED, ReviewStatus.NONE);
        UUID igSchedule = rawSchedule(version(igItem, Platform.INSTAGRAM), instagram, ScheduleStatus.SCHEDULED);

        ContentStatusRepairReport report = repairService.dryRun().getResult();
        ContentStatusRepairReport.Change change = report.getItemChanges().stream()
                .filter(c -> c.getItemId().equals(stale.getId())).findFirst().orElseThrow();
        assertEquals("GENERATED", change.getFrom());
        assertEquals("FORMATTED", change.getTo());
        assertEquals("FORMATTED/-", change.getReason());
        assertTrue(report.getInstagramSchedules().contains(igSchedule));
        assertNotNull(report.getPlanToken());
        assertTrue(report.getEnumUsage().containsKey("content_items.status"));

        // Dry-run không ghi
        assertEquals(ContentItemStatus.GENERATED, status(stale));
        assertEquals(ScheduleStatus.SCHEDULED, scheduleRepository.findById(igSchedule).orElseThrow().getStatus());
        assertEquals(report.getPlanToken(), repairService.dryRun().getResult().getPlanToken(), "dry-run lặp lại ra cùng kế hoạch");

        ContentStatusRepairResult result = repairService.apply(request(report.getPlanToken())).getResult();
        assertEquals(0, result.getRemainingChanges());
        assertTrue(result.getItemsUpdated() >= 1);
        assertTrue(result.getInstagramHeld() >= 1);

        assertEquals(ContentItemStatus.FORMATTED, status(stale));
        assertEquals(ReviewStatus.NEED_REVIEW, contentItemRepository.findById(stale.getId()).orElseThrow().getReviewStatus(),
                "job không tự đổi trạng thái duyệt");
        PostSchedule held = tx.execute(s -> {
            PostSchedule sch = scheduleRepository.findById(igSchedule).orElseThrow();
            sch.getHolds().size();
            return sch;
        });
        assertEquals(ScheduleStatus.ON_HOLD, held.getStatus());
        assertEquals(List.of(HoldReason.UNSUPPORTED_MEDIA), held.getHolds().stream().map(h -> h.getReason()).toList());
        assertEquals(ContentItemStatus.ON_HOLD, status(igItem));

        // Chạy lại: kế hoạch rỗng, apply không đổi gì
        ContentStatusRepairReport again = repairService.dryRun().getResult();
        assertEquals(List.of(), again.getItemChanges());
        assertEquals(List.of(), again.getInstagramSchedules());
        ContentStatusRepairResult second = repairService.apply(request(again.getPlanToken())).getResult();
        assertEquals(0, second.getItemsUpdated());
        assertEquals(0, second.getInstagramHeld());
        assertEquals(0, second.getRemainingChanges());
    }

    @Test
    void applyRejectsPlanThatChangedSinceDryRun() {
        ContentItem item = item(ContentItemStatus.FORMATTED, ReviewStatus.NONE);
        version(item, Platform.FACEBOOK);
        String token = repairService.dryRun().getResult().getPlanToken();

        // Dữ liệu đổi sau dry-run (bài lệch mới xuất hiện) → token cũ không còn khớp.
        jdbc.update("update content_items set status = 'DRAFT' where id = ?", item.getId());
        AppException rejected = assertThrows(AppException.class, () -> repairService.apply(request(token)));
        assertEquals(ErrorCode.REPAIR_PLAN_CHANGED, rejected.getErrorCode());
        assertEquals(ContentItemStatus.DRAFT, status(item), "bị từ chối thì không ghi gì");
    }

    @Test
    void unclassifiedHoldsAndUnknownReviewAreOnlyReported() {
        ContentItem legacy = item(ContentItemStatus.ON_HOLD, ReviewStatus.NONE);
        UUID orphanHold = rawSchedule(version(legacy, Platform.FACEBOOK), page, ScheduleStatus.ON_HOLD);

        ContentStatusRepairReport report = repairService.dryRun().getResult();
        assertTrue(report.getUnclassifiedHolds().contains(orphanHold));
        assertTrue(report.getReviewUnknown().contains(legacy.getId()));

        repairService.apply(request(report.getPlanToken()));
        PostSchedule after = tx.execute(s -> {
            PostSchedule sch = scheduleRepository.findById(orphanHold).orElseThrow();
            sch.getHolds().size();
            return sch;
        });
        assertEquals(ScheduleStatus.ON_HOLD, after.getStatus(), "không đoán lý do cho hold cũ");
        assertEquals(List.of(), after.getHolds());
        assertEquals(ReviewStatus.NONE, contentItemRepository.findById(legacy.getId()).orElseThrow().getReviewStatus(),
                "không tự phê duyệt");
    }

    // ===== helpers

    private static ContentStatusRepairRequest request(String token) {
        return ContentStatusRepairRequest.builder().planToken(token).build();
    }

    private ContentItemStatus status(ContentItem item) {
        return contentItemRepository.findById(item.getId()).orElseThrow().getStatus();
    }

    private ContentItem item(ContentItemStatus stored, ReviewStatus review) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(stored); // mô phỏng giá trị lưu sẵn từ migration, không qua resolver
        item.setReviewStatus(review);
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

    // Lịch dữ liệu cũ, ghi thẳng repository (luồng tạo lịch hiện hành chặn IG và luôn ghi lý do hold).
    private UUID rawSchedule(ContentVersion version, PlatformAccount account, ScheduleStatus status) {
        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(account);
        schedule.setScheduledTime(Instant.now().plus(Duration.ofDays(1)));
        schedule.setStatus(status);
        return scheduleRepository.save(schedule).getId();
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
