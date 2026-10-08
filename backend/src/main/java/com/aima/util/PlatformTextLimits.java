package com.aima.util;

import com.aima.enums.Platform;

import java.util.Arrays;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Giới hạn chữ của từng nền tảng cho NỘI DUNG ĐĂNG THẬT (caption + "\n\n" + hashtag — {@link #compose}), nguồn DUY NHẤT
 * dùng chung cho worker đăng bài (chặn trước khi gọi Meta) và sửa tay bản nền tảng. Phía AI
 * ({@code ai/src/agents/platform_formatter.py}) giữ cùng con số. Đếm theo code point (emoji = 1 ký tự).
 * Threads 500 ký tự; Instagram caption 2200 ký tự + tối đa 30 hashtag; Facebook 63206 ký tự.
 */
public final class PlatformTextLimits {

    public static final Map<Platform, Integer> MAX_CHARS = Map.of(
            Platform.FACEBOOK, 63_206,
            Platform.INSTAGRAM, 2_200,
            Platform.THREADS, 500);

    public static final int INSTAGRAM_MAX_HASHTAGS = 30;

    // Hashtag = '#' đứng đầu từ, theo sau là chữ/số/gạch dưới, có ít nhất một chữ cái ("#1" không phải hashtag) —
    // Unicode nên hashtag tiếng Việt có dấu vẫn khớp. Cùng quy tắc với _HASHTAG_RE phía AI.
    private static final Pattern HASHTAG = Pattern.compile("(?<![\\p{L}\\p{N}_#])#[\\p{N}_]*\\p{L}[\\p{L}\\p{N}_]*");

    private PlatformTextLimits() {
    }

    /** Nội dung bài = caption đã định dạng + hashtag (CSV không '#' trong DB → "#a #b"). */
    public static String compose(String formattedCaption, String hashtagCsv) {
        String caption = formattedCaption == null ? "" : formattedCaption.trim();
        if (hashtagCsv == null || hashtagCsv.isBlank()) {
            return caption;
        }
        String tags = Arrays.stream(hashtagCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.startsWith("#") ? s : "#" + s)
                .collect(Collectors.joining(" "));
        return tags.isEmpty() ? caption : caption + "\n\n" + tags;
    }

    /** Lý do nội dung vượt giới hạn của nền tảng (tiếng Việt, đưa thẳng cho user); null = hợp lệ. */
    public static String violation(Platform platform, String message) {
        if (exceedsChars(platform, message)) {
            return platform + " cho phép tối đa " + MAX_CHARS.get(platform) + " ký tự (gồm cả hashtag), nội dung hiện có "
                    + length(message) + " ký tự";
        }
        if (exceedsHashtags(platform, message)) {
            return "Instagram cho phép tối đa " + INSTAGRAM_MAX_HASHTAGS + " hashtag, nội dung hiện có "
                    + countHashtags(message) + " hashtag";
        }
        return null;
    }

    public static boolean exceedsChars(Platform platform, String message) {
        Integer maxChars = MAX_CHARS.get(platform);
        return maxChars != null && length(message) > maxChars;
    }

    public static boolean exceedsHashtags(Platform platform, String message) {
        return platform == Platform.INSTAGRAM && countHashtags(message) > INSTAGRAM_MAX_HASHTAGS;
    }

    private static int length(String text) {
        return text == null ? 0 : text.codePointCount(0, text.length());
    }

    static int countHashtags(String text) {
        if (text == null) {
            return 0;
        }
        Matcher matcher = HASHTAG.matcher(text);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }
}
