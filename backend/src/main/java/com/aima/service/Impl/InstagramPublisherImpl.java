package com.aima.service.Impl;

import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorType;
import com.aima.exception.PublishException;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformPublisher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Instagram Content Publishing API bắt buộc phải có image_url/video_url — không có bài text-only.
 * MVP không sinh media (FR-29: chỉ media prompt) nên chưa đăng được Instagram; lỗi vĩnh viễn,
 * không retry, user được thông báo qua luồng failed-post.
 */
@Service
@Slf4j
public class InstagramPublisherImpl implements PlatformPublisher {

    @Override
    public Platform platform() {
        return Platform.INSTAGRAM;
    }

    @Override
    public MetaApiClient.MetaPostResult publish(PlatformAccount account, ContentVersion version) {
        throw new PublishException(PublishErrorType.PERMANENT, "IG_MEDIA_REQUIRED",
                "Instagram yêu cầu ảnh/video khi đăng — MVP chưa hỗ trợ đăng media (chỉ tạo media prompt, FR-29)");
    }
}
