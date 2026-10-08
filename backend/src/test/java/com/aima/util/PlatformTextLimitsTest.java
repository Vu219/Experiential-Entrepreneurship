package com.aima.util;

import com.aima.enums.Platform;
import org.junit.jupiter.api.Test;

import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

/** Giới hạn chữ trên NỘI DUNG ĐĂNG THẬT (caption + hashtag) — cùng con số với ai/src/agents/platform_formatter.py. */
class PlatformTextLimitsTest {

    @Test
    void compose_matchesPublisherFormat() {
        assertEquals("Xin chao\n\n#aima #test", PlatformTextLimits.compose(" Xin chao ", "aima, #test"));
        assertEquals("Xin chao", PlatformTextLimits.compose("Xin chao", " "));
    }

    @Test
    void threads_countsHashtagsInto500Chars() {
        String caption = "x".repeat(490);
        assertNull(PlatformTextLimits.violation(Platform.THREADS, PlatformTextLimits.compose(caption, "ab")));
        String message = PlatformTextLimits.compose(caption, "abcdefghij");
        assertTrue(PlatformTextLimits.exceedsChars(Platform.THREADS, message));
        assertTrue(PlatformTextLimits.violation(Platform.THREADS, message).contains("500"));
    }

    @Test
    void emojiCountsAsOneCharacter() {
        assertFalse(PlatformTextLimits.exceedsChars(Platform.THREADS, "😀".repeat(500)));
    }

    @Test
    void instagram_atMost30Hashtags_numericTokensAreNotHashtags() {
        String tags30 = IntStream.range(0, 30).mapToObj(i -> "tag" + i).collect(Collectors.joining(","));
        assertFalse(PlatformTextLimits.exceedsHashtags(Platform.INSTAGRAM,
                PlatformTextLimits.compose("Top #1 sản phẩm", tags30)));
        assertTrue(PlatformTextLimits.exceedsHashtags(Platform.INSTAGRAM,
                PlatformTextLimits.compose("Có #ưuđãi", tags30)));
        assertFalse(PlatformTextLimits.exceedsHashtags(Platform.FACEBOOK,
                PlatformTextLimits.compose("Có #ưuđãi", tags30)), "Facebook không giới hạn số hashtag");
    }

    @Test
    void facebook_isGenerous() {
        assertNull(PlatformTextLimits.violation(Platform.FACEBOOK, "x".repeat(63_206)));
        assertNotNull(PlatformTextLimits.violation(Platform.FACEBOOK, "x".repeat(63_207)));
    }
}
