package com.aima.service;

import com.aima.dto.publish.PublishTarget;
import com.aima.enums.Platform;
import com.aima.util.PlatformTextLimits;

import java.util.Optional;

/**
 * Adapter đăng bài theo nền tảng (NFR-09): mỗi nền tảng một implementation, worker chọn theo
 * {@link #platform()}. Thêm nền tảng mới = thêm một bean mới, không sửa worker.
 * Lỗi đăng ném {@link com.aima.exception.PublishException} (FR-35/FR-37) — mọi HTTP vẫn đi qua
 * {@link MetaApiClient} (rule #25).
 */
public interface PlatformPublisher {

    Platform platform();

    /**
     * Đăng lên tài khoản đích; trả về id bài đăng trên nền tảng (FR-53/FR-54). Chạy NGOÀI transaction
     * nên chỉ nhận {@link PublishTarget} (giá trị đã chụp sẵn) — không nhận entity (proxy lazy).
     */
    MetaApiClient.MetaPostResult publish(PublishTarget target);

    /**
     * Nội dung bài đăng = caption đã định dạng + hashtag (CSV không '#' trong DB → "#a #b").
     * Worker truyền giá trị từ snapshot của Post (bài cũ chưa có snapshot: từ bản nền tảng).
     */
    default String buildMessage(String formattedCaption, String hashtagCsv) {
        return PlatformTextLimits.compose(formattedCaption, hashtagCsv);
    }

    /**
     * Chống đăng trùng khi đăng lại sau lỗi MƠ HỒ (timeout, gián đoạn, 5xx — nền tảng có thể đã nhận bài):
     * tìm bài đã đăng của tài khoản đích từ {@link PublishTarget#verifySince()} có nội dung khớp
     * {@link PublishTarget#message()}. Trả id bài trên nền tảng nếu đã có. Mặc định không kiểm tra được → rỗng.
     * Lỗi gọi nền tảng được phép ném ra — worker coi như "không kiểm tra được" và vẫn đăng.
     */
    default Optional<String> findPublished(PublishTarget target) {
        return Optional.empty();
    }

    /** So nội dung bài: bỏ khoảng trắng đầu/cuối và gộp khoảng trắng liên tiếp (nền tảng có thể chuẩn hoá xuống dòng). */
    static boolean sameMessage(String published, String expected) {
        if (published == null || expected == null) {
            return false;
        }
        return normalize(published).equals(normalize(expected));
    }

    private static String normalize(String value) {
        return value.strip().replaceAll("\\s+", " ");
    }
}
