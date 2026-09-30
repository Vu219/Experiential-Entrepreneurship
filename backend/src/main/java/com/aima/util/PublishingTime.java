package com.aima.util;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** Explicit boundary for remaining legacy wall-clock audit/reporting fields. */
public final class PublishingTime {
    public static final ZoneId LEGACY_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private PublishingTime() { }

    public static Instant fromLegacy(LocalDateTime time) {
        return time == null ? null : time.atZone(LEGACY_ZONE).toInstant();
    }

    public static LocalDateTime toLegacy(Instant time) {
        return time == null ? null : LocalDateTime.ofInstant(time, LEGACY_ZONE);
    }
}
