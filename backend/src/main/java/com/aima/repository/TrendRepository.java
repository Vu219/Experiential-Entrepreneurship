package com.aima.repository;

import com.aima.entity.Trend;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TrendRepository extends JpaRepository<Trend, UUID> {

    /**
     * Trend theo id nhưng CHỈ khi thuộc user (qua phiên research → brand profile) và chưa
     * soft-delete — dùng khi resolve trend gắn vào job tạo nội dung (chống gắn id của người khác).
     */
    Optional<Trend> findByIdAndResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);
}
