package com.aima.util;

import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Xác thực {@code signed_request} Meta gửi tới Data Deletion Callback / Deauthorize Callback.
 *
 * <p>Định dạng: {@code base64url(chữ ký) + "." + base64url(payload JSON)}; chữ ký là
 * HMAC-SHA256(app secret, phần payload ĐÃ mã hoá base64url). So sánh constant-time
 * ({@link MessageDigest#isEqual}) để không lộ thông tin qua thời gian phản hồi.</p>
 */
public final class MetaSignedRequest {

    private static final String ALGORITHM = "HMAC-SHA256";

    private MetaSignedRequest() {
    }

    /** Trả về {@code user_id} (app-scoped) trong payload; mọi sai lệch → {@code INVALID_SIGNED_REQUEST}. */
    public static String verifyAndGetUserId(String signedRequest, String appSecret, ObjectMapper objectMapper) {
        if (!StringUtils.hasText(signedRequest) || !StringUtils.hasText(appSecret)) {
            throw new AppException(ErrorCode.INVALID_SIGNED_REQUEST);
        }
        String[] parts = signedRequest.split("\\.", 2);
        if (parts.length != 2 || parts[0].isEmpty() || parts[1].isEmpty()) {
            throw new AppException(ErrorCode.INVALID_SIGNED_REQUEST);
        }
        try {
            byte[] signature = Base64.getUrlDecoder().decode(parts[0]);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(parts[1].getBytes(StandardCharsets.UTF_8));
            if (!MessageDigest.isEqual(expected, signature)) {
                throw new AppException(ErrorCode.INVALID_SIGNED_REQUEST);
            }

            JsonNode payload = objectMapper.readTree(Base64.getUrlDecoder().decode(parts[1]));
            String userId = payload.path("user_id").asText("");
            if (!ALGORITHM.equalsIgnoreCase(payload.path("algorithm").asText("")) || userId.isBlank()) {
                throw new AppException(ErrorCode.INVALID_SIGNED_REQUEST);
            }
            return userId;
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            // base64 hỏng / JSON hỏng — không phân biệt với sai chữ ký cho bên gọi.
            throw new AppException(ErrorCode.INVALID_SIGNED_REQUEST);
        }
    }
}
