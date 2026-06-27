package com.aima.service.Impl;

import com.aima.config.MetaProperties;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformVersionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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
                .queryParam("fields", "id,name")
                .queryParam("access_token", token), token, platform)
                .toUriString();
        JsonNode body = get(url, platform);
        return new MetaUser(text(body, "id"), text(body, "name"), null, null);
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
