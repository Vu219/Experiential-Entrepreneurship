package com.aima.repository.projection;

import java.util.UUID;

/** Một bài đến hạn đồng bộ số liệu + tài khoản của nó (AnalyticsSyncService gom theo tài khoản). */
public interface DueMediaProjection {

    UUID getMediaId();

    UUID getAccountId();
}
