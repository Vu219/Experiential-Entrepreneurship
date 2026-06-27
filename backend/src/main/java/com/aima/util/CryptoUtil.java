package com.aima.util;

import jakarta.annotation.PostConstruct;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Mã hoá/giải mã chuỗi nhạy cảm (social access/refresh token) bằng AES-256-GCM.
 *
 * <p>Key đọc từ env {@code AIMA_ENCRYPTION_KEY} — 32 byte mã hoá base64
 * (sinh bằng {@code openssl rand -base64 32}). App sẽ fail ngay khi khởi động nếu
 * key thiếu hoặc sai format (SEC-03) thay vì lỗi mơ hồ lúc runtime.</p>
 *
 * <p>Định dạng ciphertext lưu DB: base64( IV(12 byte) || ciphertext+tag ).</p>
 */
@Component
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CryptoUtil {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;          // 96-bit IV khuyến nghị cho GCM
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int AES_256_KEY_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${aima.encryption.key:}")
    String base64Key;

    private SecretKeySpec keySpec;

    // Singleton instance để JPA AttributeConverter (do Hibernate khởi tạo, không qua Spring) dùng được.
    private static volatile CryptoUtil instance;

    @PostConstruct
    void init() {
        if (base64Key == null || base64Key.isBlank()) {
            throw new IllegalStateException(
                    "AIMA_ENCRYPTION_KEY chưa được cấu hình. Sinh key: `openssl rand -base64 32` và set vào env.");
        }
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(base64Key.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("AIMA_ENCRYPTION_KEY không phải base64 hợp lệ.", e);
        }
        if (keyBytes.length != AES_256_KEY_BYTES) {
            throw new IllegalStateException(
                    "AIMA_ENCRYPTION_KEY phải là 32 byte (256-bit) sau khi decode base64, hiện có "
                            + keyBytes.length + " byte. Dùng `openssl rand -base64 32`.");
        }
        this.keySpec = new SecretKeySpec(keyBytes, "AES");
        instance = this;
        log.info("CryptoUtil đã khởi tạo (AES-256-GCM).");
    }

    /** Cho JPA converter truy cập instance đã được Spring khởi tạo. */
    static CryptoUtil getInstance() {
        CryptoUtil ref = instance;
        if (ref == null) {
            throw new IllegalStateException("CryptoUtil chưa sẵn sàng (Spring context chưa khởi tạo bean).");
        }
        return ref;
    }

    public String encrypt(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(cipherText, 0, combined, iv.length, cipherText.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("Mã hoá dữ liệu thất bại", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null) {
            return null;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(stored);
            byte[] iv = new byte[IV_LENGTH];
            byte[] cipherText = new byte[combined.length - IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
            System.arraycopy(combined, IV_LENGTH, cipherText, 0, cipherText.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Giải mã dữ liệu thất bại", e);
        }
    }

    // Dùng cho unit test: tạo instance với key cho trước, không qua Spring lifecycle.
    public static CryptoUtil forTesting(String base64Key) {
        CryptoUtil util = new CryptoUtil();
        util.base64Key = base64Key;
        util.init();
        return util;
    }
}
