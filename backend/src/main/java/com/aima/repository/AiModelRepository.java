package com.aima.repository;

import com.aima.entity.AiModel;
import com.aima.entity.AiProvider;
import com.aima.enums.AiProviderCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiModelRepository extends JpaRepository<AiModel, UUID> {

    Optional<AiModel> findByProviderAndModelCodeAndDeletedAtIsNull(AiProvider provider, String modelCode);

    Optional<AiModel> findByIdAndDeletedAtIsNull(UUID id);

    /** Model theo mã provider + model code (đơn giá của model THỰC SỰ trả lời — ghi ai_usage). */
    Optional<AiModel> findFirstByProvider_CodeAndModelCodeAndDeletedAtIsNull(AiProviderCode providerCode, String modelCode);

    List<AiModel> findByDeletedAtIsNullOrderByModelCodeAsc();

    /** Model để chạy "Kiểm tra kết nối" của một provider — lấy model bật cũ nhất cho ổn định. */
    Optional<AiModel> findFirstByProviderAndEnabledTrueAndDeletedAtIsNullOrderByCreatedAtAsc(AiProvider provider);
}
