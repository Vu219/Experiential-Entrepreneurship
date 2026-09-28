package com.aima.dto.publish;

import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;

import java.util.UUID;

/**
 * Mọi giá trị worker đăng bài cần cho MỘT lần gọi nền tảng — copy từ entity trong transaction
 * read-only, dùng NGOÀI transaction (rule #24). Chỉ chứa giá trị bất biến, không giữ entity/proxy:
 * đụng proxy lazy sau khi session đóng là LazyInitializationException.
 *
 * @param accountId         id bản ghi {@code platform_accounts} (UUID nội bộ)
 * @param platformAccountId id thật trên nền tảng (Page id, Threads user id...)
 * @param accessToken       token ĐÃ giải mã — không bao giờ log (xem {@link #toString()})
 */
public record PublishTarget(
        UUID jobId,
        UUID postId,
        Platform platform,
        UUID accountId,
        PlatformAccountType accountType,
        String platformAccountId,
        String accountName,
        String accessToken,
        String message) {

    // SEC-03/NFR-06: record tự sinh toString() in cả token — ghi đè để lỡ log object cũng không lộ.
    @Override
    public String toString() {
        return "PublishTarget[jobId=" + jobId + ", postId=" + postId + ", platform=" + platform
                + ", accountId=" + accountId + ", accountType=" + accountType + "]";
    }
}
