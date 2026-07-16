package com.aima.repository;

import com.aima.entity.AiModel;
import com.aima.entity.AiProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiModelRepository extends JpaRepository<AiModel, UUID> {

    Optional<AiModel> findByProviderAndModelCodeAndDeletedAtIsNull(AiProvider provider, String modelCode);

    Optional<AiModel> findByIdAndDeletedAtIsNull(UUID id);

    List<AiModel> findByDeletedAtIsNullOrderByModelCodeAsc();

    /** Model để chạy "Kiểm tra kết nối" của một provider — lấy model bật cũ nhất cho ổn định. */
    Optional<AiModel> findFirstByProviderAndEnabledTrueAndDeletedAtIsNullOrderByCreatedAtAsc(AiProvider provider);
}
