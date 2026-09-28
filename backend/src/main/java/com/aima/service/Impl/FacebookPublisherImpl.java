package com.aima.service.Impl;

import com.aima.dto.publish.PublishTarget;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PublishErrorType;
import com.aima.exception.PublishException;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformPublisher;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Đăng bài Facebook: chỉ qua Trang (Page) — Graph API không cho đăng lên feed cá nhân.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class FacebookPublisherImpl implements PlatformPublisher {

    MetaApiClient metaApiClient;

    @Override
    public Platform platform() {
        return Platform.FACEBOOK;
    }

    // Mã lỗi nội bộ khi kênh đích không phải Trang — lỗi vĩnh viễn, không gọi Meta, không retry.
    static final String ACCOUNT_TYPE_CODE = "ACCOUNT_TYPE";
    static final String USER_TARGET_MESSAGE = "Facebook chỉ cho phép đăng lên Trang, vui lòng chọn một Trang";

    @Override
    public MetaApiClient.MetaPostResult publish(PublishTarget target) {
        if (target.accountType() != PlatformAccountType.PAGE) {
            throw new PublishException(PublishErrorType.PERMANENT, ACCOUNT_TYPE_CODE, USER_TARGET_MESSAGE);
        }
        return metaApiClient.publishPagePost(target.platformAccountId(), target.accessToken(), target.message());
    }
}
