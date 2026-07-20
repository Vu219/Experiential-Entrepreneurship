package com.aima.enums;

/**
 * Chế độ gộp thời gian của trang admin "Quản lý doanh thu". Quyết định vừa đơn vị bucket
 * (tham số của {@code date_trunc}) vừa cách suy ra khoảng thời gian mặc định và "kỳ trước"
 * để tính % thay đổi.
 */
public enum RevenueGranularity {

    /** Từng NGÀY trong một tháng (cần {@code year} + {@code month}); kỳ trước = tháng trước. */
    DAY("day"),

    /** 12 THÁNG của một năm (cần {@code year}); kỳ trước = năm trước. */
    MONTH("month"),

    /** 6 THÁNG của một nửa năm (cần {@code year} + {@code half} 1|2); kỳ trước = nửa năm trước. */
    HALF_YEAR("month"),

    /** Từng NĂM trong khoảng năm (cần {@code fromYear} + {@code toYear}); kỳ trước = khoảng năm liền trước cùng độ dài. */
    YEAR("year"),

    /** Khoảng ngày tuỳ chọn (cần {@code from} + {@code to}); bucket theo ngày, kỳ trước = khoảng liền trước cùng độ dài. */
    CUSTOM("day");

    /** Đơn vị truyền vào {@code date_trunc(?, ...)} của PostgreSQL. */
    private final String truncUnit;

    RevenueGranularity(String truncUnit) {
        this.truncUnit = truncUnit;
    }

    public String getTruncUnit() {
        return truncUnit;
    }
}
