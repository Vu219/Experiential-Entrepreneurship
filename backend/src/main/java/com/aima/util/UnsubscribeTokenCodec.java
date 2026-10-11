package com.aima.util;

import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;

/**
 * Token huỷ nhận email (không cần đăng nhập): {@code base64url("v1.<userId>.<hếtHạnEpochGiây>") + "." +
 * base64url(HMAC-SHA256(khoá, phầnĐầu))}. Sửa bất kỳ ký tự nào → chữ ký sai ({@code EMAIL_UNSUBSCRIBE_LINK_INVALID});
 * quá hạn → {@code EMAIL_UNSUBSCRIBE_LINK_EXPIRED}. So chữ ký bằng {@link MessageDigest#isEqual} (thời gian hằng).
 * Lớp thuần (khoá + hạn + đồng hồ truyền vào) để test được; bean Spring ở EmailUnsubscribeTokenServiceImpl.
 */
public final class UnsubscribeTokenCodec {

    private static final String VERSION = "v1";
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private final byte[] key;
    private final Duration ttl;
    private final Clock clock;

    public UnsubscribeTokenCodec(byte[] key, Duration ttl, Clock clock) {
        if (key == null || key.length < 16) {
            throw new IllegalArgumentException("Unsubscribe key must be at least 16 bytes");
        }
        this.key = key.clone();
        this.ttl = ttl;
        this.clock = clock;
    }

    public String issue(UUID userId) {
        long expires = clock.instant().plus(ttl).getEpochSecond();
        String payload = B64.encodeToString((VERSION + "." + userId + "." + expires).getBytes(StandardCharsets.UTF_8));
        return payload + "." + B64.encodeToString(sign(payload));
    }

    /** userId của token hợp lệ; sai định dạng / chữ ký → INVALID, quá hạn → EXPIRED. */
    public UUID verify(String token) {
        if (token == null || token.length() > 512) {
            throw new AppException(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID);
        }
        int dot = token.indexOf('.');
        if (dot <= 0 || dot != token.lastIndexOf('.')) {
            throw new AppException(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID);
        }
        String payload = token.substring(0, dot);
        // So CHUỖI chữ ký dạng chuẩn (không giải mã phần do người dùng gửi): base64 bỏ qua bit đệm của ký tự cuối,
        // giải mã rồi so byte sẽ chấp nhận cả token đã bị sửa ký tự cuối.
        byte[] expected = B64.encodeToString(sign(payload)).getBytes(StandardCharsets.US_ASCII);
        byte[] given = token.substring(dot + 1).getBytes(StandardCharsets.US_ASCII);
        String[] parts;
        try {
            parts = new String(B64D.decode(payload), StandardCharsets.UTF_8).split("\\.");
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID);
        }
        if (!MessageDigest.isEqual(expected, given) || parts.length != 3 || !VERSION.equals(parts[0])) {
            throw new AppException(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID);
        }
        try {
            UUID userId = UUID.fromString(parts[1]);
            if (clock.instant().getEpochSecond() > Long.parseLong(parts[2])) {
                throw new AppException(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_EXPIRED);
            }
            return userId;
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.EMAIL_UNSUBSCRIBE_LINK_INVALID);
        }
    }

    private byte[] sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }
}
