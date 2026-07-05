package com.aima.service.Impl;

import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.enums.Platform;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformPublisher;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Đăng bài text lên Threads (container TEXT → publish) bằng long-lived user token.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ThreadsPublisherImpl implements PlatformPublisher {

    MetaApiClient metaApiClient;

    @Override
    public Platform platform() {
        return Platform.THREADS;
    }

    @Override
    public MetaApiClient.MetaPostResult publish(PlatformAccount account, ContentVersion version) {
        String message = buildMessage(version);
        return metaApiClient.publishThreadsPost(account.getAccessToken(), message);
    }
}
