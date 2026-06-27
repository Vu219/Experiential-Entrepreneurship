package com.aima.connection;

import com.aima.util.CryptoUtil;
import com.aima.util.EncryptedStringConverter;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class EncryptedStringConverterTest {

    @BeforeAll
    static void initCrypto() {
        // Khởi tạo singleton CryptoUtil để converter (do Hibernate tạo) dùng được.
        CryptoUtil.forTesting(Base64.getEncoder().encodeToString(new byte[32]));
    }

    @Test
    void convertToDbThenBack_roundTrips() {
        EncryptedStringConverter converter = new EncryptedStringConverter();
        String token = "page-access-token-xyz";

        String db = converter.convertToDatabaseColumn(token);

        assertNotEquals(token, db);
        assertEquals(token, converter.convertToEntityAttribute(db));
    }

    @Test
    void nullHandledGracefully() {
        EncryptedStringConverter converter = new EncryptedStringConverter();
        assertNull(converter.convertToDatabaseColumn(null));
        assertNull(converter.convertToEntityAttribute(null));
    }
}
