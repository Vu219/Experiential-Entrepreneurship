package com.aima.repository;

import com.aima.entity.Trend;
import com.aima.enums.Platform;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TrendRepository extends JpaRepository<Trend, UUID> {

    /**
     * Trend theo id nhưng CHỈ khi thuộc user (qua phiên research → brand profile) và chưa
     * soft-delete — dùng khi resolve trend gắn vào job tạo nội dung (chống gắn id của người khác).
     */
    Optional<Trend> findByIdAndResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    // Xóa nhiều trend không phù hợp (multi-select) — chỉ trend thuộc user, chưa soft-delete.
    List<Trend> findByIdInAndResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(Collection<UUID> ids, UUID userId);

    /** Một trend đã gợi ý ở phiên trước (kể cả trend user đã xóa — {@code deletedAt} != null). */
    interface PreviousTrendView {
        String getTrendName();

        LocalDateTime getResearchTime();

        LocalDateTime getDeletedAt();
    }

    // Trend các phiên COMPLETED gần đây của brand + nền tảng, mới nhất trước — gửi AI để chấm
    // momentum và tránh gợi ý lại trend user đã xóa (bảng trends không có SQLRestriction ở cấp entity).
    @Query("select t.trendName as trendName, s.researchTime as researchTime, t.deletedAt as deletedAt "
            + "from Trend t join t.researchSession s "
            + "where s.brandProfile.id = :brandId and s.platform = :platform "
            + "and s.status = com.aima.enums.ResearchStatus.COMPLETED and s.deletedAt is null "
            + "and s.researchTime >= :since order by s.researchTime desc")
    List<PreviousTrendView> findRecentForBrand(@Param("brandId") UUID brandId, @Param("platform") Platform platform,
                                               @Param("since") LocalDateTime since, Pageable pageable);
}
