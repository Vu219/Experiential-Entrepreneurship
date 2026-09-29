package com.aima.repository;

import com.aima.entity.AiProvider;
import com.aima.enums.AiProviderCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiProviderRepository extends JpaRepository<AiProvider, UUID> {

    Optional<AiProvider> findByCodeAndDeletedAtIsNull(AiProviderCode code);

    Optional<AiProvider> findByIdAndDeletedAtIsNull(UUID id);

    List<AiProvider> findByDeletedAtIsNullOrderByCodeAsc();

    /** Đánh dấu lần đầu gặp 429 FreeTier — no-op nếu đã đánh dấu (không ghi mỗi lần gọi AI). */
    @Transactional
    @Modifying
    @Query("""
            update AiProvider p set p.freeTierDetectedAt = :at
            where p.code = :code and p.deletedAt is null and p.freeTierDetectedAt is null
            """)
    int markFreeTierDetected(@Param("code") AiProviderCode code, @Param("at") LocalDateTime at);
}
