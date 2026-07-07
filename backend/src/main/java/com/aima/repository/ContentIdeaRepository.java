package com.aima.repository;

import com.aima.entity.ContentIdea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ContentIdeaRepository extends JpaRepository<ContentIdea, UUID> {

    /**
     * Ý tưởng content theo id nhưng CHỈ khi thuộc user (qua trend → phiên research → brand
     * profile) và chưa soft-delete — dùng khi resolve idea gắn vào job tạo nội dung.
     */
    Optional<ContentIdea> findByIdAndTrend_ResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);
}
