package com.aima.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Hàm redact dùng chung (NFR-06, SEC-03): bí mật/PII bị che, dữ liệu để đối chiếu (id, mã lỗi) giữ nguyên. */
class SensitiveDataRedactorTest {

    @Test
    void masksTokensInQueryStringFormAndJson() {
        String url = SensitiveDataRedactor.redact("https://graph.facebook.com/v25.0/me?access_token=EAABsecret123&fields=id");
        assertFalse(url.contains("EAABsecret123"));
        assertTrue(url.contains("access_token=***"));
        assertTrue(url.contains("fields=id"));

        String form = SensitiveDataRedactor.redact("message=hi&access_token=abc&appsecret_proof=deadbeef&client_secret=s3");
        assertFalse(form.contains("abc&"));
        assertFalse(form.contains("deadbeef"));
        assertFalse(form.contains("=s3"));

        String json = SensitiveDataRedactor.redact("{\"access_token\": \"EAAZtoken\", \"refresh_token\":\"r1\", \"code\":190}");
        assertFalse(json.contains("EAAZtoken"));
        assertFalse(json.contains("r1"));
        assertTrue(json.contains("\"code\":190"), json);
    }

    @Test
    void masksAuthorizationCookieAndJwt() {
        assertEquals("Authorization: ***", SensitiveDataRedactor.redact("Authorization: Bearer abc.def-123"));
        assertFalse(SensitiveDataRedactor.redact("sent bearer xyz123token").contains("xyz123token"));
        assertFalse(SensitiveDataRedactor.redact("Cookie: refresh_token=abc; access=def").contains("def"));
        String jwt = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhQGIuY29tIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ";
        assertFalse(SensitiveDataRedactor.redact("token " + jwt).contains("eyJzdWIi"));
    }

    @Test
    void masksMetaTokensAndLongOpaqueStrings() {
        String fb = "EAAG" + "x".repeat(150);
        String threads = "THAA" + "y".repeat(120);
        String opaque = "z".repeat(80);
        String redacted = SensitiveDataRedactor.redact("t1=" + fb + " t2 " + threads + " t3 " + opaque);
        assertFalse(redacted.contains("xxxxxxxxxx"));
        assertFalse(redacted.contains("yyyyyyyyyy"));
        assertFalse(redacted.contains("zzzzzzzzzz"));
    }

    @Test
    void masksEmailAndVietnamesePhone_keepsIdsAndCodes() {
        String redacted = SensitiveDataRedactor.redact(
                "user owner@aima.vn phone 0912345678 / +84912345678 page 1234567890123456_987 error 190/463");
        assertFalse(redacted.contains("owner@aima.vn"));
        assertTrue(redacted.contains("o***@aima.vn"), redacted);
        assertFalse(redacted.contains("0912345678"));
        assertFalse(redacted.contains("+84912345678"));
        assertTrue(redacted.contains("1234567890123456_987"), "id bài Facebook giữ nguyên để admin đối chiếu");
        assertTrue(redacted.contains("190/463"));
    }

    @Test
    void nullEmptyAndTruncation() {
        assertNull(SensitiveDataRedactor.redact(null));
        assertEquals("", SensitiveDataRedactor.redact(""));
        String cut = SensitiveDataRedactor.redact("a ".repeat(100), 21);
        assertEquals(21, cut.length());
        assertTrue(cut.endsWith("…"));
    }
}
