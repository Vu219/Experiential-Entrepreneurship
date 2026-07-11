package com.aima.service;

import java.util.UUID;

/**
 * Worker nền của tối ưu chiến lược (NFR-04): gom analytics → AI /analyze → /optimize →
 * lưu OptimizationInsight + StrategyAdjustment (PENDING). Bean riêng để proxy @Async hoạt động.
 */
public interface StrategyOptimizationWorkerService {

    void process(UUID jobId);
}
