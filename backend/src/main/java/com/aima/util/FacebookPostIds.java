package com.aima.util;

/**
 * Dạng ID DUY NHẤT của một bài trên Trang Facebook trong AIMA: {@code "{pageId}_{postId}"} — đúng dạng Graph trả cho
 * {@code POST /{page}/feed}, {@code /{page}/published_posts} và {@code value.post_id} của webhook {@code feed}.
 * Mọi ID bài Facebook lưu vào {@code posts.platform_post_id} / {@code platform_media.platform_media_id} / sự kiện webhook
 * đều đi qua đây để ghép được với nhau.
 *
 * <p>Ghi chú các loại bài (để khi AIMA đăng ảnh/video không lưu nhầm ID đối tượng): {@code POST /{page}/photos} trả
 * {@code id} = id ẢNH và {@code post_id} = id BÀI → luôn dùng {@code post_id}; bài nhiều ảnh đăng qua {@code /feed} với
 * {@code attached_media} trả {@code id} dạng bài; {@code POST /{page}/videos} chỉ trả id VIDEO — phải đọc
 * {@code GET /{video-id}?fields=post_id} để có id bài. Hiện AIMA chỉ đăng bài chữ qua {@code /feed}.</p>
 */
public final class FacebookPostIds {

    private FacebookPostIds() {
    }

    /** Đưa ID bài về dạng {@code pageId_postId}; ID đã có tiền tố Trang giữ nguyên; null/rỗng → null. */
    public static String canonical(String pageId, String rawId) {
        if (rawId == null || rawId.isBlank()) {
            return null;
        }
        String id = rawId.trim();
        if (id.contains("_") || pageId == null || pageId.isBlank()) {
            return id;
        }
        return pageId.trim() + "_" + id;
    }
}
