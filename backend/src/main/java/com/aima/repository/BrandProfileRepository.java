package com.aima.repository;

import com.aima.entity.BrandProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BrandProfileRepository extends JpaRepository<BrandProfile, UUID> {
    List<BrandProfile> findByUser_IdAndDeletedAtIsNull(UUID userId);
    Optional<BrandProfile> findByIdAndUser_IdAndDeletedAtIsNull(UUID id, UUID userId);
    Optional<BrandProfile> findFirstByUser_IdAndIsActiveTrueAndDeletedAtIsNull(UUID userId);

    // Phân trang + lọc server-side cho tab Thương hiệu (q rỗng / industry rỗng = bỏ qua điều kiện).
    @Query("""
            select b from BrandProfile b
            where b.user.id = :userId and b.deletedAt is null
              and (:industry = '' or b.industry = :industry)
              and (:q = '' or lower(b.brandName) like lower(concat('%', :q, '%')))
            """)
    Page<BrandProfile> search(@Param("userId") UUID userId,
                              @Param("q") String q,
                              @Param("industry") String industry,
                              Pageable pageable);

    // Nguồn cho dropdown lọc ngành hàng (toàn bộ ngành user đang dùng, không phụ thuộc trang hiện tại).
    @Query("""
            select distinct b.industry from BrandProfile b
            where b.user.id = :userId and b.deletedAt is null
            order by b.industry
            """)
    List<String> findDistinctIndustriesByUserId(@Param("userId") UUID userId);
}
