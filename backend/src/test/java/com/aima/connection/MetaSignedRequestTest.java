package com.aima.connection;

import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.util.MetaSignedRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MetaSignedRequestTest {

    private static final String SECRET = "test-app-secret";
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Dựng signed_request đúng cách Meta làm: base64url(HMAC(secret, payloadB64)) + "." + payloadB64. */
    static String sign(String payloadJson, String secret) throws Exception {
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
        String payload = enc.encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String sig = enc.encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        return sig + "." + payload;
    }

    private static final String PAYLOAD = "{\"algorithm\":\"HMAC-SHA256\",\"issued_at\":1727400000,\"user_id\":\"1234567890\"}";

    private void assertInvalid(String signedRequest, String secret) {
        AppException ex = assertThrows(AppException.class,
                () -> MetaSignedRequest.verifyAndGetUserId(signedRequest, secret, objectMapper));
        assertEquals(ErrorCode.INVALID_SIGNED_REQUEST, ex.getErrorCode());
    }

    @Test
    void validSignature_returnsUserId() throws Exception {
        assertEquals("1234567890", MetaSignedRequest.verifyAndGetUserId(sign(PAYLOAD, SECRET), SECRET, objectMapper));
    }

    @Test
    void wrongSecret_rejected() throws Exception {
        assertInvalid(sign(PAYLOAD, "another-secret"), SECRET);
    }

    @Test
    void tamperedPayload_rejected() throws Exception {
        String signed = sign(PAYLOAD, SECRET);
        String forgedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"algorithm\":\"HMAC-SHA256\",\"user_id\":\"999\"}".getBytes(StandardCharsets.UTF_8));
        assertInvalid(signed.substring(0, signed.indexOf('.') + 1) + forgedPayload, SECRET);
    }

    @Test
    void unexpectedAlgorithm_rejected() throws Exception {
        assertInvalid(sign("{\"algorithm\":\"NONE\",\"user_id\":\"1\"}", SECRET), SECRET);
    }

    @Test
    void missingUserId_rejected() throws Exception {
        assertInvalid(sign("{\"algorithm\":\"HMAC-SHA256\"}", SECRET), SECRET);
    }

    @Test
    void malformedOrMissingInputs_rejected() {
        assertInvalid("no-dot-here", SECRET);
        assertInvalid(".onlypayload", SECRET);
        assertInvalid("!!!.@@@", SECRET);
        assertInvalid(null, SECRET);
        assertInvalid("abc.def", "");
    }
}
