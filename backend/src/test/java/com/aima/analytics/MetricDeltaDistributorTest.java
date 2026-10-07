package com.aima.analytics;

import com.aima.util.MetricDeltaDistributor;
import com.aima.util.MetricDeltaDistributor.DailyDelta;
import com.aima.util.MetricDeltaDistributor.Point;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.SortedMap;

import static org.junit.jupiter.api.Assertions.*;

/** Chia số tích luỹ thành số phát sinh theo ngày giờ Việt Nam (analytics giai đoạn 1). */
class MetricDeltaDistributorTest {

    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    static Instant vn(String localDateTime) {
        return LocalDateTime.parse(localDateTime).atZone(VN).toInstant();
    }

    static Point views(String at, Long views) {
        return new Point(vn(at), views, null, null, null, null);
    }

    static LocalDate d(String date) {
        return LocalDate.parse(date);
    }

    @Test
    void sameDay_allOnThatDay_notEstimated() {
        SortedMap<LocalDate, DailyDelta> r = MetricDeltaDistributor.distribute(vn("2026-10-01T10:00"),
                List.of(views("2026-10-01T14:00", 100L)), VN);

        assertEquals(1, r.size());
        assertEquals(100, r.get(d("2026-10-01")).views());
        assertFalse(r.get(d("2026-10-01")).estimated());
    }

    @Test
    void crossesMidnight_splitByTimeInVietnamTimezone_estimated() {
        // 22:00 → 02:00 hôm sau: 2 giờ mỗi bên → chia đôi.
        SortedMap<LocalDate, DailyDelta> r = MetricDeltaDistributor.distribute(vn("2026-10-01T22:00"),
                List.of(views("2026-10-02T02:00", 100L)), VN);

        assertEquals(50, r.get(d("2026-10-01")).views());
        assertEquals(50, r.get(d("2026-10-02")).views());
        assertTrue(r.get(d("2026-10-01")).estimated() && r.get(d("2026-10-02")).estimated());
    }

    @Test
    void successiveSnapshots_deltaIsDifferenceOfCumulative() {
        SortedMap<LocalDate, DailyDelta> r = MetricDeltaDistributor.distribute(vn("2026-10-01T08:00"), List.of(
                views("2026-10-01T20:00", 100L),
                views("2026-10-02T06:00", 120L),   // 20:00 → 06:00: 4h ngày 1, 6h ngày 2
                views("2026-10-02T18:00", 150L)), VN);

        assertEquals(108, r.get(d("2026-10-01")).views()); // 100 + 20·4/10
        assertEquals(42, r.get(d("2026-10-02")).views());  // 12 + 30
        assertEquals(150, r.values().stream().mapToLong(DailyDelta::views).sum(), "tổng delta = số tích luỹ cuối");
    }

    @Test
    void remainderGoesToLastDay_totalPreserved() {
        SortedMap<LocalDate, DailyDelta> r = MetricDeltaDistributor.distribute(vn("2026-10-01T00:00"),
                List.of(views("2026-10-04T00:00", 100L)), VN);

        assertEquals(List.of(33L, 33L, 34L), r.values().stream().map(DailyDelta::views).toList());
    }

    @Test
    void nullMetricSkipped_firstValueSpreadFromPublishTime() {
        // Ngày 1 chưa có quyền read_insights (views null) nhưng có reactions; ngày 3 mới có views.
        SortedMap<LocalDate, DailyDelta> r = MetricDeltaDistributor.distribute(vn("2026-10-01T00:00"), List.of(
                new Point(vn("2026-10-01T12:00"), null, 5L, null, null, null),
                new Point(vn("2026-10-03T00:00"), 200L, 9L, null, null, null)), VN);

        assertEquals(5 + 1, r.get(d("2026-10-01")).reactions()); // 5 + ⌊4·12h/36h⌋
        assertEquals(3, r.get(d("2026-10-02")).reactions());      // phần còn lại dồn ngày cuối
        assertEquals(100, r.get(d("2026-10-01")).views());       // 200 chia đều 2 ngày từ giờ đăng
        assertEquals(100, r.get(d("2026-10-02")).views());
        assertEquals(9, r.values().stream().mapToLong(DailyDelta::reactions).sum());
    }

    @Test
    void decreaseIsNegativeDelta() {
        SortedMap<LocalDate, DailyDelta> r = MetricDeltaDistributor.distribute(vn("2026-10-01T08:00"), List.of(
                new Point(vn("2026-10-01T10:00"), null, 10L, null, null, null),
                new Point(vn("2026-10-02T10:00"), null, 8L, null, null, null)), VN);

        assertEquals(8, r.values().stream().mapToLong(DailyDelta::reactions).sum());
        assertEquals(-1, r.get(d("2026-10-02")).reactions(), "giảm (bỏ cảm xúc) là delta âm");
    }

    @Test
    void noPoints_empty() {
        assertTrue(MetricDeltaDistributor.distribute(vn("2026-10-01T08:00"), List.of(), VN).isEmpty());
    }
}
