package com.aima.config;

import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

// giup chuyển chuỗi trong request thành enum Platform
@Component
public class StringToPlatformConverter implements Converter<String, Platform> {

    @Override
    public Platform convert(String source) {
        try {
            return Platform.valueOf(source.toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new AppException(ErrorCode.INVALID_PLATFORM);
        }
    }
}
