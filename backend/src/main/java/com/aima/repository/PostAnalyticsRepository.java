package com.aima.repository;

import com.aima.entity.PostAnalytics;
import com.aima.repository.projection.ContentTypeMetricProjection;
import com.aima.repository.projection.DailyEngagementProjection;
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

    /** Các mốc 24/48/168h đã có của một bài — AnalyticsSyncService chép sang snapshot / tránh tạo trùng mốc. */
    List<PostAnalytics> findByPost_IdAndDeletedAtIsNull(UUID postId);

    /*
     * Số liệu Hồ sơ / "Top chủ đề" của Bảng điều khiển dùng CÙNG nguồn với trang Phân tích (analytics giai đoạn 1):
     * mỗi bài lấy MỘT snapshot mới nhất trong post_metric_snapshots (số tích luỹ — cộng nhiều snapshot là đếm trùng).
     * Biểu đồ hiệu suất của Bảng điều khiển gọi thẳng findDailyEngagementForUser (số phát sinh theo ngày).
     * Tất cả đều lọc theo user qua posts → post_schedules → platform_accounts.user_id (API-03).
     */

    /**
     * Hai ô số trên card hồ sơ: TỔNG TÍCH LŨY, không giới hạn khoảng ngày (khác mọi endpoint
     * /analytics/* vốn bị chặn tối đa 366 ngày nên không dùng lại được).
     *
     * <p>{@code totalReach} cộng lượt xem của snapshot MỚI NHẤT mỗi bài (= tổng số phát sinh từ trước tới nay,
     * cùng nguồn với trang Phân tích). Bài chưa có snapshot nào (mới đăng, hoặc nền tảng không trả lượt xem)
     * vẫn được đếm ở {@code postsPublished} và góp 0 vào reach.
     * Scope theo user qua posts → post_schedules → platform_accounts.user_id (API-03).
     */
    @Query(value = """
            select cast(count(*) as bigint) as postsPublished,
                   cast(coalesce(sum(la.views), 0) as bigint) as totalReach
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join lateral (
                select s.views, s.reactions as likes, s.comments, s.shares
                from platform_media m
                join post_metric_snapshots s on s.platform_media_id = m.id and s.deleted_at is null
                where m.post_id = p.id and m.deleted_at is null
                order by s.collected_at desc
                limit 1
            ) la on true
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'POSTED'
            """, nativeQuery = true)
    LifetimeStatsProjection findLifetimeStatsForUser(@Param("userId") UUID userId);

    // Khối "Top chủ đề hiệu quả": chủ đề = trend gắn với bài (content_items.trend_id — tham chiếu
    // mềm nên join tường minh). LEFT JOIN toàn bộ nhánh đăng bài để chủ đề chưa đăng vẫn xuất hiện
    // với engagement = 0 (xếp hạng kết hợp: tương tác trước, số bài sau). Tương tác = snapshot mới nhất mỗi bài.
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
            left join lateral (
                select s.views, s.reactions as likes, s.comments, s.shares
                from platform_media m
                join post_metric_snapshots s on s.platform_media_id = m.id and s.deleted_at is null
                where m.post_id = p.id and m.deleted_at is null
                order by s.collected_at desc
                limit 1
            ) la on true
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
     *   - typeCsv      null = mọi loại nội dung; khác null = nhãn IN HOA ("IMAGE,VIDEO"). Nhãn = loại bài THỰC SỰ
     *                  trên nền tảng: platform_media.media_type (nền tảng báo, mục 3.4 kế hoạch) — KHÔNG dùng
     *                  content_versions.media_format (định dạng media AI gợi ý, có thể là "video" dù bài chỉ có chữ).
     *                  Bài AIMA chưa có nhãn nền tảng = TEXT (AIMA hiện chỉ đăng bài chữ); bài ngoài không rõ = OTHER.
     *   - origin       null = toàn bộ bài của Trang (mặc định, chốt Q5); 'AIMA' = chỉ bài đăng qua AIMA.
     * CAST(:param AS text) là bắt buộc để PostgreSQL suy được kiểu khi bind null.
     *
     * Các truy vấn "bài ĐĂNG trong kỳ" (khối E/F/G/H, export) đi từ platform_media (giai đoạn 2) để gồm cả bài
     * ngoài AIMA (post_id null); bài AIMA phải còn sống (POSTED, chưa xoá mềm, lịch còn). Số liệu = snapshot MỚI
     * NHẤT của bài (LATERAL … LIMIT 1).
     */

    // Trang Phân tích (UI-08 khối B/C): 4 metric PHÁT SINH theo ngày trong [from, to) — cộng delta của
    // post_metrics_daily (giờ Việt Nam), KHÔNG còn theo ngày đăng (quyết định Q4, docs/analytics-real-data-plan.md).
    // likes = reactions (FB: mọi cảm xúc). Gồm cả bài ngoài AIMA trừ khi lọc origin.
    @Query(value = """
            select to_char(d.metric_date, 'YYYY-MM-DD') as day,
                   cast(coalesce(sum(d.views_delta), 0) as bigint) as views,
                   cast(coalesce(sum(d.reactions_delta), 0) as bigint) as likes,
                   cast(coalesce(sum(d.comments_delta), 0) as bigint) as comments,
                   cast(coalesce(sum(d.shares_delta), 0) as bigint) as shares,
                   coalesce(bool_or(d.is_estimated), false) as estimated
            from post_metrics_daily d
            join platform_media m on m.id = d.platform_media_id and m.deleted_at is null
            join platform_accounts pa on pa.id = m.platform_account_id and pa.deleted_at is null
            left join posts p on p.id = m.post_id
            where pa.user_id = :userId
              and d.deleted_at is null
              and (p.id is null or p.deleted_at is null)
              and d.metric_date >= cast(:from as date)
              and d.metric_date < cast(:to as date)
              and (cast(:platformCsv as text) is null
                   or m.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or coalesce(m.media_type, case when m.origin = 'AIMA' then 'TEXT' end, 'OTHER')
                       = any(string_to_array(cast(:typeCsv as text), ',')))
              and (cast(:origin as text) is null or m.origin = cast(:origin as text))
            group by 1
            order by 1
            """, nativeQuery = true)
    List<DailyEngagementProjection> findDailyEngagementForUser(@Param("userId") UUID userId,
                                                               @Param("from") LocalDateTime from,
                                                               @Param("to") LocalDateTime to,
                                                               @Param("platformCsv") String platformCsv,
                                                               @Param("typeCsv") String typeCsv,
                                                               @Param("origin") String origin);

    // Khối D — số liệu PHÁT SINH trong [from, to) gộp theo TỪNG nền tảng (cùng nguồn delta với KPI). CỐ Ý
    // không nhận platformCsv: donut thể hiện tỷ trọng GIỮA các nền tảng nên luôn tính tất cả; service tự bổ
    // sung nền tảng chưa có số. Vẫn áp lọc LOẠI NỘI DUNG và NGUỒN BÀI vì đó là chiều khác.
    @Query(value = """
            select m.platform_name as platform,
                   cast(coalesce(sum(d.views_delta), 0) as bigint) as views,
                   cast(coalesce(sum(d.reactions_delta), 0) as bigint) as likes,
                   cast(coalesce(sum(d.comments_delta), 0) as bigint) as comments,
                   cast(coalesce(sum(d.shares_delta), 0) as bigint) as shares,
                   cast(coalesce(sum(d.reactions_delta + d.comments_delta + d.shares_delta), 0) as bigint) as engagement
            from post_metrics_daily d
            join platform_media m on m.id = d.platform_media_id and m.deleted_at is null
            join platform_accounts pa on pa.id = m.platform_account_id and pa.deleted_at is null
            left join posts p on p.id = m.post_id
            where pa.user_id = :userId
              and d.deleted_at is null
              and (p.id is null or p.deleted_at is null)
              and d.metric_date >= cast(:from as date)
              and d.metric_date < cast(:to as date)
              and (cast(:typeCsv as text) is null
                   or coalesce(m.media_type, case when m.origin = 'AIMA' then 'TEXT' end, 'OTHER')
                       = any(string_to_array(cast(:typeCsv as text), ',')))
              and (cast(:origin as text) is null or m.origin = cast(:origin as text))
            group by m.platform_name
            """, nativeQuery = true)
    List<PlatformMetricProjection> findPlatformMetricsForUser(@Param("userId") UUID userId,
                                                              @Param("from") LocalDateTime from,
                                                              @Param("to") LocalDateTime to,
                                                              @Param("typeCsv") String typeCsv,
                                                              @Param("origin") String origin);

    // Khối F — số liệu gộp theo TỪNG loại nội dung của bài đăng trong [from, to). Đối xứng với khối D: CỐ Ý không
    // nhận typeCsv (donut là tỷ trọng giữa các loại), nhưng vẫn áp lọc NỀN TẢNG và NGUỒN BÀI.
    @Query(value = """
            select coalesce(m.media_type, case when m.origin = 'AIMA' then 'TEXT' end, 'OTHER') as label,
                   count(*) as posts,
                   cast(coalesce(sum(la.views), 0) as bigint) as views,
                   cast(coalesce(sum(la.likes), 0) as bigint) as likes,
                   cast(coalesce(sum(la.comments), 0) as bigint) as comments,
                   cast(coalesce(sum(la.shares), 0) as bigint) as shares,
                   cast(coalesce(sum(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                                     + coalesce(la.shares, 0)), 0) as bigint) as engagement
            from platform_media m
            join platform_accounts pa on pa.id = m.platform_account_id and pa.deleted_at is null
            left join posts p on p.id = m.post_id
            left join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            left join lateral (
                select s.views, s.reactions as likes, s.comments, s.shares, s.source
                from post_metric_snapshots s
                where s.platform_media_id = m.id and s.deleted_at is null
                order by s.collected_at desc
                limit 1
            ) la on true
            where pa.user_id = :userId
              and m.deleted_at is null
              and (p.id is null or (p.deleted_at is null and p.status = 'POSTED' and ps.id is not null))
              and m.published_at is not null
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') >= :from
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') < :to
              and (cast(:platformCsv as text) is null
                   or m.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:origin as text) is null or m.origin = cast(:origin as text))
            group by 1
            order by engagement desc
            """, nativeQuery = true)
    List<ContentTypeMetricProjection> findContentTypeMetricsForUser(@Param("userId") UUID userId,
                                                                    @Param("from") LocalDateTime from,
                                                                    @Param("to") LocalDateTime to,
                                                                    @Param("platformCsv") String platformCsv,
                                                                    @Param("origin") String origin);

    // Khối G — heatmap: gộp theo (thứ ISO, khung 3 giờ) của giờ ĐĂNG (giờ Việt Nam). Chỉ trả ô CÓ bài; ô vắng
    // mặt nghĩa là "chưa từng đăng khung đó" — khác hẳn ô đăng rồi mà không ai tương tác.
    @Query(value = """
            select cast(extract(isodow from (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh')) as int) as dow,
                   cast(floor(extract(hour from (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh')) / 3) as int) as slot,
                   count(*) as posts,
                   cast(coalesce(sum(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                                     + coalesce(la.shares, 0)), 0) as bigint) as engagement
            from platform_media m
            join platform_accounts pa on pa.id = m.platform_account_id and pa.deleted_at is null
            left join posts p on p.id = m.post_id
            left join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            left join lateral (
                select s.views, s.reactions as likes, s.comments, s.shares, s.source
                from post_metric_snapshots s
                where s.platform_media_id = m.id and s.deleted_at is null
                order by s.collected_at desc
                limit 1
            ) la on true
            where pa.user_id = :userId
              and m.deleted_at is null
              and (p.id is null or (p.deleted_at is null and p.status = 'POSTED' and ps.id is not null))
              and m.published_at is not null
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') >= :from
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') < :to
              and (cast(:platformCsv as text) is null
                   or m.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or coalesce(m.media_type, case when m.origin = 'AIMA' then 'TEXT' end, 'OTHER')
                       = any(string_to_array(cast(:typeCsv as text), ',')))
              and (cast(:origin as text) is null or m.origin = cast(:origin as text))
            group by 1, 2
            """, nativeQuery = true)
    List<HeatmapCellProjection> findHeatmapForUser(@Param("userId") UUID userId,
                                                   @Param("from") LocalDateTime from,
                                                   @Param("to") LocalDateTime to,
                                                   @Param("platformCsv") String platformCsv,
                                                   @Param("typeCsv") String typeCsv,
                                                   @Param("origin") String origin);

    // Export — đếm TRƯỚC khi nạp để chặn ở trần thay vì cắt cụt im lặng (cùng cách export log hoạt động).
    @Query(value = """
            select count(*)
            from platform_media m
            join platform_accounts pa on pa.id = m.platform_account_id and pa.deleted_at is null
            left join posts p on p.id = m.post_id
            left join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            where pa.user_id = :userId
              and m.deleted_at is null
              and (p.id is null or (p.deleted_at is null and p.status = 'POSTED' and ps.id is not null))
              and m.published_at is not null
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') >= :from
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') < :to
              and (cast(:platformCsv as text) is null
                   or m.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or coalesce(m.media_type, case when m.origin = 'AIMA' then 'TEXT' end, 'OTHER')
                       = any(string_to_array(cast(:typeCsv as text), ',')))
              and (cast(:origin as text) is null or m.origin = cast(:origin as text))
            """, nativeQuery = true)
    long countPostsForUser(@Param("userId") UUID userId,
                           @Param("from") LocalDateTime from,
                           @Param("to") LocalDateTime to,
                           @Param("platformCsv") String platformCsv,
                           @Param("typeCsv") String typeCsv,
                           @Param("origin") String origin);

    // Khối H — một dòng / bài đã đăng trong kỳ: tương tác để so với mức trung bình kỳ, và lượt xem
    // GIỮ NGUYÊN null (không coalesce về 0) vì "nền tảng không trả lượt xem" khác "0 lượt xem" —
    // tỷ lệ tương tác phải loại các bài đó khỏi mẫu số.
    @Query(value = """
            select cast(coalesce(la.likes, 0) + coalesce(la.comments, 0)
                        + coalesce(la.shares, 0) as bigint) as engagement,
                   la.views as views
            from platform_media m
            join platform_accounts pa on pa.id = m.platform_account_id and pa.deleted_at is null
            left join posts p on p.id = m.post_id
            left join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            left join lateral (
                select s.views, s.reactions as likes, s.comments, s.shares, s.source
                from post_metric_snapshots s
                where s.platform_media_id = m.id and s.deleted_at is null
                order by s.collected_at desc
                limit 1
            ) la on true
            where pa.user_id = :userId
              and m.deleted_at is null
              and (p.id is null or (p.deleted_at is null and p.status = 'POSTED' and ps.id is not null))
              and m.published_at is not null
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') >= :from
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') < :to
              and (cast(:platformCsv as text) is null
                   or m.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or coalesce(m.media_type, case when m.origin = 'AIMA' then 'TEXT' end, 'OTHER')
                       = any(string_to_array(cast(:typeCsv as text), ',')))
              and (cast(:origin as text) is null or m.origin = cast(:origin as text))
            """, nativeQuery = true)
    List<PostEngagementProjection> findPostEngagementForUser(@Param("userId") UUID userId,
                                                             @Param("from") LocalDateTime from,
                                                             @Param("to") LocalDateTime to,
                                                             @Param("platformCsv") String platformCsv,
                                                             @Param("typeCsv") String typeCsv,
                                                             @Param("origin") String origin);

    // Khối E — bài đã đăng trong [from, to) kèm snapshot MỚI NHẤT. Bài AIMA: caption/contentItemId từ
    // content_versions (LEFT JOIN để bài không biến mất nếu bản định dạng bị xoá mềm); bài ngoài AIMA: trích caption
    // do nền tảng trả + permalink. Sắp xếp theo cột do service quyết định (whitelist) nên ở đây chỉ ORDER BY ngày
    // đăng làm thứ tự nạp mặc định.
    @Query(value = """
            select m.id as mediaId,
                   p.id as postId,
                   cv.content_item_id as contentItemId,
                   m.platform_name as platform,
                   coalesce(cv.formatted_caption, m.caption_excerpt) as caption,
                   pa.account_name as accountName,
                   (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') as publishedAt,
                   la.views as views,
                   cast(coalesce(la.likes, 0) as bigint) as likes,
                   cast(coalesce(la.comments, 0) as bigint) as comments,
                   cast(coalesce(la.shares, 0) as bigint) as shares,
                   cast(coalesce(la.likes, 0) + coalesce(la.comments, 0) + coalesce(la.shares, 0) as bigint) as engagement,
                   coalesce(la.source = 'BACKFILL', false) as legacyOnly,
                   m.origin as origin,
                   m.permalink as permalink,
                   m.platform_status as platformStatus
            from platform_media m
            join platform_accounts pa on pa.id = m.platform_account_id and pa.deleted_at is null
            left join posts p on p.id = m.post_id
            left join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            left join lateral (
                select s.views, s.reactions as likes, s.comments, s.shares, s.source
                from post_metric_snapshots s
                where s.platform_media_id = m.id and s.deleted_at is null
                order by s.collected_at desc
                limit 1
            ) la on true
            where pa.user_id = :userId
              and m.deleted_at is null
              and (p.id is null or (p.deleted_at is null and p.status = 'POSTED' and ps.id is not null))
              and m.published_at is not null
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') >= :from
              and (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') < :to
              and (cast(:platformCsv as text) is null
                   or m.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or coalesce(m.media_type, case when m.origin = 'AIMA' then 'TEXT' end, 'OTHER')
                       = any(string_to_array(cast(:typeCsv as text), ',')))
              and (cast(:origin as text) is null or m.origin = cast(:origin as text))
            order by (m.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh') desc
            """, nativeQuery = true)
    List<TopPostProjection> findTopPostsForUser(@Param("userId") UUID userId,
                                                @Param("from") LocalDateTime from,
                                                @Param("to") LocalDateTime to,
                                                @Param("platformCsv") String platformCsv,
                                                @Param("typeCsv") String typeCsv,
                                                @Param("origin") String origin);
}
