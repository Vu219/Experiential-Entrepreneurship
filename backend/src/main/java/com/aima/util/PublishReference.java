package com.aima.util;

import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Mã tham chiếu người dùng gửi cho hỗ trợ khi đăng bài lỗi, vd {@code ERR-3F9A1C}.
 *
 * <p>Tất định từ id của {@code PostingJob} (= correlation id xuyên suốt dispatch → worker → log → DB):
 * 6 ký tự hex đầu, viết hoa. Không cần cột/backfill — lỗi cũ cũng có mã; admin tra ngược bằng tiền tố id
 * ({@link #toIdPrefix(String)}). Trùng tiền tố (1/16,7 triệu) chỉ làm kết quả tra cứu có thêm dòng.</p>
 */
public final class PublishReference {

    public static final String PREFIX = "ERR-";
    static final int LENGTH = 6;
    private static final Pattern REFERENCE = Pattern.compile("(?i)^\\s*ERR-([0-9a-f]{" + LENGTH + "})\\s*$");

    private PublishReference() {
    }

    /** Mã tham chiếu của một lần đăng lỗi; null nếu không có job. */
    public static String of(UUID jobId) {
        if (jobId == null) {
            return null;
        }
        return PREFIX + jobId.toString().substring(0, LENGTH).toUpperCase(Locale.ROOT);
    }

    /** {@code ERR-3F9A1C} → {@code 3f9a1c} (tiền tố {@code posting_jobs.id::text}); không phải mã tham chiếu → null. */
    public static String toIdPrefix(String query) {
        if (query == null) {
            return null;
        }
        var matcher = REFERENCE.matcher(query);
        return matcher.matches() ? matcher.group(1).toLowerCase(Locale.ROOT) : null;
    }
}
