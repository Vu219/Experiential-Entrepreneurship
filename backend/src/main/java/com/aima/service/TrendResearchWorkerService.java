package com.aima.service;

import java.util.UUID;

public interface TrendResearchWorkerService {

    /** Phiên "Research ngay" — executor {@code trendResearchExecutor}. */
    void process(UUID sessionId);

    /** Phiên của job 2:00 AM — executor riêng {@code scheduledTrendResearchExecutor} (hàng đợi dài). */
    void processScheduled(UUID sessionId);
}
