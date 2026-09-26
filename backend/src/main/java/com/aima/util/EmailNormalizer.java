package com.aima.util;

import java.util.Locale;

/**
 * Chuẩn hoá email về một dạng duy nhất (trim + chữ thường) để "1 email = 1 tài khoản"
 * không bị phá bởi khác biệt hoa/thường giữa đăng ký thủ công và Google.
 */
public final class EmailNormalizer {

    private EmailNormalizer() {
    }

    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
