package com.aima.service.Impl;

import com.aima.config.MetaProperties;
import com.aima.enums.MetricsErrorType;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.exception.MetricsFetchException;
import com.aima.exception.PublishException;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformVersionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Cài đặt {@link MetaApiClient} bằng WebClient (đồng bộ qua .block() vì app dùng Spring MVC).
 */
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MetaApiClientImpl implements MetaApiClient {

    WebClient webClient;
    MetaProperties metaProperties;
    PlatformVersionService versionService;
    ObjectMapper objectMapper;

    public MetaApiClientImpl(@Qualifier("metaWebClient") WebClient webClient,
                             MetaProperties metaProperties,
                             PlatformVersionService versionService,
                             ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.metaProperties = metaProperties;
        this.versionService = versionService;
        this.objectMapper = objectMapper;
    }

    // ---------- OAuth token ----------

    @Override
    public MetaTokenResult exchangeCodeForToken(Platform platform, String code) {
        MetaProperties.App app = appConfig(platform);
        String version = versionService.getCurrentVersion(platform);

        if (platform == Platform.THREADS) {
            String url = UriComponentsBuilder.fromUriString(metaProperties.threadsBaseUrl())
                    .path("/oauth/access_token")
                    .queryParam("client_id", app.appId())
                    .queryParam("client_secret", app.appSecret())
                    .queryParam("grant_type", "authorization_code")
                    .queryParam("redirect_uri", app.redirectUri())
                    .queryParam("code", code)
                    .toUriString();
            JsonNode body = post(url, platform);
            return new MetaTokenResult(text(body, "access_token"), longValue(body, "expires_in"));
        }

        String url = UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, "oauth", "access_token")
                .queryParam("client_id", app.appId())
                .queryParam("client_secret", app.appSecret())
                .queryParam("redirect_uri", app.redirectUri())
                .queryParam("code", code)
                .toUriString();
        JsonNode body = get(url, platform);
        return new MetaTokenResult(text(body, "access_token"), longValue(body, "expires_in"));
    }

    @Override
    public MetaTokenResult getLongLivedUserToken(Platform platform, String shortLivedToken) {
        MetaProperties.App app = appConfig(platform);

        if (platform == Platform.THREADS) {
            String url = UriComponentsBuilder.fromUriString(metaProperties.threadsBaseUrl())
                    .path("/access_token")
                    .queryParam("grant_type", "th_exchange_token")
                    .queryParam("client_secret", app.appSecret())
                    .queryParam("access_token", shortLivedToken)
                    .toUriString();
            JsonNode body = get(url, platform);
            return new MetaTokenResult(text(body, "access_token"), longValue(body, "expires_in"));
        }

        String version = versionService.getCurrentVersion(platform);
        String url = UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, "oauth", "access_token")
                .queryParam("grant_type", "fb_exchange_token")
                .queryParam("client_id", app.appId())
                .queryParam("client_secret", app.appSecret())
                .queryParam("fb_exchange_token", shortLivedToken)
                .toUriString();
        JsonNode body = get(url, platform);
        return new MetaTokenResult(text(body, "access_token"), longValue(body, "expires_in"));
    }

    // ---------- Accounts ----------

    @Override
    public List<MetaPage> getMyAccounts(String userToken) {
        Platform platform = Platform.FACEBOOK;
        String version = versionService.getCurrentVersion(platform);
        String url = withProof(UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, "me", "accounts")
                .queryParam("fields", "id,name,access_token,category")
                .queryParam("access_token", userToken), userToken, platform)
                .toUriString();

        JsonNode body = get(url, platform);
        List<MetaPage> pages = new ArrayList<>();
        JsonNode data = body.path("data");
        if (data.isArray()) {
            for (JsonNode node : data) {
                pages.add(new MetaPage(
                        text(node, "id"),
                        text(node, "name"),
                        text(node, "access_token"),
                        text(node, "category")));
            }
        }
        return pages;
    }

    @Override
    public Optional<MetaIgAccount> getInstagramBusinessAccount(String pageId, String pageToken) {
        Platform platform = Platform.FACEBOOK;
        String version = versionService.getCurrentVersion(platform);
        String url = withProof(UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, pageId)
                .queryParam("fields", "instagram_business_account{id,username,name,profile_picture_url}")
                .queryParam("access_token", pageToken), pageToken, platform)
                .toUriString();

        JsonNode body = get(url, platform);
        JsonNode ig = body.path("instagram_business_account");
        if (ig.isMissingNode() || ig.isNull() || !ig.hasNonNull("id")) {
            return Optional.empty();
        }
        return Optional.of(new MetaIgAccount(
                text(ig, "id"),
                text(ig, "username"),
                text(ig, "name"),
                text(ig, "profile_picture_url")));
    }

    @Override
    public List<String> getGrantedPermissions(String userToken) {
        Platform platform = Platform.FACEBOOK;
        String version = versionService.getCurrentVersion(platform);
        String url = withProof(UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, "me", "permissions")
                .queryParam("access_token", userToken), userToken, platform)
                .toUriString();

        JsonNode body = get(url, platform);
        List<String> granted = new ArrayList<>();
        for (JsonNode node : body.path("data")) {
            if ("granted".equals(text(node, "status")) && text(node, "permission") != null) {
                granted.add(text(node, "permission"));
            }
        }
        return granted;
    }

    // ---------- Profile / validate ----------

    @Override
    public MetaUser getMe(Platform platform, String token) {
        if (platform == Platform.THREADS) {
            String version = versionService.getCurrentVersion(platform);
            String url = UriComponentsBuilder.fromUriString(metaProperties.threadsBaseUrl())
                    .pathSegment(version, "me")
                    .queryParam("fields", "id,username,name,threads_profile_picture_url")
                    .queryParam("access_token", token)
                    .toUriString();
            JsonNode body = get(url, platform);
            return new MetaUser(text(body, "id"), text(body, "name"), text(body, "username"),
                    text(body, "threads_profile_picture_url"));
        }

        String version = versionService.getCurrentVersion(platform);
        String url = withProof(UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, "me")
                .queryParam("fields", "id,name,picture.width(200).height(200)")
                .queryParam("access_token", token), token, platform)
                .toUriString();
        JsonNode body = get(url, platform);
        String id = text(body, "id");
        return new MetaUser(id, text(body, "name"), null, facebookAvatarUrl(id, body));
    }

    /**
     * URL avatar Facebook bền vững: {@code {graphBaseUrl}/{id}/picture?type=large} (không token, không hết hạn).
     * Trả null khi user dùng avatar mặc định (picture.data.is_silhouette = true) để FE fallback chữ cái đầu.
     */
    private String facebookAvatarUrl(String id, JsonNode body) {
        if (id == null) {
            return null;
        }
        JsonNode pictureData = body.path("picture").path("data");
        if (pictureData.path("is_silhouette").asBoolean(false)) {
            return null;
        }
        return UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(id, "picture")
                .queryParam("type", "large")
                .toUriString();
    }

    @Override
    public void revokeToken(Platform platform, String token) {
        if (platform == Platform.THREADS) {
            // Threads chưa cung cấp endpoint revoke chính thức — chỉ xoá local (soft delete ở service).
            log.info("[Meta] Threads không hỗ trợ revoke từ xa; bỏ qua revoke phía nền tảng.");
            return;
        }
        // Best-effort: token hết hạn (190), sai appsecret_proof, 4xx/5xx, timeout, lỗi mạng đều chỉ
        // log — việc xoá kết nối local không được phụ thuộc Meta. Timeout riêng, ngắn hơn timeout chung.
        try {
            String version = versionService.getCurrentVersion(platform);
            String url = withProof(UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                    .pathSegment(version, "me", "permissions")
                    .queryParam("access_token", token), token, platform)
                    .toUriString();
            // Body {"success":true} đọc dạng String: WebClient decode bằng Jackson 3 nên KHÔNG hiểu kiểu
            // com.fasterxml JsonNode (Jackson 2) → "Type definition error". Không cần nội dung body.
            webClient.delete().uri(encodedUri(url)).retrieve().bodyToMono(String.class).timeout(REVOKE_TIMEOUT).block();
            log.info("[Meta] Đã revoke token (đã mask) trên {}", platform);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] Revoke token thất bại trên {} (bỏ qua): {} {}", platform, e.getStatusCode(),
                    mask(e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.warn("[Meta] Revoke token thất bại trên {} (bỏ qua): {}", platform, mask(String.valueOf(e.getMessage())));
        }
    }

    static final Duration REVOKE_TIMEOUT = Duration.ofSeconds(5);

    // ---------- Post metrics (FR-59) ----------

    @Override
    public MetaPostMetrics getPostMetrics(Platform platform, String platformPostId, String token) {
        if (platform == Platform.THREADS) {
            return getThreadsPostMetrics(platformPostId, token);
        }
        if (platform == Platform.FACEBOOK) {
            return getFacebookPostMetrics(platformPostId, token);
        }
        // Instagram: chưa có bài đăng (MVP không đăng media) — không có gì để thu thập.
        throw new MetricsFetchException(MetricsErrorType.UNSUPPORTED, "UNSUPPORTED",
                "Chưa hỗ trợ thu số liệu " + platform);
    }

    /** Metric lượt xem bài Page — thay post_impressions đã bị Meta khai tử 15/11/2025. */
    static final String FB_POST_VIEWS_METRIC = "post_media_view";

    private MetaPostMetrics getFacebookPostMetrics(String postId, String pageToken) {
        Platform platform = Platform.FACEBOOK;
        String version = versionService.getCurrentVersion(platform);
        // reactions = mọi cảm xúc (Thích/Yêu thích/Haha/...), không chỉ Like; limit(0) = chỉ lấy tổng, không tải danh sách.
        String url = withProof(UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, postId)
                .queryParam("fields", "reactions.summary(total_count).limit(0),comments.summary(true).limit(0),shares")
                .queryParam("access_token", pageToken), pageToken, platform)
                .toUriString();
        JsonNode body = getMetrics(url, platform);

        Long reactions = summaryCount(body, "reactions");
        Long comments = summaryCount(body, "comments");
        JsonNode sharesNode = body.path("shares").path("count");
        Long shares = sharesNode.isMissingNode() || sharesNode.isNull() ? 0L : sharesNode.asLong();

        // Lượt xem cần read_insights: thiếu quyền → views null nhưng vẫn lưu tương tác. Rate limit / token /
        // lỗi tạm thì ném ra để cả mốc được thu lại sau — không lưu vĩnh viễn một snapshot thiếu views.
        Long views = null;
        String insightsUrl = withProof(UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, postId, "insights")
                .queryParam("metric", FB_POST_VIEWS_METRIC)
                .queryParam("access_token", pageToken), pageToken, platform)
                .toUriString();
        try {
            views = metricValue(getMetrics(insightsUrl, platform), FB_POST_VIEWS_METRIC);
        } catch (MetricsFetchException e) {
            if (e.getErrorType() == MetricsErrorType.PERMISSION) {
                log.info("[Meta] Không có quyền đọc lượt xem bài {} (cần read_insights) — views = null", postId);
            } else if (e.getErrorType() == MetricsErrorType.INVALID_REQUEST) {
                log.error("[Meta] Metric {} bị từ chối cho bài {} ({}) — có thể Meta đã khai tử metric này",
                        FB_POST_VIEWS_METRIC, postId, e.getResponseCode());
            } else {
                throw e;
            }
        }
        return new MetaPostMetrics(views, reactions, comments, shares, null); // FB post không có saves
    }

    private static Long metricValue(JsonNode insights, String metric) {
        for (JsonNode item : insights.path("data")) {
            if (metric.equals(text(item, "name"))) {
                JsonNode value = item.path("values").path(0).path("value");
                return value.isMissingNode() || value.isNull() ? null : value.asLong();
            }
        }
        return null;
    }

    private MetaPostMetrics getThreadsPostMetrics(String mediaId, String token) {
        Platform platform = Platform.THREADS;
        String version = versionService.getCurrentVersion(platform);
        String url = UriComponentsBuilder.fromUriString(metaProperties.threadsBaseUrl())
                .pathSegment(version, mediaId, "insights")
                .queryParam("metric", "views,likes,replies,reposts,quotes")
                .queryParam("access_token", token)
                .toUriString();
        JsonNode body = getMetrics(url, platform);

        Long views = null;
        Long likes = null;
        Long replies = null;
        long sharesTotal = 0;
        boolean hasShares = false;
        for (JsonNode metric : body.path("data")) {
            String name = text(metric, "name");
            JsonNode value = metric.path("values").path(0).path("value");
            if (name == null || value.isMissingNode() || value.isNull()) {
                continue;
            }
            switch (name) {
                case "views" -> views = value.asLong();
                case "likes" -> likes = value.asLong();
                case "replies" -> replies = value.asLong();
                case "reposts", "quotes" -> {
                    sharesTotal += value.asLong();
                    hasShares = true;
                }
                default -> log.debug("[Meta] Threads metric lạ: {}", name);
            }
        }
        // reposts + quotes gộp thành shares; Threads không có saves.
        return new MetaPostMetrics(views, likes, replies, hasShares ? sharesTotal : null, null);
    }

    private static Long summaryCount(JsonNode body, String field) {
        JsonNode count = body.path(field).path("summary").path("total_count");
        return count.isMissingNode() || count.isNull() ? null : count.asLong();
    }

    // ---------- Publish (FR-53/FR-54) ----------

    @Override
    public MetaPostResult publishPagePost(String pageId, String pageToken, String message) {
        Platform platform = Platform.FACEBOOK;
        String version = versionService.getCurrentVersion(platform);
        String url = UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, pageId, "feed")
                .toUriString();

        // Form body (không query string) — message có thể dài và chứa ký tự đặc biệt.
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("message", message);
        form.add("access_token", pageToken);
        if (metaProperties.appSecretProofEnabled()) {
            form.add("appsecret_proof", generateAppSecretProof(pageToken, appConfig(platform).appSecret()));
        }

        JsonNode body = postFormForPublish(url, form, platform);
        return new MetaPostResult(text(body, "id"));
    }

    @Override
    public MetaPostResult publishThreadsPost(String token, String text) {
        Platform platform = Platform.THREADS;
        String version = versionService.getCurrentVersion(platform);

        // Bước 1: tạo media container dạng TEXT.
        String createUrl = UriComponentsBuilder.fromUriString(metaProperties.threadsBaseUrl())
                .pathSegment(version, "me", "threads")
                .toUriString();
        MultiValueMap<String, String> createForm = new LinkedMultiValueMap<>();
        createForm.add("media_type", "TEXT");
        createForm.add("text", text);
        createForm.add("access_token", token);
        JsonNode container = postFormForPublish(createUrl, createForm, platform);
        String creationId = text(container, "id");
        if (creationId == null) {
            throw new PublishException(PublishErrorType.TEMPORARY, "NO_CONTAINER",
                    "Threads không trả về container id khi tạo bài");
        }

        // Bước 2: publish container.
        String publishUrl = UriComponentsBuilder.fromUriString(metaProperties.threadsBaseUrl())
                .pathSegment(version, "me", "threads_publish")
                .toUriString();
        MultiValueMap<String, String> publishForm = new LinkedMultiValueMap<>();
        publishForm.add("creation_id", creationId);
        publishForm.add("access_token", token);
        JsonNode published = postFormForPublish(publishUrl, publishForm, platform);
        return new MetaPostResult(text(published, "id"));
    }

    @Override
    public String generateAppSecretProof(String token, String appSecret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new AppException(ErrorCode.META_API_ERROR);
        }
    }

    // ---------- Helpers ----------

    private UriComponentsBuilder withProof(UriComponentsBuilder builder, String token, Platform platform) {
        if (metaProperties.appSecretProofEnabled()) {
            builder.queryParam("appsecret_proof", generateAppSecretProof(token, appConfig(platform).appSecret()));
        }
        return builder;
    }

    private MetaProperties.App appConfig(Platform platform) {
        return platform == Platform.THREADS ? metaProperties.threads() : metaProperties.facebook();
    }

    /**
     * Mọi URL ở lớp này dựng bằng {@code UriComponentsBuilder...toUriString()} — ĐÃ encode đúng một lần
     * ({@code {}} → {@code %7B%7D}). Phải đưa vào WebClient dưới dạng {@link URI}: overload
     * {@code uri(String)} coi chuỗi là URI template và encode LẦN HAI ({@code %7B} → {@code %257B}) →
     * Graph trả code 2500 "Syntax error" cho field lồng nhau như {@code instagram_business_account{...}}.
     */
    private static URI encodedUri(String encodedUrl) {
        // UriComponentsBuilder để nguyên '+' trong query (hợp lệ theo RFC 3986) nhưng server decode
        // '+' thành dấu cách → token/proof có '+' tới Meta bị sai. toUriString() luôn encode dấu cách
        // thành %20, nên mọi '+' còn lại trong query đều là '+' thật → %2B.
        int queryStart = encodedUrl.indexOf('?');
        if (queryStart >= 0 && encodedUrl.indexOf('+', queryStart) >= 0) {
            encodedUrl = encodedUrl.substring(0, queryStart) + encodedUrl.substring(queryStart).replace("+", "%2B");
        }
        return URI.create(encodedUrl);
    }

    private JsonNode get(String url, Platform platform) {
        log.debug("[Meta] GET {} ({})", mask(url), platform);
        try {
            String raw = webClient.get().uri(encodedUri(url)).retrieve().bodyToMono(String.class).block();
            return parse(raw);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] GET lỗi {} {}: {}", platform, e.getStatusCode(), mask(e.getResponseBodyAsString()));
            throw toAppException(e);
        }
    }

    private JsonNode post(String url, Platform platform) {
        log.debug("[Meta] POST {} ({})", mask(url), platform);
        try {
            String raw = webClient.post().uri(encodedUri(url)).retrieve().bodyToMono(String.class).block();
            return parse(raw);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] POST lỗi {} {}: {}", platform, e.getStatusCode(), mask(e.getResponseBodyAsString()));
            throw toAppException(e);
        }
    }

    // GET cho luồng thu số liệu (FR-59): KHÔNG gộp lỗi thành META_API_ERROR như get() — phân loại theo mã Graph
    // để AnalyticsCollectionJob biết bài đã xoá / thiếu quyền / bị rate limit mà dừng hoặc giãn lịch thử lại.
    private JsonNode getMetrics(String url, Platform platform) {
        log.debug("[Meta] GET {} ({})", mask(url), platform);
        try {
            String raw = webClient.get().uri(encodedUri(url)).retrieve().bodyToMono(String.class).block();
            return parse(raw);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] Thu số liệu lỗi {} {}: {}", platform, e.getStatusCode(), mask(e.getResponseBodyAsString()));
            throw toMetricsException(e);
        } catch (WebClientRequestException e) {
            log.warn("[Meta] Thu số liệu thất bại (network) {}: {}", platform, e.getMessage());
            throw new MetricsFetchException(MetricsErrorType.TEMPORARY, "NETWORK", e.getMessage());
        }
    }

    private MetricsFetchException toMetricsException(WebClientResponseException e) {
        JsonNode error;
        try {
            error = objectMapper.readTree(e.getResponseBodyAsString()).path("error");
        } catch (Exception ignored) {
            error = objectMapper.missingNode(); // body không phải JSON
        }
        int code = error.path("code").asInt(-1);
        int subcode = error.path("error_subcode").asInt(-1);
        String responseCode = code < 0 ? "HTTP_" + e.getStatusCode().value()
                : subcode > 0 ? code + "/" + subcode : String.valueOf(code);
        return new MetricsFetchException(classifyMetricsError(code, subcode), responseCode,
                mask(error.path("message").asText(e.getMessage())));
    }

    // Mã Graph bị giới hạn tần suất: 4 app, 17 user, 32 Page, 613 custom, 80001 Pages BUC, 80002 Instagram BUC.
    private static final Set<Integer> RATE_LIMIT_GRAPH_CODES = Set.of(4, 17, 32, 613, 80001, 80002);

    /** Phân loại lỗi thu số liệu theo mã Graph; mã lạ / không parse được (5xx...) → TEMPORARY. */
    static MetricsErrorType classifyMetricsError(int code, int subcode) {
        if (code == TOKEN_INVALID_CODE || code == 102) {
            return MetricsErrorType.TOKEN_INVALID;
        }
        if (RATE_LIMIT_GRAPH_CODES.contains(code)) {
            return MetricsErrorType.RATE_LIMIT;
        }
        if (code == 10 || (code >= 200 && code <= 299)) {
            return MetricsErrorType.PERMISSION;
        }
        if (code == 100) {
            // 100/33 = "Object ... does not exist, cannot be loaded due to missing permissions" — bài đã xoá
            // (hoặc mất quyền); 100 khác = tham số sai, thường là metric đã bị khai tử.
            return subcode == 33 ? MetricsErrorType.NOT_FOUND : MetricsErrorType.INVALID_REQUEST;
        }
        return MetricsErrorType.TEMPORARY;
    }

    // Graph code 190 = token hết hạn/bị thu hồi → mã riêng để caller (validate) phân biệt với
    // lỗi tạm thời (5xx, rate limit) vốn không được làm đổi trạng thái kết nối.
    private AppException toAppException(WebClientResponseException e) {
        return graphErrorCode(e) == TOKEN_INVALID_CODE
                ? new AppException(ErrorCode.META_TOKEN_INVALID)
                : new AppException(ErrorCode.META_API_ERROR);
    }

    private int graphErrorCode(WebClientResponseException e) {
        try {
            return objectMapper.readTree(e.getResponseBodyAsString()).path("error").path("code").asInt(-1);
        } catch (Exception ignored) {
            return -1; // body không phải JSON
        }
    }

    // POST form cho luồng đăng bài: KHÔNG gộp lỗi thành META_API_ERROR như get/post — parse body lỗi
    // của nền tảng và ném PublishException đã phân loại (FR-35/FR-37) để worker quyết định retry (FR-56).
    private JsonNode postFormForPublish(String url, MultiValueMap<String, String> form, Platform platform) {
        // INFO (không phải debug): endpoint đăng bài là dấu vết duy nhất cho biết đã gọi Meta hay chưa.
        // Token nằm trong form body, không nằm trên URL.
        log.info("[Meta] Đăng bài {}: POST {}", platform, mask(url));
        try {
            String raw = webClient.post().uri(encodedUri(url))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(form))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return parse(raw);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] Đăng bài lỗi {} {}: {}", platform, e.getStatusCode(), mask(e.getResponseBodyAsString()));
            throw toPublishException(e);
        } catch (WebClientRequestException e) {
            // Lỗi mạng không có response (connect/response timeout của Reactor Netty, DNS, connection
            // reset) — tạm thời (FR-56: retry). Lỗi khác (vd body 200 không phải JSON) KHÔNG bị gộp vào
            // đây: để lọt lên worker thành INTERNAL, tránh retry vô ích một lỗi không tự hết.
            log.warn("[Meta] Đăng bài thất bại (network) {}: {}", platform, e.getMessage());
            throw new PublishException(PublishErrorType.TEMPORARY, "NETWORK", e.getMessage(), e);
        }
    }

    static final int TOKEN_INVALID_CODE = 190;

    // Mã lỗi Graph tạm thời: 1/2 (unknown/service), 4/17/32/613 (rate limit), 341 (application limit).
    private static final Set<Integer> TEMPORARY_GRAPH_CODES = Set.of(1, 2, 4, 17, 32, 341, 613);

    /** Body lỗi Graph/Threads: {"error":{message,type,code,error_subcode,...}} — giữ nguyên mã + message gốc (FR-35). */
    private PublishException toPublishException(WebClientResponseException e) {
        JsonNode error = null;
        try {
            error = objectMapper.readTree(e.getResponseBodyAsString()).path("error");
        } catch (Exception ignored) {
            // body không phải JSON — phân loại theo HTTP status bên dưới
        }
        int code = error == null ? -1 : error.path("code").asInt(-1);
        String message = error == null || !error.hasNonNull("message")
                ? "HTTP " + e.getStatusCode().value()
                : error.path("message").asText();
        String responseCode = code >= 0 ? String.valueOf(code) : String.valueOf(e.getStatusCode().value());

        PublishErrorType type = classifyPublishError(e.getStatusCode().is5xxServerError(), code, message);
        return new PublishException(type, responseCode, message);
    }

    // FR-37: policy (368/message chứa "policy") > tạm thời (5xx/rate limit) > còn lại vĩnh viễn
    // (190 token hết hạn, 100 tham số sai, 200-299 thiếu quyền, ...).
    private static PublishErrorType classifyPublishError(boolean serverError, int code, String message) {
        if (code == 368 || (message != null && message.toLowerCase().contains("policy"))) {
            return PublishErrorType.POLICY_VIOLATION;
        }
        if (serverError || TEMPORARY_GRAPH_CODES.contains(code)) {
            return PublishErrorType.TEMPORARY;
        }
        return PublishErrorType.PERMANENT;
    }

    private JsonNode parse(String raw) {
        try {
            return objectMapper.readTree(raw == null ? "{}" : raw);
        } catch (Exception e) {
            throw new AppException(ErrorCode.META_API_ERROR);
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node == null ? null : node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static Long longValue(JsonNode node, String field) {
        JsonNode v = node == null ? null : node.get(field);
        return v == null || v.isNull() ? null : v.asLong();
    }

    // Che token/app secret/proof trong log để tránh lộ thông tin nhạy cảm (NFR-06).
    public static String mask(String value) {
        if (value == null) return null;
        return value
                .replaceAll("(access_token=)[^&\\s\"]+", "$1***")
                .replaceAll("(client_secret=)[^&\\s\"]+", "$1***")
                .replaceAll("(appsecret_proof=)[^&\\s\"]+", "$1***")
                .replaceAll("(fb_exchange_token=)[^&\\s\"]+", "$1***")
                .replaceAll("(\"access_token\"\\s*:\\s*\")[^\"]+", "$1***");
    }
}
