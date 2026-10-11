package com.aima.repository;

import com.aima.entity.PublishErrorMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PublishErrorMappingRepository extends JpaRepository<PublishErrorMapping, UUID> {

    List<PublishErrorMapping> findByDeletedAtIsNullOrderByCreatedAtDesc();

    Optional<PublishErrorMapping> findByIdAndDeletedAtIsNull(UUID id);
}
