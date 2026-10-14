package com.aima.service;

/**
 * Nhận sự kiện của luồng AI {@code /generate/stream} trong lúc {@code AiServiceClient.generateContentStream} chờ kết quả.
 * Gọi trên luồng I/O của WebClient — không chặn, không ném.
 */
public interface AiStreamListener {

    default void onStart(String provider, String model, Long inputTokens) {
    }

    /** Một field chuỗi dài thêm ({@code replace=true}: thay toàn bộ giá trị field). */
    void onDelta(String path, String append, boolean replace);

    /** AI chuyển model dự phòng giữa chừng — xoá phần xem trước đã hiện. */
    void onReset(String reason);
}
