package com.aima.repository;

import com.aima.entity.PostAnalytics;
import com.aima.repository.projection.ContentTypeMetricProjection;
import com.aima.repository.projection.DailyEngagementProjection;
import com.aima.repository.projection.DailyMetricProjection;
import com.aima.repository.projection.HeatmapCellProjection;
import com.aima.repository.projection.LifetimeStatsProjection;
import com.aima.repository.projection.PlatformMetricProjection;
import com.aima.repository.projection.PostEngagementProjection;
import com.aima.repository.projection.TopPostProjection;
import com.aima.repository.projection.TopicMetricProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PostAnalyticsRepository extends JpaRepository<PostAnalytics, UUID> {

    /*
     * Hai truy vấn dưới đây tổng hợp số liệu cho Bảng điều khiển. Cả hai đều native vì cần
     * DISTINCT ON của PostgreSQL: post_analytics lưu số liệu CỘNG DỒN ở các mốc 24h/48h/168h,
     * nên mỗi bài chỉ được lấy MỘT snapshot (mốc giờ lớn nhất) — cộng cả ba mốc sẽ đếm trùng.
     * Tất cả đều lọc theo user qua posts → post_schedules → platform_accounts.user_id (API-03).
     */

    /**
     * Hai ô số trên card hồ sơ: TỔNG TÍCH LŨY, không giới hạn khoảng ngày (khác mọi endpoint
     * /analytics/* vốn bị chặn tối đa 366 ngày nên không dùng lại được).
     *
     * <p>{@code totalReach} cộng lượt xem của MỘT snapshot mỗi bài (mốc giờ lớn nhất) — cộng cả
     * ba mốc 24h/48h/168h sẽ đếm trùng vì số liệu là cộng dồn. Bài chưa có snapshot nào (mới đăng,
     * hoặc nền tảng không trả lượt xem) vẫn được đếm ở {@code postsPublished} và góp 0 vào reach.
     * Scope theo user qua posts → post_schedules → platform_accounts.user_id (API-03).
     */
    @Query(value = """
            select cast(count(*) as bigint) as postsPublished,
                   cast(coalesce(sum(la.views), 0) as bigint) as totalReach
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join (
                select distinct on (a.post_id) a.post_id, a.views
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
            """, nativeQuery = true)
    LifetimeStatsProjection findLifetimeStatsForUser(@Param("userId") UUID userId);

    // Biểu đồ "Hiệu suất nội dung": tiếp cận (views) + tương tác (likes+comments+shares) theo NGÀY ĐĂNG.
    @Query(value = """
            select to_char(p.published_at, 'YYYY-MM-DD') as day,
                   cast(coalesce(sum(la.views), 0) as bigint) as reach,
                   cast(coalesce(sum(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                                     + coalesce(la.shares, 0)), 0) as bigint) as engagement
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join (
                select distinct on (a.post_id) a.post_id, a.views, a.likes, a.comments, a.shares
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
              and p.published_at is not null
              and p.published_at >= :from
            group by 1
            order by 1
            """, nativeQuery = true)
    List<DailyMetricProjection> findDailyPerformanceForUser(@Param("userId") UUID userId,
                                                            @Param("from") LocalDateTime from);

    // Khối "Top chủ đề hiệu quả": chủ đề = trend gắn với bài (content_items.trend_id — tham chiếu
    // mềm nên join tường minh). LEFT JOIN toàn bộ nhánh đăng bài để chủ đề chưa đăng vẫn xuất hiện
    // với engagement = 0 (xếp hạng kết hợp: tương tác trước, số bài sau).
    @Query(value = """
            select t.trend_name as name,
                   count(distinct i.id) as posts,
                   cast(coalesce(sum(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                                     + coalesce(la.shares, 0)), 0) as bigint) as engagement
            from content_items i
            join brand_profiles bp on bp.id = i.brand_profile_id and bp.deleted_at is null
            join trends t on t.id = i.trend_id and t.deleted_at is null
            left join content_versions cv on cv.content_item_id = i.id and cv.deleted_at is null
            left join post_schedules ps on ps.content_version_id = cv.id and ps.deleted_at is null
            left join posts p on p.schedule_id = ps.id and p.deleted_at is null and p.status = 'POSTED'
            left join (
                select distinct on (a.post_id) a.post_id, a.likes, a.comments, a.shares
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where bp.user_id = :userId and i.deleted_at is null
            group by t.trend_name
            order by engagement desc, posts desc
            limit :limit
            """, nativeQuery = true)
    List<TopicMetricProjection> findTopTopicsForUser(@Param("userId") UUID userId,
                                                     @Param("limit") int limit);

    /*
     * Bộ lọc dùng chung của trang Phân tích, lặp lại nguyên văn trong các truy vấn dưới:
     *   - platformCsv  null = mọi nền tảng; khác null = tên nền tảng nối bằng dấu phẩy ("FACEBOOK,THREADS").
     *   - typeCsv      null = mọi loại nội dung; khác null = nhãn media_format IN HOA ("IMAGE,VIDEO"),
     *                  nhãn OTHER khớp bản chưa có định dạng (media_format null/rỗng).
     * CAST(:param AS text) là bắt buộc để PostgreSQL suy được kiểu khi bind null.
     */

    // Trang Phân tích (UI-08 khối B/C): 4 metric riêng lẻ theo NGÀY ĐĂNG trong [from, to). Cùng khuôn
    // với findDailyPerformanceForUser nhưng KHÔNG gộp thành reach/engagement — FE cần từng metric.
    @Query(value = """
            select to_char(p.published_at, 'YYYY-MM-DD') as day,
                   cast(coalesce(sum(la.views), 0) as bigint) as views,
                   cast(coalesce(sum(la.likes), 0) as bigint) as likes,
                   cast(coalesce(sum(la.comments), 0) as bigint) as comments,
                   cast(coalesce(sum(la.shares), 0) as bigint) as shares
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            left join (
                select distinct on (a.post_id) a.post_id, a.views, a.likes, a.comments, a.shares
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
              and p.published_at is not null
              and p.published_at >= :from
              and p.published_at < :to
              and (cast(:platformCsv as text) is null
                   or p.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or upper(coalesce(nullif(trim(cv.media_format), ''), 'OTHER'))
                       = any(string_to_array(cast(:typeCsv as text), ',')))
            group by 1
            order by 1
            """, nativeQuery = true)
    List<DailyEngagementProjection> findDailyEngagementForUser(@Param("userId") UUID userId,
                                                               @Param("from") LocalDateTime from,
                                                               @Param("to") LocalDateTime to,
                                                               @Param("platformCsv") String platformCsv,
                                                               @Param("typeCsv") String typeCsv);

    // Khối D — số liệu gộp theo TỪNG nền tảng trong [from, to). CỐ Ý không nhận platformCsv: donut thể
    // hiện tỷ trọng GIỮA các nền tảng nên luôn tính tất cả (lọc nền tảng sẽ để lại một lát 100%);
    // service tự bổ sung nền tảng chưa có bài. Vẫn áp lọc LOẠI NỘI DUNG vì đó là chiều khác.
    @Query(value = """
            select p.platform_name as platform,
                   cast(coalesce(sum(la.views), 0) as bigint) as views,
                   cast(coalesce(sum(la.likes), 0) as bigint) as likes,
                   cast(coalesce(sum(la.comments), 0) as bigint) as comments,
                   cast(coalesce(sum(la.shares), 0) as bigint) as shares,
                   cast(coalesce(sum(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                                     + coalesce(la.shares, 0)), 0) as bigint) as engagement
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            left join (
                select distinct on (a.post_id) a.post_id, a.views, a.likes, a.comments, a.shares
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
              and p.published_at is not null
              and p.published_at >= :from
              and p.published_at < :to
              and (cast(:typeCsv as text) is null
                   or upper(coalesce(nullif(trim(cv.media_format), ''), 'OTHER'))
                       = any(string_to_array(cast(:typeCsv as text), ',')))
            group by p.platform_name
            """, nativeQuery = true)
    List<PlatformMetricProjection> findPlatformMetricsForUser(@Param("userId") UUID userId,
                                                              @Param("from") LocalDateTime from,
                                                              @Param("to") LocalDateTime to,
                                                              @Param("typeCsv") String typeCsv);

    // Khối F — số liệu gộp theo TỪNG loại nội dung trong [from, to). Đối xứng với khối D: CỐ Ý không
    // nhận typeCsv (donut là tỷ trọng giữa các loại), nhưng vẫn áp lọc NỀN TẢNG. Nhãn chuẩn hoá IN
    // HOA; bản chưa định dạng (media_format null/rỗng) gom vào OTHER.
    @Query(value = """
            select upper(coalesce(nullif(trim(cv.media_format), ''), 'OTHER')) as label,
                   count(*) as posts,
                   cast(coalesce(sum(la.views), 0) as bigint) as views,
                   cast(coalesce(sum(la.likes), 0) as bigint) as likes,
                   cast(coalesce(sum(la.comments), 0) as bigint) as comments,
                   cast(coalesce(sum(la.shares), 0) as bigint) as shares,
                   cast(coalesce(sum(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                                     + coalesce(la.shares, 0)), 0) as bigint) as engagement
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            left join (
                select distinct on (a.post_id) a.post_id, a.views, a.likes, a.comments, a.shares
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
              and p.published_at is not null
              and p.published_at >= :from
              and p.published_at < :to
              and (cast(:platformCsv as text) is null
                   or p.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
            group by 1
            order by engagement desc
            """, nativeQuery = true)
    List<ContentTypeMetricProjection> findContentTypeMetricsForUser(@Param("userId") UUID userId,
                                                                    @Param("from") LocalDateTime from,
                                                                    @Param("to") LocalDateTime to,
                                                                    @Param("platformCsv") String platformCsv);

    // Khối G — heatmap: gộp theo (thứ ISO, khung 3 giờ) của giờ ĐĂNG. published_at là timestamp không
    // múi giờ, đã lưu theo APP_TIMEZONE nên extract dùng trực tiếp, không quy đổi thêm. Chỉ trả ô CÓ
    // bài; ô vắng mặt nghĩa là "chưa từng đăng khung đó" — khác hẳn ô đăng rồi mà không ai tương tác.
    @Query(value = """
            select cast(extract(isodow from p.published_at) as int) as dow,
                   cast(floor(extract(hour from p.published_at) / 3) as int) as slot,
                   count(*) as posts,
                   cast(coalesce(sum(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                                     + coalesce(la.shares, 0)), 0) as bigint) as engagement
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            left join (
                select distinct on (a.post_id) a.post_id, a.likes, a.comments, a.shares
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
              and p.published_at is not null
              and p.published_at >= :from
              and p.published_at < :to
              and (cast(:platformCsv as text) is null
                   or p.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or upper(coalesce(nullif(trim(cv.media_format), ''), 'OTHER'))
                       = any(string_to_array(cast(:typeCsv as text), ',')))
            group by 1, 2
            """, nativeQuery = true)
    List<HeatmapCellProjection> findHeatmapForUser(@Param("userId") UUID userId,
                                                   @Param("from") LocalDateTime from,
                                                   @Param("to") LocalDateTime to,
                                                   @Param("platformCsv") String platformCsv,
                                                   @Param("typeCsv") String typeCsv);

    // Export — đếm TRƯỚC khi nạp để chặn ở trần thay vì cắt cụt im lặng (cùng cách export log hoạt động).
    @Query(value = """
            select count(*)
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
              and p.published_at is not null
              and p.published_at >= :from
              and p.published_at < :to
              and (cast(:platformCsv as text) is null
                   or p.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or upper(coalesce(nullif(trim(cv.media_format), ''), 'OTHER'))
                       = any(string_to_array(cast(:typeCsv as text), ',')))
            """, nativeQuery = true)
    long countPostsForUser(@Param("userId") UUID userId,
                           @Param("from") LocalDateTime from,
                           @Param("to") LocalDateTime to,
                           @Param("platformCsv") String platformCsv,
                           @Param("typeCsv") String typeCsv);

    // Khối H — một dòng / bài đã đăng trong kỳ: tương tác để so với mức trung bình kỳ, và lượt xem
    // GIỮ NGUYÊN null (không coalesce về 0) vì "nền tảng không trả lượt xem" khác "0 lượt xem" —
    // tỷ lệ tương tác phải loại các bài đó khỏi mẫu số.
    @Query(value = """
            select cast(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                        + coalesce(la.shares, 0) as bigint) as engagement,
                   la.views as views
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            left join (
                select distinct on (a.post_id) a.post_id, a.views, a.likes, a.comments, a.shares
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
              and p.published_at is not null
              and p.published_at >= :from
              and p.published_at < :to
              and (cast(:platformCsv as text) is null
                   or p.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or upper(coalesce(nullif(trim(cv.media_format), ''), 'OTHER'))
                       = any(string_to_array(cast(:typeCsv as text), ',')))
            """, nativeQuery = true)
    List<PostEngagementProjection> findPostEngagementForUser(@Param("userId") UUID userId,
                                                             @Param("from") LocalDateTime from,
                                                             @Param("to") LocalDateTime to,
                                                             @Param("platformCsv") String platformCsv,
                                                             @Param("typeCsv") String typeCsv);

    // Khối E — bài đã đăng trong [from, to) kèm số liệu mốc muộn nhất; caption/contentItemId lấy từ
    // content_versions (LEFT JOIN để bài không biến mất nếu bản định dạng bị xoá mềm). Sắp xếp theo
    // cột do service quyết định (whitelist) nên ở đây chỉ ORDER BY ngày đăng làm thứ tự nạp mặc định.
    @Query(value = """
            select p.id as postId,
                   cv.content_item_id as contentItemId,
                   p.platform_name as platform,
                   cv.formatted_caption as caption,
                   pa.account_name as accountName,
                   p.published_at as publishedAt,
                   cast(coalesce(la.views, 0) as bigint) as views,
                   cast(coalesce(la.likes, 0) as bigint) as likes,
                   cast(coalesce(la.comments, 0) as bigint) as comments,
                   cast(coalesce(la.shares, 0) as bigint) as shares,
                   cast(coalesce(la.likes, 0) + coalesce(la.comments, 0) + coalesce(la.shares, 0) as bigint) as engagement
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            left join (
                select distinct on (a.post_id) a.post_id, a.views, a.likes, a.comments, a.shares
                from post_analytics a
                where a.deleted_at is null
                order by a.post_id, a.milestone_hours desc nulls last
            ) la on la.post_id = p.id
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
              and p.published_at is not null
              and p.published_at >= :from
              and p.published_at < :to
              and (cast(:platformCsv as text) is null
                   or p.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or upper(coalesce(nullif(trim(cv.media_format), ''), 'OTHER'))
                       = any(string_to_array(cast(:typeCsv as text), ',')))
            order by p.published_at desc
            """, nativeQuery = true)
    List<TopPostProjection> findTopPostsForUser(@Param("userId") UUID userId,
                                                @Param("from") LocalDateTime from,
                                                @Param("to") LocalDateTime to,
                                                @Param("platformCsv") String platformCsv,
                                                @Param("typeCsv") String typeCsv);
}
