package com.aima.util;

import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Link huỷ nhận email: hợp lệ / hết hạn / bị sửa / sai khoá. */
class UnsubscribeTokenCodecTest {

    static final byte[] KEY = "test-unsubscribe-key-0123456789".getBytes(StandardCharsets.UTF_8);
    static final Instant NOW = Instant.parse("2026-10-11T08:00:00Z");
    static final UUID USER = UUID.fromString("0b6a2a4e-5c4e-4a52-9a0c-6b3f6d1f2a10");

    private static UnsubscribeTokenCodec codecAt(Instant now) {
        return new UnsubscribeTokenCodec(KEY, Duration.ofDays(60), Clock.fixed(now, ZoneOffset.UTC));
    }

    private static ErrorCode errorOf(UnsubscribeTokenCodec codec, String token) {
        return assertThrows(AppException.class, () -> codec.verify(token)).getErrorCode();
    }

    @Test
    void validToken_returnsUser() {
        String token = codecAt(NOW).issue(USER);
        assertEquals(USER, codecAt(NOW.plus(Duration.ofDays(59))).verify(token));
        assertFalse(token.contains(USER.toString()), "token không lộ id dạng chữ trên URL");
    }

    @Test
    void expiredToken_isRejectedAsExpired() {
        String token = codecAt(NOW).issue(USER);
        assertEquals(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_EXPIRED, errorOf(codecAt(NOW.plus(Duration.ofDays(61))), token));
    }

    @Test
    void tamperedPayloadOrSignature_isRejectedAsInvalid() {
        UnsubscribeTokenCodec codec = codecAt(NOW);
        String token = codec.issue(USER);
        String payload = token.substring(0, token.indexOf('.'));
        String signature = token.substring(token.indexOf('.') + 1);

        // Đổi sang user khác nhưng giữ chữ ký cũ.
        String other = new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8)
                .replace(USER.toString(), UUID.randomUUID().toString());
        String forged = Base64.getUrlEncoder().withoutPadding().encodeToString(other.getBytes(StandardCharsets.UTF_8))
                + "." + signature;
        assertEquals(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID, errorOf(codec, forged));

        // Kéo dài hạn dùng nhưng giữ chữ ký cũ.
        String extended = new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8)
                .replaceAll("\\.(\\d+)$", ".99999999999");
        assertEquals(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID, errorOf(codec,
                Base64.getUrlEncoder().withoutPadding().encodeToString(extended.getBytes(StandardCharsets.UTF_8))
                        + "." + signature));

        // Mọi ký tự cuối khác (kể cả chỉ khác bit đệm base64 — giải mã ra cùng byte) đều phải bị từ chối.
        char last = signature.charAt(signature.length() - 1);
        for (char c : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".toCharArray()) {
            if (c == last) continue;
            String bad = payload + "." + signature.substring(0, signature.length() - 1) + c;
            assertEquals(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID, errorOf(codec, bad), "ký tự cuối " + c);
        }
    }

    @Test
    void otherKey_garbageAndMissing_areInvalid() {
        String token = codecAt(NOW).issue(USER);
        UnsubscribeTokenCodec otherKey = new UnsubscribeTokenCodec(
                "another-secret-key-abcdefghijkl".getBytes(StandardCharsets.UTF_8), Duration.ofDays(60),
                Clock.fixed(NOW, ZoneOffset.UTC));
        assertEquals(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID, errorOf(otherKey, token));
        for (String bad : new String[]{null, "", "abc", "a.b.c", "!!!.???", token + "x".repeat(600)}) {
            assertEquals(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID, errorOf(codecAt(NOW), bad), String.valueOf(bad));
        }
    }
}
