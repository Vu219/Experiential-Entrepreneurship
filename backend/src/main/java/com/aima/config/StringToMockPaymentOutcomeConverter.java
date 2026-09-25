package com.aima.config;

import com.aima.enums.MockPaymentOutcome;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

/**
 * Bind {@code @PathVariable MockPaymentOutcome} không phân biệt hoa/thường, đúng tiền lệ
 * {@link StringToPlatformConverter} — controller KHÔNG được tự parse chuỗi (rule #22).
 *
 * <p>Giá trị lạ trả về {@code PAYMENT_MOCK_DISABLED} chứ không phải 500: endpoint này vốn
 * DEV-ONLY, một path variable sai không đáng thành lỗi hệ thống.</p>
 */
@Component
public class StringToMockPaymentOutcomeConverter implements Converter<String, MockPaymentOutcome> {

    @Override
    public MockPaymentOutcome convert(String source) {
        try {
            return MockPaymentOutcome.valueOf(source.toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new AppException(ErrorCode.PAYMENT_MOCK_DISABLED);
        }
    }
}
