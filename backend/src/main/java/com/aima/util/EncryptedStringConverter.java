package com.aima.util;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA converter mã hoá/giải mã trong suốt cho các cột chứa token nhạy cảm.
 *
 * <p>Áp dụng qua {@code @Convert(converter = EncryptedStringConverter.class)} trên field entity.
 * Hibernate tự khởi tạo converter (không qua Spring), nên ta lấy {@link CryptoUtil} qua singleton
 * đã được Spring init lúc startup.</p>
 */
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return CryptoUtil.getInstance().encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return CryptoUtil.getInstance().decrypt(dbData);
    }
}
