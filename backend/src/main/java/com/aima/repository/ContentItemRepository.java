package com.aima.repository;

import com.aima.entity.ContentItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContentItemRepository extends JpaRepository<ContentItem, UUID> {

    // API-03/SEC-04: user chỉ thao tác trên nội dung thuộc brand profile của mình.
    Optional<ContentItem> findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);
}
