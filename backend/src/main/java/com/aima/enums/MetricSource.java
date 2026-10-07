package com.aima.enums;

/** Nguồn của một snapshot số liệu. */
public enum MetricSource {
    /** Job đồng bộ gọi API nền tảng. */
    POLL,
    /** Chép từ post_analytics cũ (mốc 24/48/168h) ở lần đồng bộ đầu tiên. */
    BACKFILL
}
