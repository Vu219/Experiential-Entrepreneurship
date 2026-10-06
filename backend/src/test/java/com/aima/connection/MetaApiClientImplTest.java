package com.aima.connection;

import com.aima.config.MetaProperties;
import com.aima.enums.Platform;
import com.aima.service.MetaApiClient;
import com.aima.service.Impl.MetaApiClientImpl;
import com.aima.service.PlatformVersionService;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okhttp3.mockwebserver.SocketPolicy;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

@ExtendWith(OutputCaptureExtension.class)
class MetaApiClientImplTest {

    private MockWebServer server;
    private MetaApiClientImpl client;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        String base = server.url("/").toString().replaceAll("/$", "");

        MetaProperties props = new MetaProperties(
                new MetaProperties.App("fbid", "fbsecret", "http://localhost/cb", "scope", null),
                new MetaProperties.App("thid", "thsecret", "http://localhost/thcb", "thscope", null),
                base, base, false, new MetaProperties.Webhook("verify-token"));

        PlatformVersionService versionService = mock(PlatformVersionService.class);
        lenient().when(versionService.getCurrentVersion(Platform.FACEBOOK)).thenReturn("v25.0");
        lenient().when(versionService.getCurrentVersion(Platform.THREADS)).thenReturn("v1.0");

        client = new MetaApiClientImpl(
                org.springframework.web.reactive.function.client.WebClient.builder().build(),
                props, versionService, new com.fasterxml.jackson.databind.ObjectMapper());
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    private MockResponse json(String body) {
        return new MockResponse().setBody(body).addHeader("Content-Type", "application/json");
    }

    @Test
    void exchangeCodeForToken_parsesAccessTokenAndExpiry() {
        server.enqueue(json("{\"access_token\":\"short-token\",\"expires_in\":3600}"));

        MetaApiClient.MetaTokenResult result = client.exchangeCodeForToken(Platform.FACEBOOK, "the-code");

        assertEquals("short-token", result.accessToken());
        assertEquals(3600L, result.expiresInSeconds());
    }

    @Test
    void getMyAccounts_parsesPageList() {
        server.enqueue(json("{\"data\":[" +
                "{\"id\":\"100\",\"name\":\"My Page\",\"access_token\":\"page-tok\",\"category\":\"Brand\"}]}"));

        List<MetaApiClient.MetaPage> pages = client.getMyAccounts("user-token");

        assertEquals(1, pages.size());
        assertEquals("100", pages.get(0).id());
        assertEquals("My Page", pages.get(0).name());
        assertEquals("page-tok", pages.get(0).accessToken());
    }

    @Test
    void getGrantedPermissions_keepsOnlyGranted() throws InterruptedException {
        server.enqueue(json("{\"data\":[" +
                "{\"permission\":\"pages_show_list\",\"status\":\"granted\"}," +
                "{\"permission\":\"pages_manage_posts\",\"status\":\"declined\"}," +
                "{\"permission\":\"public_profile\",\"status\":\"granted\"}]}"));

        List<String> granted = client.getGrantedPermissions("user-token");

        assertEquals(List.of("pages_show_list", "public_profile"), granted);
        assertTrue(server.takeRequest().getPath().startsWith("/v25.0/me/permissions"));
    }

    @Test
    void getInstagramBusinessAccount_emptyWhenAbsent() {
        server.enqueue(json("{\"id\":\"100\"}"));

        Optional<MetaApiClient.MetaIgAccount> ig = client.getInstagramBusinessAccount("100", "page-tok");

        assertTrue(ig.isEmpty());
    }

    @Test
    void getInstagramBusinessAccount_presentWhenLinked() {
        server.enqueue(json("{\"instagram_business_account\":" +
                "{\"id\":\"ig1\",\"username\":\"brand\",\"name\":\"Brand IG\",\"profile_picture_url\":\"http://img\"}}"));

        Optional<MetaApiClient.MetaIgAccount> ig = client.getInstagramBusinessAccount("100", "page-tok");

        assertTrue(ig.isPresent());
        assertEquals("ig1", ig.get().id());
        assertEquals("brand", ig.get().username());
    }

    @Test
    void getMe_facebook_buildsGraphAvatarUrlWhenRealPicture() {
        server.enqueue(json("{\"id\":\"123\",\"name\":\"John\"," +
                "\"picture\":{\"data\":{\"url\":\"http://lookaside/x\",\"is_silhouette\":false}}}"));

        MetaApiClient.MetaUser me = client.getMe(Platform.FACEBOOK, "user-token");

        assertEquals("123", me.id());
        assertEquals("John", me.name());
        assertTrue(me.pictureUrl().endsWith("/123/picture?type=large"));
    }

