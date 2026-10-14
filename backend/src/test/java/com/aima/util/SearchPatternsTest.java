package com.aima.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SearchPatternsTest {

    @Test
    void blankMeansNoFilter() {
        assertEquals("", SearchPatterns.contains(null));
        assertEquals("", SearchPatterns.contains("   "));
    }

    @Test
    void trimsAndWrapsWithWildcards() {
        assertEquals("%dưỡng da%", SearchPatterns.contains("  dưỡng da "));
    }

    @Test
    void escapesLikeMetacharacters() {
        assertEquals("%50\\%%", SearchPatterns.contains("50%"));
        assertEquals("%a\\_b%", SearchPatterns.contains("a_b"));
        assertEquals("%c:\\\\d%", SearchPatterns.contains("c:\\d"));
    }
}
