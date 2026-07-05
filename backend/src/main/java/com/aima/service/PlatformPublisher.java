package com.aima.service;

import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.enums.Platform;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Adapter đăng bài theo nền tảng (NFR-09): mỗi nền tảng một implementation, worker chọn theo
 * {@link #platform()}. Thêm nền tảng mới = thêm một bean mới, không sửa worker.
 * Lỗi đăng ném {@link com.aima.exception.PublishException} (FR-35/FR-37) — mọi HTTP vẫn đi qua
 * {@link MetaApiClient} (rule #25).
 */
public interface PlatformPublisher {

    Platform platform();

    /** Đăng một ContentVersion lên tài khoản đích; trả về id bài đăng trên nền tảng (FR-53/FR-54). */
    MetaApiClient.MetaPostResult publish(PlatformAccount account, ContentVersion version);

    /** Nội dung bài đăng = caption đã định dạng + hashtag (CSV không '#' trong DB → "#a #b"). */
    default String buildMessage(ContentVersion version) {
        String caption = version.getFormattedCaption() == null ? "" : version.getFormattedCaption().trim();
        String hashtagCsv = version.getFormattedHashtag();
        if (hashtagCsv == null || hashtagCsv.isBlank()) {
            return caption;
        }
        String tags = Arrays.stream(hashtagCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.startsWith("#") ? s : "#" + s)
                .collect(Collectors.joining(" "));
        return tags.isEmpty() ? caption : caption + "\n\n" + tags;
    }
}
