package com.aima.enums;

/** Không gian key idempotency (unique theo chủ + thao tác + key). */
public enum IdempotencyOperation {
    SCHEDULE_CREATE,
    PUBLISH_NOW
}
