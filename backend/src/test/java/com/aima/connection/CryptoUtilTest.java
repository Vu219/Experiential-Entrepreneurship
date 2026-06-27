package com.aima.connection;

import com.aima.util.CryptoUtil;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class CryptoUtilTest {

    private static final String VALID_KEY = Base64.getEncoder().encodeToString(new byte[32]);

    @Test
    void encryptThenDecrypt_roundTrips() {
        CryptoUtil util = CryptoUtil.forTesting(VALID_KEY);
        String plain = "EAAB-super-secret-token-12345";

        String encrypted = util.encrypt(plain);

        assertNotNull(encrypted);
        assertNotEquals(plain, encrypted, "Ciphertext không được trùng plaintext");
        assertEquals(plain, util.decrypt(encrypted));
    }

    @Test
    void encrypt_producesDifferentCiphertextEachTime_dueToRandomIv() {
        CryptoUtil util = CryptoUtil.forTesting(VALID_KEY);

        String a = util.encrypt("same");
        String b = util.encrypt("same");

        assertNotEquals(a, b, "IV ngẫu nhiên phải tạo ciphertext khác nhau");
        assertEquals("same", util.decrypt(a));
        assertEquals("same", util.decrypt(b));
    }

    @Test
    void nullValues_passThrough() {
        CryptoUtil util = CryptoUtil.forTesting(VALID_KEY);
        assertNull(util.encrypt(null));
        assertNull(util.decrypt(null));
    }

    @Test
    void missingKey_failsFast() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> CryptoUtil.forTesting(""));
        assertTrue(ex.getMessage().contains("AIMA_ENCRYPTION_KEY"));
    }

    @Test
    void wrongKeyLength_failsFast() {
        String shortKey = Base64.getEncoder().encodeToString(new byte[16]);
        assertThrows(IllegalStateException.class, () -> CryptoUtil.forTesting(shortKey));
    }

    @Test
    void invalidBase64_failsFast() {
        assertThrows(IllegalStateException.class, () -> CryptoUtil.forTesting("not-base64!!!"));
    }
}
