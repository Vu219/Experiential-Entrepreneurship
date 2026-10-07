package com.aima.service.Impl;

import com.aima.service.MetaApiClient.MetaPublishedPost;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Ánh xạ attachments.media_type của Graph → nhãn loại nội dung (khối "Hiệu suất theo loại nội dung"). */
class FacebookMetricsProviderImplTest {

    @Test
    void mediaType_mapsGraphAttachmentTypes() {
        assertEquals("TEXT", FacebookMetricsProviderImpl.mediaType(post(null, true)), "không đính kèm = bài chữ");
        assertEquals("IMAGE", FacebookMetricsProviderImpl.mediaType(post("photo", true)));
        assertEquals("IMAGE", FacebookMetricsProviderImpl.mediaType(post("album", true)));
        assertEquals("VIDEO", FacebookMetricsProviderImpl.mediaType(post("video", true)));
        assertEquals("VIDEO", FacebookMetricsProviderImpl.mediaType(post("video_inline", true)));
        assertEquals("VIDEO", FacebookMetricsProviderImpl.mediaType(post("video_autoplay", true)));
        assertEquals("OTHER", FacebookMetricsProviderImpl.mediaType(post("share", true)));
        assertNull(FacebookMetricsProviderImpl.mediaType(post(null, false)), "Meta từ chối trường attachments → không đoán");
    }

    private static MetaPublishedPost post(String attachmentType, boolean known) {
        return new MetaPublishedPost("1_2", null, null, null, attachmentType, known);
    }
}
