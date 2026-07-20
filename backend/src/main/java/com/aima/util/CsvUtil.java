package com.aima.util;

/**
 * Escape ô CSV dùng chung cho các endpoint export (nhật ký usage, log hoạt động).
 * Tách ra util vì đã có từ 2 nơi dùng trở lên (rule #23) — đừng chép lại vào service mới.
 */
public final class CsvUtil {

    private CsvUtil() {
    }

    /** Escape CSV chuẩn: bọc ngoặc kép khi chứa dấu phẩy/ngoặc/xuống dòng; null → chuỗi rỗng. */
    public static String field(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return '"' + value.replace("\"", "\"\"") + '"';
        }
        return value;
    }

    /** Giá trị có thể null trong ô CSV — null thành rỗng thay vì chuỗi "null". */
    public static String nullToEmpty(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