    @Test
    void getMe_facebook_nullAvatarWhenSilhouette() {
        server.enqueue(json("{\"id\":\"123\",\"name\":\"John\"," +
                "\"picture\":{\"data\":{\"url\":\"http://lookaside/x\",\"is_silhouette\":true}}}"));

        MetaApiClient.MetaUser me = client.getMe(Platform.FACEBOOK, "user-token");

        assertNull(me.pictureUrl());
    }

    @Test
    void generateAppSecretProof_isDeterministicHex() {
        String proof = client.generateAppSecretProof("token", "secret");
        assertEquals(64, proof.length()); // HMAC-SHA256 hex = 64 chars
        assertEquals(proof, client.generateAppSecretProof("token", "secret"));
    }

    @Test
    void maskHidesToken() {
        String masked = MetaApiClientImpl.mask("https://x/me?access_token=SECRET123&fields=id");
        assertFalse(masked.contains("SECRET123"));
        assertTrue(masked.contains("access_token=***"));
    }

    @Test
    void getMe_graphCode190_throwsTokenInvalid() {
        server.enqueue(new MockResponse().setResponseCode(400).addHeader("Content-Type", "application/json")
                .setBody("{\"error\":{\"message\":\"Error validating access token\",\"type\":\"OAuthException\",\"code\":190}}"));

        com.aima.exception.AppException ex = assertThrows(com.aima.exception.AppException.class,
                () -> client.getMe(Platform.FACEBOOK, "expired-token"));
        assertEquals(com.aima.exception.ErrorCode.META_TOKEN_INVALID, ex.getErrorCode());
    }

    @Test
    void getMe_serverError_throwsGenericMetaError() {
        server.enqueue(new MockResponse().setResponseCode(500).setBody("oops"));

        com.aima.exception.AppException ex = assertThrows(com.aima.exception.AppException.class,
                () -> client.getMe(Platform.FACEBOOK, "token"));
        assertEquals(com.aima.exception.ErrorCode.META_API_ERROR, ex.getErrorCode());
    }

    // ---------- revokeToken: best-effort, không bao giờ ném lỗi ----------

    @Test
    void revokeToken_graphCode190_doesNotThrow() {
        server.enqueue(json("{\"error\":{\"message\":\"Error validating access token\",\"code\":190}}")
                .setResponseCode(400));

        assertDoesNotThrow(() -> client.revokeToken(Platform.FACEBOOK, "expired-token"));
    }

    @Test
    void revokeToken_serverError_doesNotThrow() {
        server.enqueue(new MockResponse().setResponseCode(500).setBody("oops"));

        assertDoesNotThrow(() -> client.revokeToken(Platform.FACEBOOK, "tok"));
    }

    @Test
    void revokeToken_success_readsBodyWithoutTypeError(CapturedOutput output) throws InterruptedException {
        server.enqueue(json("{\"success\":true}"));

        client.revokeToken(Platform.FACEBOOK, "tok");

        RecordedRequest request = server.takeRequest(5, TimeUnit.SECONDS);
        assertEquals("DELETE", request.getMethod());
        assertEquals("/v25.0/me/permissions", request.getRequestUrl().encodedPath());
        // Trước khi sửa: bodyToMono(Jackson 2 JsonNode) → "Type definition error" bị nuốt thành WARN.
        assertTrue(output.getOut().contains("Đã revoke token"), "revoke 200 phải đi nhánh thành công");
        assertFalse(output.getOut().contains("Revoke token thất bại"));
    }

    // ---------- URL gửi đi: encode ĐÚNG MỘT lần (field lồng nhau có {} ( ) , .) ----------

    @Test
    void getInstagramBusinessAccount_nestedFieldsEncodedExactlyOnce() throws InterruptedException {
        server.enqueue(json("{\"id\":\"100\"}"));

        client.getInstagramBusinessAccount("100", "page-tok");

        RecordedRequest request = server.takeRequest(5, TimeUnit.SECONDS);
        assertEquals("/v25.0/100", request.getRequestUrl().encodedPath());
        assertEquals("instagram_business_account{id,username,name,profile_picture_url}",
                request.getRequestUrl().queryParameter("fields"));
        assertFalse(request.getPath().contains("%25"), "bị encode 2 lần: " + request.getPath());
        assertEquals("page-tok", request.getRequestUrl().queryParameter("access_token"));
    }

