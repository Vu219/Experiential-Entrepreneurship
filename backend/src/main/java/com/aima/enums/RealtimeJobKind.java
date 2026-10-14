package com.aima.enums;

/** Loại tác vụ nền trong sự kiện SSE {@code job.updated} (khớp {@code JobKind} ở frontend/src/realtime/events.ts). */
public enum RealtimeJobKind {
    GENERATION,
    FORMATTING,
    REGEN,
    TREND,
    AI_ASSIST,
    OPTIMIZE
}
