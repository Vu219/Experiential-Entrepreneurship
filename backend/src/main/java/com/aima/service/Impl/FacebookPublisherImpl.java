package com.aima.service.Impl;

import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
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

    @Override
    public MetaApiClient.MetaPostResult publish(PlatformAccount account, ContentVersion version) {
        if (account.getAccountType() != PlatformAccountType.PAGE) {
            throw new PublishException(PublishErrorType.PERMANENT, "ACCOUNT_TYPE",
                    "Facebook chỉ cho đăng qua Trang (Page) — vui lòng chọn một Page đã kết nối");
        }
        String message = buildMessage(version);
        return metaApiClient.publishPagePost(account.getPlatformAccountId(), account.getAccessToken(), message);
    }
}
