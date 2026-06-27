package com.aima.connection;

import com.aima.config.MetaProperties;
import com.aima.enums.Platform;
import com.aima.service.MetaApiClient;
import com.aima.service.Impl.MetaApiClientImpl;
import com.aima.service.PlatformVersionService;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

class MetaApiClientImplTest {

    private MockWebServer server;
    private MetaApiClientImpl client;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        String base = server.url("/").toString().replaceAll("/$", "");

        MetaProperties props = new MetaProperties(
                new MetaProperties.App("fbid", "fbsecret", "http://localhost/cb", "scope"),
                new MetaProperties.App("thid", "thsecret", "http://localhost/thcb", "thscope"),
                base, base, false);

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
}
