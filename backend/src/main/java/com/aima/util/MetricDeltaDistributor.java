package com.aima.util;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.function.Function;

/**
 * Chuyển chuỗi snapshot TÍCH LUỸ của một bài thành số PHÁT SINH theo ngày (docs/analytics-real-data-plan.md 3.2).
 *
 * <p>Với từng metric: mốc gốc = (giờ đăng, 0); mỗi snapshot có giá trị (khác null) tạo một đoạn
 * (mốc trước → snapshot) và phần tăng của đoạn được chia cho các ngày nó đi qua THEO TỶ LỆ THỜI GIAN
 * (làm tròn xuống, phần dư dồn vào ngày cuối). Đoạn trải hơn một ngày → các ngày đó {@code estimated}.
 * Snapshot null bị bỏ qua (chưa có quyền / nền tảng không trả) — lần đầu có số, phần tăng tính từ giờ đăng.
 * Hàm thuần: cùng đầu vào luôn cùng kết quả, nên có thể tính lại toàn bộ mỗi lần có snapshot mới.</p>
 */
public final class MetricDeltaDistributor {

    private MetricDeltaDistributor() {
    }

    /** Một snapshot đầu vào; metric null = không có số ở lần đó. */
    public record Point(Instant at, Long views, Long reactions, Long comments, Long shares, Long saves) {
    }

    /** Số phát sinh của một ngày. */
    public static final class DailyDelta {
        long views;
        long reactions;
        long comments;
        long shares;
        long saves;
        boolean estimated;

        public long views() { return views; }
        public long reactions() { return reactions; }
        public long comments() { return comments; }
        public long shares() { return shares; }
        public long saves() { return saves; }
        public boolean estimated() { return estimated; }
    }

    private record Metric(Function<Point, Long> read, Adder add) {
    }

    @FunctionalInterface
    private interface Adder {
        void add(DailyDelta day, long value);
    }

    private static final List<Metric> METRICS = List.of(
            new Metric(Point::views, (d, v) -> d.views += v),
            new Metric(Point::reactions, (d, v) -> d.reactions += v),
            new Metric(Point::comments, (d, v) -> d.comments += v),
            new Metric(Point::shares, (d, v) -> d.shares += v),
            new Metric(Point::saves, (d, v) -> d.saves += v));

    public static SortedMap<LocalDate, DailyDelta> distribute(Instant publishedAt, List<Point> points, ZoneId zone) {
        SortedMap<LocalDate, DailyDelta> result = new TreeMap<>();
        if (points.isEmpty()) {
            return result;
        }
        List<Point> sorted = points.stream().sorted(Comparator.comparing(Point::at)).toList();
        Instant baseline = publishedAt != null ? publishedAt : sorted.getFirst().at();

        for (Metric metric : METRICS) {
            Instant previousAt = baseline;
            long previousValue = 0;
            for (Point point : sorted) {
                Long value = metric.read().apply(point);
                if (value == null) {
                    continue;
                }
                spread(result, previousAt, point.at(), value - previousValue, metric.add(), zone);
                previousAt = point.at().isAfter(previousAt) ? point.at() : previousAt;
                previousValue = value;
            }
        }
        return result;
    }

    private static void spread(SortedMap<LocalDate, DailyDelta> result, Instant from, Instant to, long delta,
                               Adder add, ZoneId zone) {
        if (delta == 0) {
            return;
        }
        if (!to.isAfter(from)) {
            add.add(day(result, LocalDate.ofInstant(to, zone)), delta);
            return;
        }
        // Cắt đoạn [from, to] theo ranh giới ngày của múi giờ.
        List<LocalDate> days = new ArrayList<>();
        List<Long> overlaps = new ArrayList<>();
        Instant cursor = from;
        while (cursor.isBefore(to)) {
            LocalDate date = LocalDate.ofInstant(cursor, zone);
            Instant nextDay = date.plusDays(1).atStartOfDay(zone).toInstant();
            Instant end = nextDay.isBefore(to) ? nextDay : to;
            days.add(date);
            overlaps.add(Duration.between(cursor, end).toMillis());
            cursor = end;
        }
        long total = Duration.between(from, to).toMillis();
        long assigned = 0;
        boolean estimated = days.size() > 1;
        for (int i = 0; i < days.size(); i++) {
            long share = i == days.size() - 1 ? delta - assigned : delta * overlaps.get(i) / total;
            assigned += share;
            DailyDelta target = day(result, days.get(i));
            add.add(target, share);
            target.estimated |= estimated;
        }
    }

    private static DailyDelta day(SortedMap<LocalDate, DailyDelta> result, LocalDate date) {
        return result.computeIfAbsent(date, ignored -> new DailyDelta());
    }
}
