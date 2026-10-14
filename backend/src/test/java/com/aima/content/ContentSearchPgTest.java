package com.aima.content;

import com.aima.dto.response.ContentItemResponse;
import com.aima.dto.response.ContentStrategyResponse;
import com.aima.dto.response.GlobalSearchResponse;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.entity.ContentStrategy;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.StrategyStatus;
import com.aima.enums.TokenType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.service.SearchService;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.Platform;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentItemService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tìm kiếm nội dung trên PostgreSQL THẬT (stack cô lập :55432, Flyway V1→V16): {@code GET /content-items?q=} khớp
 * KHÔNG DẤU trên caption/hook/hashtag của các bản nền tảng — trước đây tìm trong {@code content_items.caption/script}
 * (không còn được ghi) nên luôn rỗng. H2 không có {@code unaccent} nên chỉ kiểm được ở đây.
 * Cùng logic khớp với {@code GET /search} (ô tìm kiếm toàn cục) — kiểm cả hai ở đây.
 * Chạy: {@code -Disolated.postgres=true}.
 */
@EnabledIfSystemProperty(named = "isolated.postgres", matches = "true")
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
})
class ContentSearchPgTest {

    static final String URL = "jdbc:postgresql://127.0.0.1:55432/aima_isolated";
    static final String SCHEMA = "contentsearch_" + UUID.randomUUID().toString().replace("-", "");

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

    @Autowired private ContentItemService contentItemService;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private ContentStrategyRepository contentStrategyRepository;
    @Autowired private PlatformAccountRepository platformAccountRepository;
    @Autowired private PostScheduleRepository postScheduleRepository;
    @Autowired private SearchService searchService;

    @Test
    void contentItemsQueryMatchesVersionsWithoutDiacritics() {
        Owner owner = newOwner();
        UUID caption = item(owner.brand(), version("Bí quyết dưỡng da mùa đông", null, null, false));
        UUID hook = item(owner.brand(), version(null, "{\"hook\":{\"content\":\"Đừng bỏ lỡ ưu đãi\"},\"steps\":[]}", null, false));
        UUID hashtag = item(owner.brand(), version("Bài khác", null, "skincare,DaMụn", false));
        UUID legacyHook = item(owner.brand(), version(null, "Mở bài kiểu cũ\nBước hai", null, false));
        UUID deletedOnly = item(owner.brand(), version("Dưỡng da bản đã xóa", null, null, true));
        UUID percent = item(owner.brand(), version("Giảm 50% hôm nay", null, null, false));
        Owner other = newOwner();
        item(other.brand(), version("Dưỡng da của người khác", null, null, false));

        assertEquals(List.of(caption), search(owner, "duong da"), "không dấu + chữ hoa/thường + bỏ bản xóa mềm + đúng chủ");
        assertEquals(List.of(caption), search(owner, "DƯỠNG DA"));
        assertEquals(List.of(hook), search(owner, "dung bo lo"), "đ → d, khớp hook trong kịch bản JSON");
        assertEquals(List.of(hashtag), search(owner, "damun"), "khớp hashtag");
        assertEquals(List.of(legacyHook), search(owner, "mo bai kieu cu"), "kịch bản cũ dạng dòng: dòng đầu là hook");
        assertTrue(search(owner, "buoc hai").isEmpty(), "chỉ hook, không phải toàn bộ kịch bản");
        assertEquals(List.of(percent), search(owner, "50%"), "% gõ vào là ký tự thường, không phải wildcard");
        assertEquals(List.of(percent), search(owner, "%"));
        assertTrue(search(owner, "_").isEmpty());
        assertEquals(6, search(owner, "  ").size(), "q rỗng = không lọc (bài chỉ có bản đã xóa vẫn hiện như trước)");
        assertTrue(search(owner, "  ").contains(deletedOnly));
    }

