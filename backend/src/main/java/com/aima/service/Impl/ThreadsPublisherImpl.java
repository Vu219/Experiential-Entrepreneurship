package com.aima.service.Impl;

import com.aima.dto.publish.PublishTarget;
import com.aima.enums.Platform;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformPublisher;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

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
    public MetaApiClient.MetaPostResult publish(PublishTarget target) {
        return metaApiClient.publishThreadsPost(target.accessToken(), target.message());
    }

    @Override
    public Optional<String> findPublished(PublishTarget target) {
        if (target.verifySince() == null) {
            return Optional.empty();
        }
        return metaApiClient.getThreadsPosts(target.accessToken(), target.verifySince()).stream()
                .filter(p -> PlatformPublisher.sameMessage(p.message(), target.message()))
                .map(MetaApiClient.MetaPublishedPost::id)
                .findFirst();
    }
}
