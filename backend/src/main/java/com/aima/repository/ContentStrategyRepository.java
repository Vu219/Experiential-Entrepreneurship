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
    Optional<ContentStrategy> findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(UUID brandId, StrategyStatus status);

    // Badge "N chiến lược" trên card hồ sơ thương hiệu (strategyCount trong BrandProfileResponse).
    long countByBrandProfile_IdAndDeletedAtIsNull(UUID brandId);

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
}
