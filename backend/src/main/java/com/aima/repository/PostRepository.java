package com.aima.repository;

import com.aima.entity.Post;
import com.aima.enums.PostStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PostRepository extends JpaRepository<Post, UUID> {

    // FR-59: bài POSTED đã qua mốc :milestone giờ mà CHƯA có bản ghi analytics của mốc đó.
    @Query("select p from Post p where p.status = com.aima.enums.PostStatus.POSTED and p.deletedAt is null "
            + "and p.publishedAt is not null and p.publishedAt <= :threshold "
            + "and not exists (select a from PostAnalytics a where a.post = p "
            + "and a.milestoneHours = :milestone and a.deletedAt is null)")
    List<Post> findDueForAnalytics(@Param("milestone") int milestone, @Param("threshold") LocalDateTime threshold);

    // API-03/SEC-04: bài đăng của user (qua schedule → platform account).
    Page<Post> findByStatusAndSchedule_PlatformAccount_User_IdAndDeletedAtIsNullOrderByPublishedAtDesc(
            PostStatus status, UUID userId, Pageable pageable);

    Optional<Post> findByIdAndSchedule_PlatformAccount_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    // FR-63..FR-65: bài đã đăng của một brand profile (qua version → item) cho luồng tối ưu chiến lược.
    List<Post> findBySchedule_ContentVersion_ContentItem_BrandProfile_IdAndStatusAndDeletedAtIsNullOrderByPublishedAtDesc(
            UUID brandProfileId, PostStatus status);

    boolean existsBySchedule_ContentVersion_ContentItem_BrandProfile_IdAndStatusAndDeletedAtIsNullAndPostAnalyticsIsNotEmpty(
            UUID brandProfileId, PostStatus status);

    // FR-82/FR-83: admin xem bài thất bại; violationOnly = true → chỉ bài bị từ chối do vi phạm chính sách.
    @Query("select p from Post p where p.status = com.aima.enums.PostStatus.FAILED and p.deletedAt is null "
            + "and (:violationOnly = false or exists (select j from PostingJob j where j.post = p "
            + "and j.errorType = com.aima.enums.PublishErrorType.POLICY_VIOLATION)) "
            + "order by p.updatedAt desc")
    Page<Post> findFailedForAdmin(@Param("violationOnly") boolean violationOnly, Pageable pageable);

    /*
     * FR-82/FR-83 (trang admin đầy đủ): cùng tập bài với findFailedForAdmin nhưng lọc/tìm/sắp xếp
     * server-side. Native vì mốc thời gian của bài lỗi là `failedAt` = end_time của job FAILED muộn
     * nhất (không phải một cột trên `posts`) — JPQL không sắp xếp/lọc theo giá trị dẫn xuất đó được.
     * Lùi về p.updated_at khi bài chưa có job FAILED nào, để không bài nào biến mất khỏi danh sách.
     *
     * Mọi tham số optional đều CAST(:x AS ...) trước khi so sánh với NULL — PostgreSQL không suy được
     * kiểu của bind parameter trần trong biểu thức `is null`.
     */
    String FAILED_ADMIN_FROM = """
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            join users u on u.id = pa.user_id
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            cross join lateral (
                select coalesce(max(j.end_time), p.updated_at) as failed_at
                from posting_jobs j
                where j.post_id = p.id and j.status = 'FAILED'
            ) lj
            where p.deleted_at is null
              and p.status = 'FAILED'
              and (cast(:mode as text) = 'ALL'
                   or (cast(:mode as text) = 'POLICY' and exists (
                        select 1 from posting_jobs j where j.post_id = p.id
                          and j.error_type = 'POLICY_VIOLATION'))
                   or (cast(:mode as text) = 'TECHNICAL' and not exists (
                        select 1 from posting_jobs j where j.post_id = p.id
                          and j.error_type = 'POLICY_VIOLATION')))
              and (cast(:platform as text) is null or p.platform_name = cast(:platform as text))
              and (cast(:errorType as text) is null or exists (
                    select 1 from posting_jobs j where j.post_id = p.id
                      and j.error_type = cast(:errorType as text)))
              and (cast(:q as text) is null
                   or lower(coalesce(cv.formatted_caption, '')) like lower(concat('%', cast(:q as text), '%'))
                   or lower(u.email) like lower(concat('%', cast(:q as text), '%'))
                   or lower(coalesce(pa.account_name, '')) like lower(concat('%', cast(:q as text), '%')))
              and (cast(:from as timestamp) is null or lj.failed_at >= cast(:from as timestamp))
              and (cast(:to as timestamp) is null or lj.failed_at < cast(:to as timestamp))
            """;

    @Query(value = "select p.* " + FAILED_ADMIN_FROM
            + """
            order by case when cast(:asc as boolean) then lj.failed_at end asc nulls last,
                     case when not cast(:asc as boolean) then lj.failed_at end desc nulls last,
                     p.id desc
            """,
            countQuery = "select count(*) " + FAILED_ADMIN_FROM,
            nativeQuery = true)
    Page<Post> searchFailedForAdmin(@Param("mode") String mode,
                                    @Param("platform") String platform,
                                    @Param("errorType") String errorType,
                                    @Param("q") String q,
                                    @Param("from") LocalDateTime from,
                                    @Param("to") LocalDateTime to,
                                    @Param("asc") boolean asc,
                                    Pageable pageable);

    @Query(value = "select count(*) " + FAILED_ADMIN_FROM, nativeQuery = true)
    long countFailedForAdmin(@Param("mode") String mode,
                             @Param("platform") String platform,
                             @Param("errorType") String errorType,
                             @Param("q") String q,
                             @Param("from") LocalDateTime from,
                             @Param("to") LocalDateTime to);

    /*
     * Khối 4 thẻ KPI: gom theo NGÀY thất bại trong [from, to). Mỗi ngày một dòng
     * [day, total, policy, temporary, permanent, affectedUsers, affectedUsersTechnical].
     *
     * Lỗi kỹ thuật = total - policy (không cột riêng để hai con số không bao giờ lệch nhau).
     * `temporary`/`permanent` đọc errorType của job FAILED MUỐN NHẤT — đúng job mà bảng danh sách
     * đang hiển thị; hai số này CỐ Ý không cộng lại thành `technical` vì job có errorType null sẽ
     * không rơi vào ô nào (thà thiếu còn hơn gán bừa).
     *
     * Các cột `affected*` là distinct THEO NGÀY (chỉ để lấy hình dạng sparkline); distinct cho cả
     * kỳ phải hỏi countAffectedUsersForAdmin — cộng dồn theo ngày sẽ đếm trùng người dùng.
     */
    @Query(value = """
            select cast(x.failed_at as date) as day,
                   count(*) as total,
                   sum(case when x.is_policy then 1 else 0 end) as policy,
                   sum(case when not x.is_policy and x.last_error_type = 'TEMPORARY' then 1 else 0 end) as temporary_count,
                   sum(case when not x.is_policy and x.last_error_type = 'PERMANENT' then 1 else 0 end) as permanent_count,
                   count(distinct x.user_id) as affected_users,
                   count(distinct case when not x.is_policy then x.user_id end) as affected_users_technical
            from (
                select p.id as id,
                       pa.user_id as user_id,
                       coalesce((select max(j.end_time) from posting_jobs j
                                 where j.post_id = p.id and j.status = 'FAILED'), p.updated_at) as failed_at,
                       exists (select 1 from posting_jobs j2 where j2.post_id = p.id
                               and j2.error_type = 'POLICY_VIOLATION') as is_policy,
                       (select j3.error_type from posting_jobs j3
                        where j3.post_id = p.id and j3.status = 'FAILED'
                        order by j3.end_time desc nulls last limit 1) as last_error_type
                from posts p
                join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
                join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
                where p.deleted_at is null and p.status = 'FAILED'
            ) x
            where x.failed_at >= :from and x.failed_at < :to
            group by cast(x.failed_at as date)
            order by 1
            """, nativeQuery = true)
    List<Object[]> countFailedForAdminByDay(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * Số người dùng RIÊNG BIỆT có bài lỗi trong kỳ — không suy được từ tổng theo ngày.
     * `technicalOnly` = true thì chỉ tính bài KHÔNG vi phạm chính sách (tab "Lỗi hệ thống").
     */
    @Query(value = """
            select count(distinct pa.user_id)
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            where p.deleted_at is null and p.status = 'FAILED'
              and (:technicalOnly = false or not exists (
                    select 1 from posting_jobs j0 where j0.post_id = p.id
                      and j0.error_type = 'POLICY_VIOLATION'))
              and coalesce((select max(j.end_time) from posting_jobs j
                            where j.post_id = p.id and j.status = 'FAILED'), p.updated_at) >= :from
              and coalesce((select max(j.end_time) from posting_jobs j
                            where j.post_id = p.id and j.status = 'FAILED'), p.updated_at) < :to
            """, nativeQuery = true)
    long countAffectedUsersForAdmin(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                                    @Param("technicalOnly") boolean technicalOnly);

    // FR-35..FR-39: bài lỗi CHƯA xử lý của CHÍNH user (trang "Bài lỗi & cần xử lý"), lọc phân loại
    // mode = ALL | POLICY (vi phạm chính sách) | TECHNICAL (lỗi kỹ thuật — không phải vi phạm).
    // Chỉ tính lịch còn FAILED: hủy/đặt lại/đăng lại sẽ đổi schedule khỏi FAILED → tự rời danh sách.
    @Query("select p from Post p where p.status = com.aima.enums.PostStatus.FAILED and p.deletedAt is null "
            + "and p.schedule.status = com.aima.enums.ScheduleStatus.FAILED "
            + "and p.schedule.platformAccount.user.id = :userId "
            + "and (:mode = 'ALL' "
            + "  or (:mode = 'POLICY' and exists (select j from PostingJob j where j.post = p "
            + "      and j.errorType = com.aima.enums.PublishErrorType.POLICY_VIOLATION)) "
            + "  or (:mode = 'TECHNICAL' and not exists (select j from PostingJob j where j.post = p "
            + "      and j.errorType = com.aima.enums.PublishErrorType.POLICY_VIOLATION))) "
            + "order by p.updatedAt desc")
    Page<Post> findFailedForUser(@Param("userId") UUID userId, @Param("mode") String mode, Pageable pageable);

    // Khối "Tổng quan lỗi": tổng bài lỗi + số bài vi phạm chính sách (kỹ thuật = tổng - policy).
    @Query("select count(p) from Post p where p.status = com.aima.enums.PostStatus.FAILED and p.deletedAt is null "
            + "and p.schedule.status = com.aima.enums.ScheduleStatus.FAILED "
            + "and p.schedule.platformAccount.user.id = :userId")
    long countFailedForUser(@Param("userId") UUID userId);

    @Query("select count(p) from Post p where p.status = com.aima.enums.PostStatus.FAILED and p.deletedAt is null "
            + "and p.schedule.status = com.aima.enums.ScheduleStatus.FAILED "
            + "and p.schedule.platformAccount.user.id = :userId "
            + "and exists (select j from PostingJob j where j.post = p "
            + "and j.errorType = com.aima.enums.PublishErrorType.POLICY_VIOLATION)")
    long countPolicyFailedForUser(@Param("userId") UUID userId);

    // Trang Phân tích, ô "Bài lỗi & cần xử lý" (khối H): cùng tập bài với findFailedForUser nhưng
    // giới hạn theo kỳ [from, to). Mốc thời gian là THỜI ĐIỂM THẤT BẠI = end_time của job FAILED muộn
    // nhất — đúng trường `failedAt` mà trang "Bài lỗi & cần xử lý" đang lọc, để hai màn hình cho ra
    // cùng một con số (bài lỗi không có published_at nên không thể lọc theo ngày đăng).
    @Query(value = """
            select count(*)
            from posts p
            join post_schedules ps on ps.id = p.schedule_id and ps.deleted_at is null
            join platform_accounts pa on pa.id = ps.platform_account_id and pa.deleted_at is null
            left join content_versions cv on cv.id = ps.content_version_id and cv.deleted_at is null
            where pa.user_id = :userId
              and p.deleted_at is null
              and p.status = 'FAILED'
              and ps.status = 'FAILED'
              and (cast(:platformCsv as text) is null
                   or p.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
              and (cast(:typeCsv as text) is null
                   or upper(coalesce(nullif(trim(cv.media_format), ''), 'OTHER'))
                       = any(string_to_array(cast(:typeCsv as text), ',')))
              and exists (
                  select 1 from (
                      select max(j.end_time) as failed_at
                      from posting_jobs j
                      where j.post_id = p.id and j.status = 'FAILED'
                  ) lj
                  where lj.failed_at >= :from and lj.failed_at < :to
              )
            """, nativeQuery = true)
    long countFailedForUserInRange(@Param("userId") UUID userId,
                                   @Param("from") LocalDateTime from,
                                   @Param("to") LocalDateTime to,
                                   @Param("platformCsv") String platformCsv,
                                   @Param("typeCsv") String typeCsv);

    long countByStatusAndPublishedAtAfterAndDeletedAtIsNull(PostStatus status, LocalDateTime after);

    long countByStatusAndUpdatedAtAfterAndDeletedAtIsNull(PostStatus status, LocalDateTime after);

    // Webhook vi phạm sau khi đăng: tra bài theo id trên nền tảng.
    Optional<Post> findByPlatformPostIdAndDeletedAtIsNull(String platformPostId);
}
