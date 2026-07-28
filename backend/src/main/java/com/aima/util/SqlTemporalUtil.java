package com.aima.util;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Ép kiểu ngày/giờ lấy từ native query trả {@code Object[]} (projection KHÔNG kiểu).
 *
 * <p>Vì sao cần: với native query không có entity/DTO mapping, Hibernate tự suy kiểu Java của
 * từng cột. Hibernate 6/7 ưu tiên {@code java.time} nên cột SQL {@code DATE}/{@code TIMESTAMP}
 * về tay ta là {@link LocalDate}/{@link LocalDateTime}, KHÔNG phải {@link Date}/{@link Timestamp}
 * như thời JDBC thuần. Cast thẳng sang kiểu {@code java.sql.*} sẽ ném ClassCastException ngay
 * dòng dữ liệu đầu tiên — và chỉ lộ ra khi kỳ đang xem CÓ dữ liệu, nên rất dễ lọt kiểm thử.
 *
 * <p>Hai hàm dưới nhận cả hai dạng để không phụ thuộc phiên bản Hibernate/driver.
 * Tách ra util vì đã có từ 2 nơi dùng trở lên (rule #23) — đừng chép lại vào service mới.
 */
public final class SqlTemporalUtil {

    private SqlTemporalUtil() {
    }

    /** Cột SQL {@code DATE} từ native query → {@link LocalDate}; null giữ nguyên null. */
    public static LocalDate toLocalDate(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime().toLocalDate();
        }
        throw new IllegalArgumentException("Không đọc được giá trị ngày từ native query: " + value.getClass());
    }

    /** Cột SQL {@code TIMESTAMP} từ native query → {@link LocalDateTime}; null giữ nguyên null. */
    public static LocalDateTime toLocalDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        if (value instanceof LocalDate localDate) {
            return localDate.atStartOfDay();
        }
        throw new IllegalArgumentException("Không đọc được giá trị thời gian từ native query: " + value.getClass());
    }
}