    @Test
    void getMe_facebook_pictureFieldEncodedExactlyOnce() throws InterruptedException {
        server.enqueue(json("{\"id\":\"42\",\"name\":\"User\"}"));

        client.getMe(Platform.FACEBOOK, "user-tok");

        RecordedRequest request = server.takeRequest(5, TimeUnit.SECONDS);
        assertEquals("id,name,picture.width(200).height(200)", request.getRequestUrl().queryParameter("fields"));
        assertFalse(request.getPath().contains("%25"), request.getPath());
    }

    @Test
    void getPostMetrics_facebook_summaryFieldsAndMetricEncodedExactlyOnce() throws InterruptedException {
        server.enqueue(json("{\"reactions\":{\"summary\":{\"total_count\":3}}}"));
        server.enqueue(json("{\"data\":[{\"name\":\"post_media_view\",\"values\":[{\"value\":10}]}]}"));

        client.getPostMetrics(Platform.FACEBOOK, "100_200", "page-tok");

        RecordedRequest fields = server.takeRequest(5, TimeUnit.SECONDS);
        assertEquals("reactions.summary(total_count).limit(0),comments.summary(true).limit(0),shares",
                fields.getRequestUrl().queryParameter("fields"));
        RecordedRequest insights = server.takeRequest(5, TimeUnit.SECONDS);
        assertEquals("/v25.0/100_200/insights", insights.getRequestUrl().encodedPath());
        assertEquals("post_media_view", insights.getRequestUrl().queryParameter("metric"));
        assertFalse(fields.getPath().contains("%25") || insights.getPath().contains("%25"));
    }

    // ---------- getPostMetrics: số liệu + phân loại lỗi (analytics giai đoạn 0) ----------

    private MockResponse graphError(int status, int code, Integer subcode) {
        String sub = subcode == null ? "" : ",\"error_subcode\":" + subcode;
        return new MockResponse().setResponseCode(status).addHeader("Content-Type", "application/json")
                .setBody("{\"error\":{\"message\":\"boom\",\"type\":\"OAuthException\",\"code\":" + code + sub + "}}");
    }

    @Test
    void getPostMetrics_facebook_reactionsCountAllEmotionsAndViewsFromPostMediaView() {
        server.enqueue(json("{\"reactions\":{\"data\":[],\"summary\":{\"total_count\":42}},"
                + "\"comments\":{\"data\":[],\"summary\":{\"total_count\":7}},\"shares\":{\"count\":3}}"));
        server.enqueue(json("{\"data\":[{\"name\":\"post_media_view\",\"period\":\"lifetime\",\"values\":[{\"value\":1500}]}]}"));

        MetaApiClient.MetaPostMetrics m = client.getPostMetrics(Platform.FACEBOOK, "100_200", "page-tok");

        assertEquals(1500L, m.views());
        assertEquals(42L, m.likes(), "likes của FB = tổng mọi cảm xúc");
        assertEquals(7L, m.comments());
        assertEquals(3L, m.shares());
        assertNull(m.saves());
    }

    @Test
    void getPostMetrics_facebook_missingReadInsights_viewsNullButInteractionsKept() {
        server.enqueue(json("{\"reactions\":{\"summary\":{\"total_count\":5}},\"comments\":{\"summary\":{\"total_count\":1}}}"));
        server.enqueue(graphError(400, 10, null));

        MetaApiClient.MetaPostMetrics m = client.getPostMetrics(Platform.FACEBOOK, "100_200", "page-tok");

        assertNull(m.views());
        assertEquals(5L, m.likes());
        assertEquals(1L, m.comments());
        assertEquals(0L, m.shares(), "bài chưa ai chia sẻ thì Graph bỏ trường shares");
    }

    @Test
    void getPostMetrics_facebook_deprecatedMetricRejected_viewsNull() {
        server.enqueue(json("{\"reactions\":{\"summary\":{\"total_count\":5}}}"));
        server.enqueue(graphError(400, 100, null)); // "(#100) The value must be a valid insights metric"

        assertNull(client.getPostMetrics(Platform.FACEBOOK, "100_200", "page-tok").views());
    }

    @Test
    void getPostMetrics_facebook_insightsRateLimited_throwsInsteadOfSavingPartialSnapshot() {
        server.enqueue(json("{\"reactions\":{\"summary\":{\"total_count\":5}}}"));
        server.enqueue(graphError(400, 4, null));

        com.aima.exception.MetricsFetchException ex = assertThrows(com.aima.exception.MetricsFetchException.class,
                () -> client.getPostMetrics(Platform.FACEBOOK, "100_200", "page-tok"));
        assertEquals(com.aima.enums.MetricsErrorType.RATE_LIMIT, ex.getErrorType());
    }

