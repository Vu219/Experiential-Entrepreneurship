package com.aima.service.Impl;

import com.aima.config.MetaProperties;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
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
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
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
        String version = versionService.getCurrentVersion(platform);
        String url = withProof(UriComponentsBuilder.fromUriString(metaProperties.graphBaseUrl())
                .pathSegment(version, "me", "permissions")
                .queryParam("access_token", token), token, platform)
                .toUriString();
        try {
            webClient.delete().uri(url).retrieve().bodyToMono(JsonNode.class).block();
            log.info("[Meta] Đã revoke token (đã mask) trên {}", platform);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] Revoke token thất bại trên {}: {}", platform, e.getStatusCode());
        }
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

    private JsonNode get(String url, Platform platform) {
        log.debug("[Meta] GET {} ({})", mask(url), platform);
        try {
            String raw = webClient.get().uri(url).retrieve().bodyToMono(String.class).block();
            return parse(raw);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] GET lỗi {} {}: {}", platform, e.getStatusCode(), mask(e.getResponseBodyAsString()));
            throw new AppException(ErrorCode.META_API_ERROR);
        }
    }

    private JsonNode post(String url, Platform platform) {
        log.debug("[Meta] POST {} ({})", mask(url), platform);
        try {
            String raw = webClient.post().uri(url).retrieve().bodyToMono(String.class).block();
            return parse(raw);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] POST lỗi {} {}: {}", platform, e.getStatusCode(), mask(e.getResponseBodyAsString()));
            throw new AppException(ErrorCode.META_API_ERROR);
        }
    }

    // POST form cho luồng đăng bài: KHÔNG gộp lỗi thành META_API_ERROR như get/post — parse body lỗi
    // của nền tảng và ném PublishException đã phân loại (FR-35/FR-37) để worker quyết định retry (FR-56).
    private JsonNode postFormForPublish(String url, MultiValueMap<String, String> form, Platform platform) {
        log.debug("[Meta] POST(form) {} ({})", mask(url), platform);
        try {
            String raw = webClient.post().uri(url)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(form))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return parse(raw);
        } catch (WebClientResponseException e) {
            log.warn("[Meta] Đăng bài lỗi {} {}: {}", platform, e.getStatusCode(), mask(e.getResponseBodyAsString()));
            throw toPublishException(e);
        } catch (PublishException e) {
            throw e;
        } catch (Exception e) {
            // Lỗi mạng/timeout không có response — coi là tạm thời (FR-56: retry).
            log.warn("[Meta] Đăng bài thất bại (network) {}: {}", platform, e.getMessage());
            throw new PublishException(PublishErrorType.TEMPORARY, "NETWORK", e.getMessage());
        }
    }

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
