package com.aima.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Kỳ tính lượt theo chu kỳ thanh toán (V20): kỳ tháng neo theo mốc, chuyển tiếp không chồng lên kỳ cũ. */
class SubscriptionPeriodsTest {

    private static LocalDateTime at(String iso) {
        return LocalDateTime.parse(iso);
    }

    @Test
    void firstPeriod_isOneMonthFromAnchor() {
        SubscriptionPeriods.Period period = SubscriptionPeriods.firstPeriod(at("2026-10-21T09:30:00"));
        assertEquals(at("2026-10-21T09:30:00"), period.start());
        assertEquals(at("2026-11-21T09:30:00"), period.end());
    }

    @Test
    void rollover_followsAnchorDay() {
        SubscriptionPeriods.Period next = SubscriptionPeriods.periodContaining(
                at("2026-09-05T10:00:00"), at("2026-11-05T10:00:00"), at("2026-11-06T08:00:00"));
        assertEquals(at("2026-11-05T10:00:00"), next.start());
        assertEquals(at("2026-12-05T10:00:00"), next.end());
    }

    /** Chuyển tiếp từ kỳ tháng lịch cũ: kỳ mới bắt đầu ở cuối kỳ cũ (không tính lại lượt), ngắn tới mốc neo kế tiếp. */
    @Test
    void transitionFromCalendarMonth_neverOverlapsPreviousPeriod() {
        SubscriptionPeriods.Period next = SubscriptionPeriods.periodContaining(
                at("2026-09-05T10:00:00"), at("2026-11-01T00:00:00"), at("2026-11-01T00:00:01"));
        assertEquals(at("2026-11-01T00:00:00"), next.start(), "không lùi về 05/10 (đã tính trong kỳ cũ)");
        assertEquals(at("2026-11-05T10:00:00"), next.end());
    }

    @Test
    void anchorOn31st_doesNotDriftToShorterMonths() {
        SubscriptionPeriods.Period next = SubscriptionPeriods.periodContaining(
                at("2026-01-31T00:00:00"), at("2026-02-28T00:00:00"), at("2026-03-15T00:00:00"));
        assertEquals(at("2026-02-28T00:00:00"), next.start());
        assertEquals(at("2026-03-31T00:00:00"), next.end(), "plusMonths từ mốc gốc — tháng sau lại về 31");
    }

    @Test
    void longInactivity_jumpsToTheCycleContainingNow() {
        SubscriptionPeriods.Period next = SubscriptionPeriods.periodContaining(
                at("2026-01-10T00:00:00"), at("2026-02-10T00:00:00"), at("2026-07-20T12:00:00"));
        assertEquals(at("2026-07-10T00:00:00"), next.start());
        assertEquals(at("2026-08-10T00:00:00"), next.end());
    }
}
