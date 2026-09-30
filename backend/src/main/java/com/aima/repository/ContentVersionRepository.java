package com.aima.repository;

import com.aima.entity.ContentVersion;
import com.aima.enums.Platform;
import com.aima.repository.projection.LabelCountProjection;
import com.aima.repository.projection.VersionPublishingState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContentVersionRepository extends JpaRepository<ContentVersion, UUID> {

    // API-03/SEC-04: user chỉ thao tác trên bản định dạng thuộc brand profile của mình.
    Optional<ContentVersion> findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    // Id bài của bản (có kiểm tra quyền sở hữu) — để khóa bài TRƯỚC khi nạp bản/lịch (thứ tự item → version).
    @Query("select v.contentItem.id from ContentVersion v "
            + "where v.id = :id and v.contentItem.brandProfile.user.id = :userId and v.deletedAt is null")
    Optional<UUID> findOwnedContentItemId(@Param("id") UUID id, @Param("userId") UUID userId);

    // B2: các bản còn hiệu lực của (bài, nền tảng) — retry/tạo lại thay bản cũ bằng xóa mềm.
    List<ContentVersion> findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(UUID contentItemId, Platform platformName);

    // Bảng điều khiển — donut "Loại nội dung": phân bổ theo định dạng media của các bản nền tảng.
    // mediaFormat có thể null (bản chưa định dạng) → service gộp vào nhóm "khác".
    @Query("""
            select v.mediaFormat as label, count(v) as total from ContentVersion v
            where v.contentItem.brandProfile.user.id = :userId
              and v.deletedAt is null and v.contentItem.deletedAt is null
              and v.contentItem.brandProfile.deletedAt is null
            group by v.mediaFormat
            order by count(v) desc
            """)
    List<LabelCountProjection> countByMediaFormatForUser(@Param("userId") UUID userId);

    // ContentItemStatusResolver: trạng thái sản xuất + lịch còn hiệu lực của từng bản chưa xóa mềm.
    // Trả scalar (không phải entity) để luôn đọc giá trị mới nhất từ DB thay vì persistence context.
    @Query("""
            select new com.aima.repository.projection.VersionPublishingState(v.status, s.status)
            from ContentVersion v
            left join PostSchedule s on s.contentVersion = v and s.deletedAt is null
                 and s.status <> com.aima.enums.ScheduleStatus.CANCELLED
            where v.contentItem.id = :itemId and v.deletedAt is null
            """)
    List<VersionPublishingState> findPublishingStates(@Param("itemId") UUID itemId);
}
