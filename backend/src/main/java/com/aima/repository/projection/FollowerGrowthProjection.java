package com.aima.repository.projection;

/** Người theo dõi MỚI trong kỳ (cộng follows theo ngày) + số ngày có số liệu — 0 nghĩa là "không có số" (khác 0). */
public interface FollowerGrowthProjection {

    Long getFollows();

    long getSamples();
}
