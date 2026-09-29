package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Provider trả về FE — KHÔNG bao giờ mang full API key (SEC-03):
 * chỉ {@code apiKeyMasked} dạng "••••" + 4 ký tự cuối; null = chưa cấu hình key.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiProviderResponse {

    UUID id;

    String code;

    String name;

    String apiKeyMasked;

    Boolean enabled;

    LocalDateTime lastTestedAt;

    String lastTestStatus;

    /** Từng gặp 429 FreeTier (Google) — hiện banner "đang dùng gói miễn phí". null = chưa. */
    LocalDateTime freeTierDetectedAt;

    LocalDateTime updatedAt;

    /**
     * Catalog model đã đồng bộ từ API provider (kèm giá GỢI Ý join từ bảng giá tự bảo trì);
     * null = chưa đồng bộ lần nào. Thứ tự như provider trả (Anthropic: mới nhất trước).
     */
    List<AiCatalogModelResponse> modelCatalog;

    LocalDateTime modelCatalogSyncedAt;

    /** Số nghiệp vụ có model chính/dự phòng thuộc provider này — cảnh báo trước khi tắt. */
    Integer dependentTaskCount;
}
