package com.aima.repository;

import com.aima.entity.ContentStrategy;
import com.aima.enums.StrategyStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContentStrategyRepository extends JpaRepository<ContentStrategy, UUID> {
    Optional<ContentStrategy> findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);
    // Chiến lược user chọn khi bắt đầu trend research (phải thuộc đúng brand của phiên).
    Optional<ContentStrategy> findByIdAndBrandProfile_IdAndDeletedAtIsNull(UUID id, UUID brandId);
    Optional<ContentStrategy> findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(UUID brandId, StrategyStatus status);

    // Badge "N chiến lược" trên card hồ sơ thương hiệu (strategyCount trong BrandProfileResponse).
    long countByBrandProfile_IdAndDeletedAtIsNull(UUID brandId);

    // Bảng điều khiển — bước "Tạo chiến lược content" của tiến độ thiết lập (mọi hồ sơ của user).
    long countByBrandProfile_User_IdAndDeletedAtIsNull(UUID userId);

    // Phân trang + lọc server-side cho list chiến lược (tham số null/rỗng = bỏ qua điều kiện).
    @Query("""
            select s from ContentStrategy s
            where s.brandProfile.user.id = :userId and s.deletedAt is null
              and (:brandId is null or s.brandProfile.id = :brandId)
              and (:status is null or s.status = :status)
              and (:q = '' or lower(s.name) like lower(concat('%', :q, '%')))
            """)
    Page<ContentStrategy> search(@Param("userId") UUID userId,
                                 @Param("brandId") UUID brandId,
                                 @Param("status") StrategyStatus status,
                                 @Param("q") String q,
                                 Pageable pageable);

    // Ô tìm kiếm toàn cục (GET /search): chiến lược của user có tên khớp :q (SearchSql, không dấu).
    @Query(value = """
            select s.* from content_strategies s
            join brand_profiles bp on bp.id = s.brand_profile_id
            where bp.user_id = :userId and s.deleted_at is null and""" + SearchSql.STRATEGY_NAME_MATCHES + """
            order by coalesce(s.updated_at, s.created_at) desc
            """,
            countQuery = """
            select count(*) from content_strategies s
            join brand_profiles bp on bp.id = s.brand_profile_id
            where bp.user_id = :userId and s.deleted_at is null and""" + SearchSql.STRATEGY_NAME_MATCHES,
            nativeQuery = true)
    Page<ContentStrategy> searchName(@Param("userId") UUID userId, @Param("q") String q, Pageable pageable);
}
