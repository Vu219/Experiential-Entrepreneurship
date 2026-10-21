package com.aima.util;

import com.aima.enums.Platform;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/** Tập nền tảng ↔ chuỗi CSV theo thứ tự scope (FB → IG → Threads). Tên lạ bị bỏ qua, không làm hỏng việc đọc. */
public final class PlatformCsv {

    private PlatformCsv() {
    }

    public static Set<Platform> parse(String csv) {
        if (csv == null || csv.isBlank()) {
            return Collections.unmodifiableSet(EnumSet.noneOf(Platform.class));
        }
        Set<Platform> platforms = EnumSet.noneOf(Platform.class);
        for (String token : csv.split(",")) {
            String name = token.strip().toUpperCase();
            Arrays.stream(Platform.values()).filter(p -> p.name().equals(name)).findFirst().ifPresent(platforms::add);
        }
        return Collections.unmodifiableSet(platforms);
    }

    public static String format(Collection<Platform> platforms) {
        if (platforms == null) {
            return null;
        }
        EnumSet<Platform> ordered = platforms.isEmpty() ? EnumSet.noneOf(Platform.class) : EnumSet.copyOf(platforms);
        return ordered.stream().map(Platform::name).collect(Collectors.joining(","));
    }
}