    @Test
    void globalSearchGroupsOwnDataWithLimitAndTotals() {
        Owner owner = newOwner();
        item(owner.brand(), version("Mẹo dưỡng da cũ", null, null, false));
        item(owner.brand(), version("Mẹo dưỡng da mới", null, null, false));
        item(owner.brand(), version("Không liên quan", null, null, false));
        UUID strategy = strategy(owner.brand(), "Chiến lược Dưỡng Da Tết");
        strategy(owner.brand(), "Khác hẳn");
        PlatformAccount page = page(owner, "Trang Đẹp Da");
        UUID upcomingItem = item(owner.brand(), version("Lịch dưỡng da tuần sau", null, null, false));
        UUID upcoming = schedule(page, versionOf(upcomingItem), ScheduleStatus.SCHEDULED, 3);
        UUID cancelledItem = item(owner.brand(), version("Dưỡng da đã hủy", null, null, false));
        schedule(page, versionOf(cancelledItem), ScheduleStatus.CANCELLED, 2);
        UUID byAccount = schedule(page, versionOf(item(owner.brand(), version("Bài bất kỳ", null, null, false))), ScheduleStatus.ON_HOLD, 1);
        Owner other = newOwner();
        strategy(other.brand(), "Dưỡng da của người khác");
        item(other.brand(), version("Dưỡng da của người khác", null, null, false));

        GlobalSearchResponse r = searchService.search(owner.email(), "  duong da ", 2).getResult();
        assertEquals(4, r.getContentTotal(), "2 mẹo + 2 bài có lịch (bài của lịch đã hủy vẫn là nội dung), không lẫn user khác");
        assertEquals(List.of(cancelledItem, upcomingItem), r.getContents().stream().map(ContentItemResponse::getId).toList(),
                "cắt theo limit, mới nhất trước");
        assertEquals(List.of(strategy), r.getStrategies().stream().map(ContentStrategyResponse::getId).toList());
        assertEquals(1, r.getStrategyTotal(), "không lẫn chiến lược của user khác");
        assertEquals(List.of(upcoming), r.getSchedules().stream().map(PostScheduleResponse::getId).toList(),
                "lịch CANCELLED bị loại");
        assertEquals(1, r.getScheduleTotal());

        GlobalSearchResponse byName = searchService.search(owner.email(), "trang dep", 5).getResult();
        assertEquals(2, byName.getScheduleTotal(), "khớp tên tài khoản đăng → mọi lịch còn hiệu lực (không CANCELLED) của tài khoản đó");
        assertTrue(byName.getSchedules().stream().anyMatch(s -> s.getId().equals(byAccount)));
        assertEquals(0, byName.getContentTotal());
        assertEquals(List.of(), byName.getContents(), "nhóm rỗng là mảng rỗng, không null");
        assertEquals(List.of(), byName.getStrategies());

        assertEquals(ErrorCode.SEARCH_QUERY_INVALID,
                assertThrows(AppException.class, () -> searchService.search(owner.email(), "   ", 5)).getErrorCode());
        assertEquals(ErrorCode.SEARCH_QUERY_INVALID,
                assertThrows(AppException.class, () -> searchService.search(owner.email(), "x".repeat(101), 5)).getErrorCode());
        assertEquals(ErrorCode.SEARCH_LIMIT_INVALID,
                assertThrows(AppException.class, () -> searchService.search(owner.email(), "da", 11)).getErrorCode());
    }

    // ================================================================== dựng dữ liệu

    record Owner(String email, BrandProfile brand) {
    }

    record VersionSpec(String caption, String script, String hashtag, boolean deleted) {
    }

    private List<UUID> search(Owner owner, String q) {
        return contentItemService.list(owner.email(), null, null, null, null, null, null, null, q, "newest", 0, 50)
                .getResult().getContent().stream().map(ContentItemResponse::getId).toList();
    }

    private Owner newOwner() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "search-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Search IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand Search");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        return new Owner(email, brandProfileRepository.save(brand));
    }

    private UUID strategy(BrandProfile brand, String name) {
        ContentStrategy s = new ContentStrategy();
        s.setBrandProfile(brand);
        s.setName(name);
        s.setFrequencyCount(3);
        s.setStatus(StrategyStatus.ACTIVE);
        return contentStrategyRepository.save(s).getId();
    }

    private PlatformAccount page(Owner owner, String name) {
        PlatformAccount page = new PlatformAccount();
        page.setUser(owner.brand().getUser());
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId("page-" + UUID.randomUUID());
        page.setAccountName(name);
        page.setAccountType(PlatformAccountType.PAGE);
        page.setTokenType(TokenType.PAGE_TOKEN);
        page.setAccessToken("page-token");
        page.setConnectionStatus(ConnectionStatus.ACTIVE);
        return platformAccountRepository.save(page);
    }

    private ContentVersion versionOf(UUID itemId) {
        return contentVersionRepository.findAll().stream()
                .filter(v -> v.getContentItem().getId().equals(itemId)).findFirst().orElseThrow();
    }

    private UUID schedule(PlatformAccount page, ContentVersion version, ScheduleStatus status, int daysAhead) {
        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(page);
        schedule.setScheduledTime(Instant.now().plus(Duration.ofDays(daysAhead)));
        schedule.setStatus(status);
        return postScheduleRepository.save(schedule).getId();
    }

    private static VersionSpec version(String caption, String script, String hashtag, boolean deleted) {
        return new VersionSpec(caption, script, hashtag, deleted);
    }

    private UUID item(BrandProfile brand, VersionSpec spec) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        item = contentItemRepository.save(item);
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setFormattedCaption(spec.caption());
        version.setScript(spec.script());
        version.setFormattedHashtag(spec.hashtag());
        version.setStatus(ContentVersionStatus.FORMATTED);
        if (spec.deleted()) {
            version.setDeletedAt(LocalDateTime.now());
        }
        contentVersionRepository.save(version);
        return item.getId();
    }
}