    @Test
    void getPostMetrics_facebook_deletedPost_notFoundWithOriginalCode() {
        server.enqueue(graphError(400, 100, 33));

        com.aima.exception.MetricsFetchException ex = assertThrows(com.aima.exception.MetricsFetchException.class,
                () -> client.getPostMetrics(Platform.FACEBOOK, "100_200", "page-tok"));
        assertEquals(com.aima.enums.MetricsErrorType.NOT_FOUND, ex.getErrorType());
        assertEquals("100/33", ex.getResponseCode());
    }

    @Test
    void getPostMetrics_facebook_classifiesTokenRateLimitPermissionAndServerErrors() {
        Object[][] cases = {
                {graphError(400, 190, 463), com.aima.enums.MetricsErrorType.TOKEN_INVALID, "190/463"},
                {graphError(400, 80001, null), com.aima.enums.MetricsErrorType.RATE_LIMIT, "80001"},
                {graphError(400, 17, null), com.aima.enums.MetricsErrorType.RATE_LIMIT, "17"},
                {graphError(403, 200, null), com.aima.enums.MetricsErrorType.PERMISSION, "200"},
                {new MockResponse().setResponseCode(503).setBody("down"), com.aima.enums.MetricsErrorType.TEMPORARY, "HTTP_503"},
        };
        for (Object[] c : cases) {
            server.enqueue((MockResponse) c[0]);
            com.aima.exception.MetricsFetchException ex = assertThrows(com.aima.exception.MetricsFetchException.class,
                    () -> client.getPostMetrics(Platform.FACEBOOK, "100_200", "page-tok"));
            assertEquals(c[1], ex.getErrorType(), String.valueOf(c[2]));
            assertEquals(c[2], ex.getResponseCode());
        }
    }

    @Test
    void getPostMetrics_instagram_unsupported() {
        com.aima.exception.MetricsFetchException ex = assertThrows(com.aima.exception.MetricsFetchException.class,
                () -> client.getPostMetrics(Platform.INSTAGRAM, "1789", "tok"));
        assertEquals(com.aima.enums.MetricsErrorType.UNSUPPORTED, ex.getErrorType());
        assertEquals(0, server.getRequestCount(), "không gọi Meta cho nền tảng chưa hỗ trợ");
    }

    @Test
    void appSecretProof_andAccessToken_survivedSingleEncoding() throws InterruptedException {
        // Token có ký tự phải encode ('|', '+') để chứng minh giá trị tới Meta khớp NGUYÊN VĂN.
        String token = "EAAB|a+b/c";
        MetaProperties props = new MetaProperties(
                new MetaProperties.App("fbid", "fbsecret", "http://localhost/cb", "scope", null),
                new MetaProperties.App("thid", "thsecret", "http://localhost/thcb", "thscope", null),
                server.url("/").toString().replaceAll("/$", ""), server.url("/").toString().replaceAll("/$", ""),
                true, new MetaProperties.Webhook("verify-token"));
        PlatformVersionService versionService = mock(PlatformVersionService.class);
        lenient().when(versionService.getCurrentVersion(Platform.FACEBOOK)).thenReturn("v25.0");
        MetaApiClientImpl proofClient = new MetaApiClientImpl(
                org.springframework.web.reactive.function.client.WebClient.builder().build(),
                props, versionService, new com.fasterxml.jackson.databind.ObjectMapper());
        server.enqueue(json("{\"id\":\"100\"}"));

        proofClient.getInstagramBusinessAccount("100", token);

        RecordedRequest request = server.takeRequest(5, TimeUnit.SECONDS);
        assertEquals(token, request.getRequestUrl().queryParameter("access_token"));
        assertEquals(proofClient.generateAppSecretProof(token, "fbsecret"),
                request.getRequestUrl().queryParameter("appsecret_proof"));
        assertEquals("instagram_business_account{id,username,name,profile_picture_url}",
                request.getRequestUrl().queryParameter("fields"));
    }

    @Test
    void revokeToken_slowMeta_givesUpAfterShortTimeout() {
        server.enqueue(new MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE)); // Meta treo, không bao giờ trả lời

        long start = System.nanoTime();
        assertDoesNotThrow(() -> client.revokeToken(Platform.FACEBOOK, "tok"));
        long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);

        assertTrue(elapsedMs < 10_000, "revoke phải bỏ cuộc sau ~5s, thực tế " + elapsedMs + "ms");
    }
}
