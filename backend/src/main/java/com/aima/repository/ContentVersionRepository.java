package com.aima.repository;

import com.aima.entity.ContentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContentVersionRepository extends JpaRepository<ContentVersion, UUID> {

    // API-03/SEC-04: user chỉ thao tác trên bản định dạng thuộc brand profile của mình.
    Optional<ContentVersion> findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);
}
