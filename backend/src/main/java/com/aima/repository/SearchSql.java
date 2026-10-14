package com.aima.repository;

/**
 * Mảnh SQL native khớp từ khóa KHÔNG DẤU, dùng chung cho {@code GET /content-items?q=} và {@code GET /search}
 * — một chỗ định nghĩa "bài khớp từ khóa" để hai màn hình không lệch nhau.
 *
 * <p>Nội dung bài nằm ở các bản nền tảng ({@code content_versions}), KHÔNG ở {@code content_items.caption/script}
 * (hai cột đó không còn được ghi). Khớp trên caption đã định dạng, câu mở đầu (hook) của kịch bản và hashtag.
 * Hàm {@code aima_unaccent}/{@code aima_script_hook} do Flyway V16 tạo.
 *
 * <p>Tham số {@code :q} là pattern LIKE đã escape và bọc {@code %…%} — dựng bằng
 * {@link com.aima.util.SearchPatterns#contains(String)}; chuỗi rỗng = không lọc.
 */
public final class SearchSql {

    private SearchSql() {
    }

    // Mỗi mảnh tự đệm khoảng trắng hai đầu: text block cắt khoảng trắng cuối dòng nên nối chuỗi dễ dính chữ.

    /** Bản nền tảng alias {@code sv} khớp {@code :q}. */
    public static final String VERSION_TEXT_MATCHES = " " + """
            (lower(aima_unaccent(sv.formatted_caption)) like lower(aima_unaccent(CAST(:q as varchar))) escape '\\'
             or lower(aima_unaccent(aima_script_hook(sv.script))) like lower(aima_unaccent(CAST(:q as varchar))) escape '\\'
             or lower(aima_unaccent(sv.formatted_hashtag)) like lower(aima_unaccent(CAST(:q as varchar))) escape '\\')""" + " ";

    /** Chiến lược alias {@code s} có tên khớp {@code :q}. */
    public static final String STRATEGY_NAME_MATCHES = " " + """
            lower(aima_unaccent(s.name)) like lower(aima_unaccent(CAST(:q as varchar))) escape '\\'""" + " ";

    /** Tài khoản đăng alias {@code pa} có tên khớp {@code :q} (lịch đăng tìm được theo tên Trang/kênh). */
    public static final String ACCOUNT_NAME_MATCHES = " " + """
            lower(aima_unaccent(pa.account_name)) like lower(aima_unaccent(CAST(:q as varchar))) escape '\\'""" + " ";

    /** Bài alias {@code i} có ít nhất một bản nền tảng còn hiệu lực khớp {@code :q}. */
    public static final String CONTENT_ITEM_MATCHES = " " + """
            exists (select 1 from content_versions sv
                    where sv.content_item_id = i.id and sv.deleted_at is null
                      and""" + VERSION_TEXT_MATCHES + ") ";
}
