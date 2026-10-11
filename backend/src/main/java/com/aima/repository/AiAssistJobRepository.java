package com.aima.repository;

import com.aima.entity.AiAssistJob;
import com.aima.enums.AiAssistKind;
import com.aima.enums.GenerationJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface AiAssistJobRepository extends JpaRepository<AiAssistJob, UUID> {

    Optional<AiAssistJob> findByIdAndUser_IdAndDeletedAtIsNull(UUID id, UUID userId);

    /** Giới hạn số lần AI sửa mỗi bản nền tảng — job FAILED (lỗi AI/hạ tầng) không tính. */
    long countByContentVersion_IdAndKindAndStatusNotAndDeletedAtIsNull(UUID versionId, AiAssistKind kind,
                                                                        GenerationJobStatus status);

    /** Lượt kiểm tra chính sách bằng AI đã dùng trong tháng (hạn mức theo gói) — job FAILED không tính. */
    long countByUser_IdAndKindAndStatusNotAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(
            UUID userId, AiAssistKind kind, GenerationJobStatus status, LocalDateTime since);

    /** Cache kết quả kiểm tra theo hash nội dung: lần gần nhất của user cho đúng nội dung + nền tảng đó. */
    Optional<AiAssistJob> findFirstByUser_IdAndKindAndContentHashAndCreatedAtGreaterThanEqualAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID userId, AiAssistKind kind, String contentHash, LocalDateTime since);
}
