package com.aima.service.Impl;

import com.aima.dto.publish.NormalizedPublishError;
import com.aima.dto.publish.PlatformErrorDetail;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishErrorMapping;
import com.aima.entity.PublishResult;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorType;
import com.aima.exception.PublishException;
import com.aima.repository.PublishErrorMappingRepository;
import com.aima.service.PublishErrorNormalizer;
import com.aima.util.PublishErrorRules;
import com.aima.util.SensitiveDataRedactor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Chuẩn hoá lỗi đăng bài. Ánh xạ admin đọc qua cache thủ công 5 phút (mẫu {@code PlatformVersionServiceImpl},
 * không cache manager); lỗi đọc DB → bỏ qua ánh xạ, dùng luật mặc định (không bao giờ làm hỏng luồng ghi lỗi).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PublishErrorNormalizerImpl implements PublishErrorNormalizer {

    static final Duration MAPPING_CACHE_TTL = Duration.ofMinutes(5);
    /** Trần độ dài JSON chi tiết lưu vào {@code posting_jobs.error_detail}. */
    static final int DETAIL_MAX_LENGTH = 4000;

    PublishErrorMappingRepository mappingRepository;
    ObjectMapper objectMapper;

    @NonFinal
    volatile CachedMappings cachedMappings;

    private record CachedMappings(List<PublishErrorMapping> mappings, Instant cachedAt) {
        boolean fresh() {
            return Duration.between(cachedAt, Instant.now()).compareTo(MAPPING_CACHE_TTL) < 0;
        }
    }

    @Override
    public NormalizedPublishError normalize(Platform platform, PublishException exception) {
        String responseCode = exception.getResponseCode();
        PlatformErrorDetail detail = exception.getDetail();
        PublishErrorCode internal = PublishErrorRules.classifyInternal(responseCode);

        PublishErrorCode code;
        if (internal != null) {
            code = internal;
        } else {
            PlatformErrorDetail effective = detail != null ? detail : new PlatformErrorDetail(platform, null,
                    parseInt(responseCode), null, null, exception.getMessage(), null, null, null,
                    exception.getErrorType() == PublishErrorType.TEMPORARY, null);
            PublishErrorCode mapped = mapped(platform, responseCode,
                    effective.subcode() == null ? null : String.valueOf(effective.subcode()), effective.message());
            code = mapped != null ? mapped : PublishErrorRules.classify(effective);
        }

        String subcode = detail == null || detail.subcode() == null ? null : String.valueOf(detail.subcode());
        Duration retryAfter = detail == null || detail.retryAfterSeconds() == null || detail.retryAfterSeconds() <= 0
                ? null : Duration.ofSeconds(detail.retryAfterSeconds());
        return new NormalizedPublishError(code, responseCode, subcode, retryAfter, detailJson(platform, exception, code));
    }

    @Override
    public PublishErrorCode resolve(Platform platform, PostingJob job, PublishResult result) {
        if (job != null && job.getErrorCode() != null) {
            return job.getErrorCode();
        }
        String message = result != null ? result.getResponseMessage() : job == null ? null : job.getErrorMessage();
        return resolveStored(platform, null, platformCodeOf(job, result),
                job == null ? null : job.getPlatformErrorSubcode(), message, job == null ? null : job.getErrorType());
    }

    @Override
    public PublishErrorCode resolveStored(Platform platform, String storedCode, String platformCode,
                                          String platformSubcode, String message, PublishErrorType legacyType) {
        PublishErrorCode stored = PublishErrorCode.parse(storedCode);
        if (stored != null) {
            return stored;
        }
        PublishErrorCode internal = PublishErrorRules.classifyInternal(platformCode);
        if (internal != null) {
            return internal;
        }
        PublishErrorCode mapped = mapped(platform, platformCode, platformSubcode, message);
        if (mapped != null) {
            return mapped;
        }
        return PublishErrorRules.classifyLegacy(platformCode, message, legacyType);
    }

    @Override
    public String platformCodeOf(PostingJob job, PublishResult result) {
        if (job != null && job.getPlatformErrorCode() != null) {
            return job.getPlatformErrorCode();
        }
        return result == null ? null : result.getResponseCode();
    }

    @Override
    public void evictMappings() {
        cachedMappings = null;
    }

    /**
     * Ánh xạ admin khớp chữ ký: cùng nền tảng + mã; subcode/mẫu message null = "mọi". Nhiều dòng khớp → dòng
     * CỤ THỂ nhất thắng (có subcode và mẫu > chỉ subcode > chỉ mẫu > chỉ mã).
     */
    private PublishErrorCode mapped(Platform platform, String platformCode, String subcode, String message) {
        if (platform == null || platformCode == null) {
            return null;
        }
        String text = message == null ? "" : message.toLowerCase(Locale.ROOT);
        return mappings().stream()
                .filter(m -> m.getPlatform() == platform && platformCode.equals(m.getPlatformCode()))
                .filter(m -> m.getPlatformSubcode() == null || m.getPlatformSubcode().equals(subcode))
                .filter(m -> m.getMessagePattern() == null
                        || text.contains(m.getMessagePattern().toLowerCase(Locale.ROOT)))
                .max(Comparator.comparingInt(PublishErrorNormalizerImpl::specificity))
                .map(PublishErrorMapping::getErrorCode)
                .orElse(null);
    }

    private static int specificity(PublishErrorMapping mapping) {
        return (mapping.getPlatformSubcode() != null ? 2 : 0) + (mapping.getMessagePattern() != null ? 1 : 0);
    }

    private List<PublishErrorMapping> mappings() {
        CachedMappings cached = cachedMappings;
        if (cached != null && cached.fresh()) {
            return cached.mappings();
        }
        try {
            List<PublishErrorMapping> loaded = List.copyOf(mappingRepository.findByDeletedAtIsNullOrderByCreatedAtDesc());
            cachedMappings = new CachedMappings(loaded, Instant.now());
            return loaded;
        } catch (Exception e) {
            // Không có ánh xạ admin vẫn phân loại được bằng luật mặc định — không làm hỏng luồng ghi lỗi.
            log.warn("[PublishError] Không đọc được ánh xạ lỗi của admin — dùng luật mặc định: {}", e.getMessage());
            return List.of();
        }
    }

    /** JSON chi tiết cho admin — mọi chuỗi đi qua redactor; message nội bộ giữ tên exception để sửa code. */
    private String detailJson(Platform platform, PublishException exception, PublishErrorCode code) {
        try {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("aimaCode", code.name());
            node.put("platform", platform == null ? null : platform.name());
            node.put("responseCode", exception.getResponseCode());
            node.put("message", SensitiveDataRedactor.redact(exception.getMessage()));
            PlatformErrorDetail d = exception.getDetail();
            if (d != null) {
                putIfPresent(node, "httpStatus", d.httpStatus());
                putIfPresent(node, "code", d.code());
                putIfPresent(node, "subcode", d.subcode());
                node.put("type", d.type());
                node.put("platformMessage", SensitiveDataRedactor.redact(d.message()));
                node.put("userTitle", SensitiveDataRedactor.redact(d.userTitle()));
                node.put("userMessage", SensitiveDataRedactor.redact(d.userMessage()));
                node.put("fbtraceId", d.fbtraceId());
                node.put("transient", d.transientError());
                if (d.retryAfterSeconds() != null) {
                    node.put("retryAfterSeconds", d.retryAfterSeconds());
                }
            }
            if (exception.getCause() != null && exception.getCause() != exception) {
                node.put("cause", exception.getCause().getClass().getName());
            }
            removeNulls(node);
            return SensitiveDataRedactor.redact(objectMapper.writeValueAsString(node), DETAIL_MAX_LENGTH);
        } catch (Exception e) {
            log.warn("[PublishError] Không dựng được chi tiết lỗi: {}", e.getMessage());
            return null;
        }
    }

    private static void putIfPresent(ObjectNode node, String field, Integer value) {
        if (value != null) {
            node.put(field, value);
        }
    }

    private static void removeNulls(ObjectNode node) {
        List<String> nullFields = new ArrayList<>();
        node.fieldNames().forEachRemaining(name -> {
            if (node.get(name) == null || node.get(name).isNull()) {
                nullFields.add(name);
            }
        });
        nullFields.forEach(node::remove);
    }

    private static Integer parseInt(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
