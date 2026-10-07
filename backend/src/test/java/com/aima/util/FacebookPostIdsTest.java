package com.aima.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FacebookPostIdsTest {

    @Test
    void canonical_keepsPagePrefixedIds_andPrefixesBareIds() {
        assertEquals("1163_1225", FacebookPostIds.canonical("1163", "1163_1225"), "dạng /feed, published_posts, webhook");
        assertEquals("1163_1225", FacebookPostIds.canonical("1163", "1225"), "id bài trần → thêm tiền tố Trang");
        assertEquals("1163_1225", FacebookPostIds.canonical("1163", " 1163_1225 "));
        assertNull(FacebookPostIds.canonical("1163", null));
        assertNull(FacebookPostIds.canonical("1163", " "));
        assertEquals("1225", FacebookPostIds.canonical(null, "1225"), "không biết Trang thì giữ nguyên");
    }
}
