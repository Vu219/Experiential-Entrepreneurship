package com.aima.repository;

import com.aima.entity.AiProvider;
import com.aima.enums.AiProviderCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiProviderRepository extends JpaRepository<AiProvider, UUID> {

    Optional<AiProvider> findByCodeAndDeletedAtIsNull(AiProviderCode code);

    Optional<AiProvider> findByIdAndDeletedAtIsNull(UUID id);

    List<AiProvider> findByDeletedAtIsNullOrderByCodeAsc();
}
