package com.aima.service.Impl;

import com.aima.entity.AccountInsightsDaily;
import com.aima.entity.AccountSyncState;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PlatformMedia;
import com.aima.enums.InstagramLinkStatus;
import com.aima.enums.MetricsErrorType;
import com.aima.enums.MetricsSyncStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.exception.MetricsFetchException;
import com.aima.mapper.PostAnalyticsMapper;
import com.aima.repository.AccountInsightsDailyRepository;
import com.aima.repository.AccountSyncStateRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PlatformMediaRepository;
import com.aima.repository.PostMetricSnapshotRepository;
import com.aima.repository.PostMetricsDailyRepository;
import com.aima.service.AnalyticsAccountSyncService;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformMetricsProvider;
import com.aima.service.PlatformMetricsProvider.AccountDailyMetrics;
import com.aima.service.PlatformMetricsProvider.PublishedPost;
import com.aima.util.PublishingTime;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Xem {@link AnalyticsAccountSyncService}. Mỗi kênh: đọc token trong transaction ngắn → gọi nền tảng NGOÀI
 * transaction (danh sách bài, insights, liên kết Instagram) → ghi kết quả trong MỘT transaction.
 *
 * <p>Lịch: thành công → {@value #INTERVAL_HOURS} giờ sau (bài người dùng vừa tự đăng hiện trong ≤ 1 giờ; nút "Làm mới"
 * đưa kênh về hạn ngay, chỉ bỏ qua kênh vừa quét dưới {@code MANUAL_REFRESH_MIN_GAP}). Lần đầu quét bài {@value #POSTS_LOOKBACK_DAYS} ngày và
 * lấy insights {@value #INSIGHTS_BACKFILL_DAYS} ngày (trần một truy vấn của Meta); các lần sau quét bài từ lần
 * thành công trước (lùi 1 ngày cho chắc) và lấy lại insights {@value #INSIGHTS_REFRESH_DAYS} ngày gần nhất (Meta
 * sửa số trong ~48h). Lỗi danh sách bài → backoff như bài (thiếu quyền / token: 24h; lỗi tạm: 1h·2^(n−1) ≤ 24h);
 * RATE_LIMIT → 1h, dừng cả lượt quét. Lỗi insights chỉ ghi mã lỗi, không làm hỏng phần danh sách bài.</p>
 *
 * <p>Bài ngoài AIMA tạo dòng {@code platform_media} {@code EXTERNAL}, rồi đi chung lịch đồng bộ số liệu bài với bài
 * AIMA. Bài AIMA vừa đăng mà bị quét trước khi kịp có dòng theo dõi sẽ được {@code AnalyticsSyncService.prepare}
 * nhận lại (gắn post_id, đổi origin) — không bao giờ tạo trùng.</p>
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AnalyticsAccountSyncServiceImpl implements AnalyticsAccountSyncService {

    static final int INTERVAL_HOURS = 1;
    static final Duration INTERVAL = Duration.ofHours(INTERVAL_HOURS);
    static final int POSTS_LOOKBACK_DAYS = 90;
    static final Duration POSTS_OVERLAP = Duration.ofDays(1);
    static final int INSIGHTS_BACKFILL_DAYS = 90;
    static final int INSIGHTS_REFRESH_DAYS = 3;
    // Ngắn hơn bài (15 phút): mỗi lượt chỉ vài lời gọi/kênh, và người dùng bấm "Làm mới" ngay sau khi tự đăng bài.
    static final Duration MANUAL_REFRESH_MIN_GAP = Duration.ofMinutes(2);
    /** Trường webhook Trang mà AIMA cần (giai đoạn 3): bài mới / xoá bài / bình luận / cảm xúc / chia sẻ. */
    static final String WEBHOOK_FIELDS = "feed";

    PlatformAccountRepository platformAccountRepository;
    AccountSyncStateRepository syncStateRepository;
    AccountInsightsDailyRepository insightsRepository;
    PlatformMediaRepository platformMediaRepository;
    PostMetricSnapshotRepository snapshotRepository;
    PostMetricsDailyRepository dailyRepository;
    PostAnalyticsMapper postAnalyticsMapper;
    MetaApiClient metaApiClient;
    TransactionTemplate transactionTemplate;
    List<PlatformMetricsProvider> providers;

    @Override
    public List<UUID> findDue(Instant now, int limit) {
        List<Platform> supported = providers.stream()
                .filter(PlatformMetricsProvider::supportsAccountSync).map(PlatformMetricsProvider::platform).toList();
        if (supported.isEmpty()) {
            return List.of();
        }
        return syncStateRepository.findDueAccounts(supported, now, PageRequest.of(0, limit));
    }

    /** Giá trị cần cho lời gọi nền tảng — chụp trong transaction, dùng ngoài (không giữ entity/proxy). */
    private record Target(Platform platform, PlatformAccountType accountType, String platformAccountId,
                          String accessToken, Instant postsSince, LocalDate insightsFrom, LocalDate today,
                          boolean needsWebhook) {
        @Override
        public String toString() { // không để token lọt vào log
            return "Target[" + platform + " " + accountType + "]";
        }
    }

    /** Kết quả một lời gọi: đúng một trong hai (dữ liệu hoặc lỗi đã phân loại). */
    private record Outcome<T>(T value, MetricsFetchException error) {
        boolean rateLimited() {
            return error != null && error.getErrorType() == MetricsErrorType.RATE_LIMIT;
        }
    }

    @Override
    public boolean sync(UUID accountId) {
        Instant now = Instant.now();
        Target target = transactionTemplate.execute(tx -> platformAccountRepository.findByIdAndDeletedAtIsNull(accountId)
                .map(account -> target(account, now))
                .orElse(null));
        if (target == null) {
            return true;
        }
        PlatformMetricsProvider provider = providers.stream()
                .filter(p -> p.platform() == target.platform() && p.supportsAccountSync()).findFirst().orElse(null);
        if (provider == null) {
            return true;
        }

        // HTTP ngoài transaction (rule #24). Token hỏng / bị giới hạn ở bước đầu thì không gọi tiếp.
        Outcome<List<PublishedPost>> posts = call(() ->
                provider.listPublishedPosts(target.accessToken(), target.platformAccountId(), target.postsSince()));
        if (posts.rateLimited()) {
            return pauseForRateLimit(accountId, posts.error());
        }
        Outcome<List<AccountDailyMetrics>> insights = tokenInvalid(posts) ? new Outcome<>(null, posts.error())
                : call(() -> provider.fetchAccountMetrics(target.accessToken(), target.platformAccountId(),
                        target.insightsFrom(), target.today()));
        if (insights.rateLimited()) {
            return pauseForRateLimit(accountId, insights.error());
        }
        Boolean instagramLinked = target.platform() == Platform.FACEBOOK
                && target.accountType() == PlatformAccountType.PAGE && !tokenInvalid(posts)
                ? instagramLinked(target) : null;
        // Trang chưa đăng ký webhook (kết nối trước giai đoạn 3 / lần trước thiếu quyền) → thử lại mỗi lượt quét.
        Outcome<Boolean> webhook = target.needsWebhook() && !tokenInvalid(posts)
                ? subscribeWebhook(target.platformAccountId(), target.accessToken()) : null;

        try {
            transactionTemplate.executeWithoutResult(tx -> save(accountId, posts, insights, instagramLinked, webhook, now));
        } catch (Exception e) {
            log.error("[AnalyticsAccountSync] Lỗi khi lưu kết quả đồng bộ tài khoản {}", accountId, e);
        }
        return true;
    }

    private Target target(PlatformAccount account, Instant now) {
        AccountSyncState state = syncStateRepository.findByPlatformAccount_IdAndDeletedAtIsNull(account.getId()).orElse(null);
        Instant postsSince = state == null || state.getLastSyncedAt() == null
                ? now.minus(Duration.ofDays(POSTS_LOOKBACK_DAYS))
                : state.getLastSyncedAt().minus(POSTS_OVERLAP);
        LocalDate today = LocalDate.ofInstant(now, PublishingTime.LEGACY_ZONE);
        LocalDate insightsFrom = insightsRepository.existsByPlatformAccount_IdAndDeletedAtIsNull(account.getId())
                ? today.minusDays(INSIGHTS_REFRESH_DAYS)
                : today.minusDays(INSIGHTS_BACKFILL_DAYS - 1L);
        boolean needsWebhook = isFacebookPage(account) && (state == null || state.getWebhookSubscribedAt() == null);
        return new Target(account.getPlatformName(), account.getAccountType(), account.getPlatformAccountId(),
                account.getAccessToken(), postsSince, insightsFrom, today, needsWebhook);
    }

    private static boolean isFacebookPage(PlatformAccount account) {
        return account.getPlatformName() == Platform.FACEBOOK && account.getAccountType() == PlatformAccountType.PAGE;
    }

    private Outcome<Boolean> subscribeWebhook(String pageId, String pageToken) {
        return call(() -> {
            metaApiClient.subscribePageWebhook(pageId, pageToken, WEBHOOK_FIELDS);
            return true;
        });
    }

    private static void applyWebhookOutcome(AccountSyncState state, Outcome<Boolean> webhook, Instant now) {
        if (webhook.error() == null) {
            state.setWebhookSubscribedAt(now);
            state.setWebhookErrorCode(null);
        } else {
            state.setWebhookErrorCode(errorCode(webhook.error()));
        }
    }

    private static <T> Outcome<T> call(Supplier<T> work) {
        try {
            return new Outcome<>(work.get(), null);
        } catch (MetricsFetchException e) {
            return new Outcome<>(null, e);
        } catch (RuntimeException e) {
            log.error("[AnalyticsAccountSync] Lỗi nội bộ khi gọi nền tảng", e);
            return new Outcome<>(null, new MetricsFetchException(MetricsErrorType.TEMPORARY, "INTERNAL",
                    String.valueOf(e.getMessage())));
        }
    }

    private static boolean tokenInvalid(Outcome<?> outcome) {
        return outcome.error() != null && outcome.error().getErrorType() == MetricsErrorType.TOKEN_INVALID;
    }

    // Best-effort: không tra được thì giữ trạng thái cũ (null).
    private Boolean instagramLinked(Target target) {
        try {
            return metaApiClient.getInstagramBusinessAccount(target.platformAccountId(), target.accessToken()).isPresent();
        } catch (RuntimeException e) {
            log.warn("[AnalyticsAccountSync] Không kiểm tra được Instagram liên kết với Trang {}: {}",
                    target.platformAccountId(), MetaApiClientImpl.mask(String.valueOf(e.getMessage())));
            return null;
        }
    }

    // ===== Ghi kết quả (một transaction) =====

    private void save(UUID accountId, Outcome<List<PublishedPost>> posts, Outcome<List<AccountDailyMetrics>> insights,
                      Boolean instagramLinked, Outcome<Boolean> webhook, Instant now) {
        PlatformAccount account = platformAccountRepository.findById(accountId).orElseThrow();
        AccountSyncState state = stateOf(account);

        int imported = 0;
        if (posts.error() == null) {
            imported = importPosts(account, posts.value());
            state.setPostsErrorCode(null);
            state.setConsecutiveFailures(0);
            state.setLastSyncedAt(now);
            state.setNextSyncAt(now.plus(INTERVAL));
        } else {
            int failures = state.getConsecutiveFailures() + 1;
            state.setConsecutiveFailures(failures);
            state.setPostsErrorCode(errorCode(posts.error()));
            state.setLastErrorAt(now);
            state.setNextSyncAt(now.plus(AnalyticsSyncServiceImpl.backoff(posts.error().getErrorType(), failures)));
            log.warn("[AnalyticsAccountSync] Tài khoản {} lỗi đọc danh sách bài {} ({}): {}", accountId,
                    posts.error().getErrorType(), posts.error().getResponseCode(), posts.error().getMessage());
        }

        int days = 0;
        if (insights.error() == null) {
            days = upsertInsights(account, insights.value(), now);
            state.setInsightsErrorCode(null);
        } else {
            state.setInsightsErrorCode(errorCode(insights.error()));
            if (posts.error() == null) {
                state.setLastErrorAt(now);
                log.warn("[AnalyticsAccountSync] Tài khoản {} lỗi đọc insights {} ({}): {}", accountId,
                        insights.error().getErrorType(), insights.error().getResponseCode(), insights.error().getMessage());
            }
        }

        if (instagramLinked != null) {
            state.setInstagramLinkStatus(instagramLinked ? InstagramLinkStatus.LINKED : InstagramLinkStatus.NOT_LINKED);
        }
        if (webhook != null) {
            applyWebhookOutcome(state, webhook, now);
        }
        syncStateRepository.save(state);
        log.info("[AnalyticsAccountSync] Tài khoản {} ({}): {} bài mới ngoài AIMA, {} ngày insights",
                accountId, account.getPlatformName(), imported, days);
    }

    /** Bài chưa theo dõi → dòng EXTERNAL; bài đã theo dõi → bổ sung đường dẫn / loại nội dung còn thiếu. */
    private int importPosts(PlatformAccount account, List<PublishedPost> posts) {
        if (posts.isEmpty()) {
            return 0;
        }
        Map<String, PlatformMedia> existing = platformMediaRepository
                .findByPlatformAccount_IdAndPlatformMediaIdInAndDeletedAtIsNull(account.getId(),
                        posts.stream().map(PublishedPost::platformMediaId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(PlatformMedia::getPlatformMediaId, Function.identity()));
        int imported = 0;
        for (PublishedPost post : posts) {
            PlatformMedia media = existing.get(post.platformMediaId());
            if (media != null) {
                postAnalyticsMapper.updateMediaDetails(post, media);
                continue;
            }
            media = platformMediaRepository.save(postAnalyticsMapper.toExternalMedia(account, post));
            existing.put(post.platformMediaId(), media); // phòng nền tảng trả trùng một bài ở hai trang
            imported++;
        }
        return imported;
    }

    /** Upsert theo (tài khoản, ngày); metric lần này không trả thì giữ số cũ. Trả số ngày đã ghi. */
    private int upsertInsights(PlatformAccount account, List<AccountDailyMetrics> rows, Instant now) {
        if (rows.isEmpty()) {
            return 0;
        }
        Map<LocalDate, AccountInsightsDaily> existing = insightsRepository
                .findByPlatformAccount_IdAndMetricDateIn(account.getId(),
                        rows.stream().map(AccountDailyMetrics::date).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(AccountInsightsDaily::getMetricDate, Function.identity()));
        for (AccountDailyMetrics metrics : rows) {
            AccountInsightsDaily row = existing.get(metrics.date());
            if (row == null) {
                insightsRepository.save(postAnalyticsMapper.toAccountInsights(account, metrics, now));
            } else {
                postAnalyticsMapper.updateAccountInsights(metrics, now, row);
            }
        }
        return rows.size();
    }

    private boolean pauseForRateLimit(UUID accountId, MetricsFetchException error) {
        log.warn("[AnalyticsAccountSync] Tài khoản {} bị giới hạn tần suất ({}) — thử lại sau {}", accountId,
                error.getResponseCode(), AnalyticsSyncServiceImpl.RATE_LIMIT_PAUSE);
        try {
            transactionTemplate.executeWithoutResult(tx -> {
                AccountSyncState state = stateOf(platformAccountRepository.findById(accountId).orElseThrow());
                state.setLastErrorAt(Instant.now());
                state.setNextSyncAt(Instant.now().plus(AnalyticsSyncServiceImpl.RATE_LIMIT_PAUSE));
                syncStateRepository.save(state);
            });
        } catch (Exception e) {
            log.error("[AnalyticsAccountSync] Lỗi khi ghi tạm dừng tài khoản {}", accountId, e);
        }
        return false;
    }

    private AccountSyncState stateOf(PlatformAccount account) {
        return syncStateRepository.findByPlatformAccount_IdAndDeletedAtIsNull(account.getId())
                .orElseGet(() -> postAnalyticsMapper.toSyncState(account));
    }

    private static String errorCode(MetricsFetchException error) {
        String code = error.getErrorType() + ":" + error.getResponseCode();
        return code.length() <= 50 ? code : code.substring(0, 50);
    }

    // ===== Làm mới / OAuth / dev-seed =====

    @Override
    public int requestSync(UUID userId) {
        Instant now = Instant.now();
        Integer queued = transactionTemplate.execute(tx ->
                syncStateRepository.markDueNow(userId, now, now.minus(MANUAL_REFRESH_MIN_GAP)));
        return queued == null ? 0 : queued;
    }

    @Override
    public void recordInstagramLink(PlatformAccount page, Boolean linked) {
        if (linked == null || page.getPlatformName() != Platform.FACEBOOK
                || page.getAccountType() != PlatformAccountType.PAGE) {
            return;
        }
        AccountSyncState state = stateOf(page);
        state.setInstagramLinkStatus(linked ? InstagramLinkStatus.LINKED : InstagramLinkStatus.NOT_LINKED);
        if (state.getId() == null) {
            state.setNextSyncAt(Instant.now()); // Trang mới kết nối: đồng bộ ở lượt quét kế tiếp
        }
        syncStateRepository.save(state);
    }

    /** Thông tin cần để gọi subscribed_apps — chụp trong transaction. */
    private record WebhookTarget(String pageId, String pageToken) {
        @Override
        public String toString() { // không để token lọt vào log
            return "WebhookTarget[" + pageId + "]";
        }
    }

    @Override
    public void ensureWebhookSubscribed(UUID accountId) {
        WebhookTarget target = transactionTemplate.execute(tx -> platformAccountRepository.findByIdAndDeletedAtIsNull(accountId)
                .filter(AnalyticsAccountSyncServiceImpl::isFacebookPage)
                .filter(account -> syncStateRepository.findByPlatformAccount_IdAndDeletedAtIsNull(account.getId())
                        .map(state -> state.getWebhookSubscribedAt() == null).orElse(true))
                .map(account -> new WebhookTarget(account.getPlatformAccountId(), account.getAccessToken()))
                .orElse(null));
        if (target == null) {
            return;
        }
        Outcome<Boolean> outcome = subscribeWebhook(target.pageId(), target.pageToken()); // ngoài transaction
        if (outcome.error() != null) {
            log.warn("[AnalyticsAccountSync] Trang {} chưa đăng ký được webhook ({}): {}", target.pageId(),
                    outcome.error().getResponseCode(), outcome.error().getMessage());
        }
        try {
            transactionTemplate.executeWithoutResult(tx -> {
                AccountSyncState state = stateOf(platformAccountRepository.findById(accountId).orElseThrow());
                applyWebhookOutcome(state, outcome, Instant.now());
                if (state.getId() == null) {
                    state.setNextSyncAt(Instant.now());
                }
                syncStateRepository.save(state);
            });
        } catch (Exception e) {
            log.error("[AnalyticsAccountSync] Lỗi khi ghi trạng thái webhook của tài khoản {}", accountId, e);
        }
    }

    @Override
    public int markDueForPage(String pageId) {
        int marked = 0;
        Instant now = Instant.now();
        for (PlatformAccount page : platformAccountRepository.findByPlatformNameAndAccountTypeAndPlatformAccountIdAndDeletedAtIsNull(
                Platform.FACEBOOK, PlatformAccountType.PAGE, pageId)) {
            AccountSyncState state = stateOf(page);
            if (state.getId() != null && state.getNextSyncAt() == null) {
                continue; // kết nối mẫu / đã tắt tự đồng bộ
            }
            state.setNextSyncAt(now);
            syncStateRepository.save(state);
            marked++;
        }
        return marked;
    }

    @Override
    public int adoptPreviousConnections(PlatformAccount account) {
        List<PlatformMedia> previous = platformMediaRepository.findFromDeletedConnections(
                account.getUser().getId(), account.getPlatformName(), account.getPlatformAccountId());
        if (previous.isEmpty()) {
            return 0;
        }
        Map<String, List<PlatformMedia>> byMediaId = new LinkedHashMap<>();
        previous.forEach(m -> byMediaId.computeIfAbsent(m.getPlatformMediaId(), k -> new ArrayList<>()).add(m));
        platformMediaRepository.findByPlatformAccount_IdAndDeletedAtIsNull(account.getId()).stream()
                .filter(m -> byMediaId.containsKey(m.getPlatformMediaId()))
                .forEach(m -> byMediaId.get(m.getPlatformMediaId()).add(m));

        Instant now = Instant.now();
        int adopted = 0;
        for (List<PlatformMedia> copies : byMediaId.values()) {
            PlatformMedia keeper = copies.stream().min(KEEPER_ORDER).orElseThrow();
            boolean merged = false;
            for (PlatformMedia copy : copies) {
                if (copy == keeper) {
                    continue;
                }
                snapshotRepository.moveToMedia(copy, keeper);
                dailyRepository.softDeleteForMedia(copy, LocalDateTime.now());
                copy.setDeletedAt(LocalDateTime.now());
                platformMediaRepository.saveAndFlush(copy); // giải phóng unique (tài khoản, id bài) trước khi chuyển bản giữ lại
                merged = true;
            }
            PlatformMedia keep = platformMediaRepository.findById(keeper.getId()).orElseThrow(); // context đã clear
            keep.setPlatformAccount(account);
            if (merged && keep.getSyncStatus() == MetricsSyncStatus.ACTIVE) {
                keep.setNextSyncAt(now); // tính lại số theo ngày từ chuỗi snapshot đã gộp
            }
            platformMediaRepository.saveAndFlush(keep);
            adopted++;
        }
        log.info("[AnalyticsAccountSync] Kết nối lại {} ({}): chuyển {} bài từ kết nối cũ", account.getId(),
                account.getPlatformName(), adopted);
        return adopted;
    }

    /** Bản giữ lại khi gộp: gắn bài AIMA trước, rồi bản theo dõi lâu nhất. */
    private static final Comparator<PlatformMedia> KEEPER_ORDER = Comparator
            .comparing((PlatformMedia m) -> m.getPost() == null)
            .thenComparing(PlatformMedia::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));

    @Override
    public void disableForAccounts(Collection<PlatformAccount> accounts) {
        for (PlatformAccount account : accounts) {
            AccountSyncState state = stateOf(account);
            state.setNextSyncAt(null);
            state.setPostsErrorCode("DEV_SEED");
            syncStateRepository.save(state);
        }
    }
}
