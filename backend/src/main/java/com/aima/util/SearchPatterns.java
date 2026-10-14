package com.aima.util;

/**
 * Dựng pattern LIKE "chứa chuỗi" cho các truy vấn tìm kiếm ({@link com.aima.repository.SearchSql}).
 * Escape {@code \ % _} (ESCAPE '\') để ký tự người dùng gõ được so khớp nguyên văn, không thành wildcard.
 * Bỏ dấu + chữ thường làm ở phía SQL ({@code aima_unaccent}) cho cả cột lẫn pattern.
 */
public final class SearchPatterns {

    private SearchPatterns() {
    }

    /** {@code null}/rỗng → {@code ""} (sentinel "không lọc" của các query); còn lại → {@code %từ-khóa-đã-escape%}. */
    public static String contains(String q) {
        if (q == null || q.isBlank()) {
            return "";
        }
        String escaped = q.trim()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
