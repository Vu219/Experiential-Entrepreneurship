package com.aima.service.Impl;

import com.aima.dto.request.LandingSectionUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.LandingSectionResponse;
import com.aima.entity.LandingSection;
import com.aima.enums.ActivityAction;
import com.aima.enums.LandingSectionKey;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.LandingSectionMapper;
import com.aima.repository.LandingSectionRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.LandingContentService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Nội dung Landing Page: lưu nháp → xuất bản. Landing công khai chỉ đọc published_content.
 * JSON admin gửi lên được convert sang record schema của section ({@code LandingContent}),
 * validate, rồi ghi lại dạng chuẩn hoá — field lạ không lọt vào DB.
 */
@Service
@Slf4j
public class LandingContentServiceImpl implements LandingContentService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final LandingSectionRepository repository;
    private final LandingSectionMapper mapper;
    private final ActivityLogService activityLogService;
    private final Validator validator;
    /** Bản sao của bean dùng chung, bỏ qua field lạ khi convert sang schema. */
    private final ObjectMapper objectMapper;

    public LandingContentServiceImpl(LandingSectionRepository repository, LandingSectionMapper mapper,
                                     ActivityLogService activityLogService, Validator validator,
                                     ObjectMapper objectMapper) {
        this.repository = repository;
        this.mapper = mapper;
        this.activityLogService = activityLogService;
        this.validator = validator;
        this.objectMapper = objectMapper.copy().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<Map<String, Object>> getPublic() {
        Map<String, Object> result = new LinkedHashMap<>();
        for (LandingSection section : repository.findByDeletedAtIsNull()) {
            result.put(section.getSectionKey(), parse(section.getPublishedContent()));
        }
        return ApiResponse.success("Nội dung Landing Page", result);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<LandingSectionResponse>> list() {
        List<LandingSectionResponse> result = sortedResponses();
        return ApiResponse.success("Danh sách section Landing Page", result);
    }

    @Override
    @Transactional
    public ApiResponse<LandingSectionResponse> saveDraft(String key, LandingSectionUpdateRequest request) {
        LandingSectionKey sectionKey = LandingSectionKey.fromKey(key);
        LandingSection section = find(sectionKey);
        if (!Objects.equals(section.getVersion(), request.getVersion())) {
            throw new AppException(ErrorCode.LANDING_VERSION_CONFLICT);
        }
        section.setDraftContent(normalize(sectionKey, request.getContent()));
        section.setUpdatedBy(currentActor());
        LandingSection saved = flush(section);
        log(ActivityAction.LANDING_CONTENT_UPDATED, "DRAFT_SAVED", saved);
        LandingSectionResponse result = toResponse(saved);
        return ApiResponse.success("Đã lưu nháp", result);
    }

    @Override
    @Transactional
    public ApiResponse<LandingSectionResponse> publish(String key) {
        LandingSection section = find(LandingSectionKey.fromKey(key));
        LandingSection saved = flush(markPublished(section));
        log(ActivityAction.LANDING_CONTENT_PUBLISHED, "PUBLISHED", saved);
        LandingSectionResponse result = toResponse(saved);
        return ApiResponse.success("Đã xuất bản", result);
    }

    @Override
    @Transactional
    public ApiResponse<List<LandingSectionResponse>> publishAll() {
        List<LandingSection> changed = new ArrayList<>();
        for (LandingSection section : repository.findByDeletedAtIsNull()) {
            if (hasChanges(section)) {
                changed.add(markPublished(section));
            }
        }
        try {
            repository.saveAllAndFlush(changed);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new AppException(ErrorCode.LANDING_VERSION_CONFLICT);
        }
        changed.forEach(s -> log(ActivityAction.LANDING_CONTENT_PUBLISHED, "PUBLISHED", s));
        List<LandingSectionResponse> result = sortedResponses();
        return ApiResponse.success("Đã xuất bản " + changed.size() + " section", result);
    }

    @Override
    @Transactional
    public ApiResponse<LandingSectionResponse> discardDraft(String key) {
        LandingSection section = find(LandingSectionKey.fromKey(key));
        section.setDraftContent(section.getPublishedContent());
        section.setUpdatedBy(currentActor());
        LandingSection saved = flush(section);
        log(ActivityAction.LANDING_CONTENT_UPDATED, "DRAFT_DISCARDED", saved);
        LandingSectionResponse result = toResponse(saved);
        return ApiResponse.success("Đã hủy bản nháp", result);
    }

    private LandingSection find(LandingSectionKey key) {
        return repository.findBySectionKeyAndDeletedAtIsNull(key.getKey())
                .orElseThrow(() -> new AppException(ErrorCode.LANDING_SECTION_NOT_FOUND));
    }

    /** Theo thứ tự khai báo của {@link LandingSectionKey} (= thứ tự tab ở admin). */
    private List<LandingSectionResponse> sortedResponses() {
        Map<String, LandingSection> byKey = new LinkedHashMap<>();
        repository.findByDeletedAtIsNull().forEach(s -> byKey.put(s.getSectionKey(), s));
        return Arrays.stream(LandingSectionKey.values())
                .map(k -> byKey.get(k.getKey()))
                .filter(Objects::nonNull)
                .map(this::toResponse)
                .toList();
    }

    private LandingSection markPublished(LandingSection section) {
        section.setPublishedContent(section.getDraftContent());
        section.setPublishedAt(LocalDateTime.now());
        section.setPublishedBy(currentActor());
        return section;
    }

    /** Flush ngay để lỗi khoá lạc quan thành 2102 thay vì nổ lúc commit (500). */
    private LandingSection flush(LandingSection section) {
        try {
            return repository.saveAndFlush(section);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new AppException(ErrorCode.LANDING_VERSION_CONFLICT);
        }
    }

    /** JSON → record schema → validate → JSON chuẩn hoá để lưu. */
    private String normalize(LandingSectionKey key, Map<String, Object> content) {
        Object typed;
        try {
            typed = objectMapper.convertValue(content, key.getContentType());
        } catch (IllegalArgumentException e) {
            log.warn("[Landing] Nội dung section {} sai kiểu dữ liệu: {}", key.getKey(), e.getMessage());
            throw new AppException(ErrorCode.LANDING_CONTENT_INVALID);
        }
        Set<ConstraintViolation<Object>> violations = validator.validate(typed);
        if (!violations.isEmpty()) {
            ConstraintViolation<Object> first = violations.iterator().next();
            log.warn("[Landing] Section {} không hợp lệ ({} lỗi), vd: {}", key.getKey(),
                    violations.size(), first.getPropertyPath());
            throw new AppException(ErrorCode.LANDING_CONTENT_INVALID);
        }
        try {
            return objectMapper.writeValueAsString(typed);
        } catch (JsonProcessingException e) {
            log.error("[Landing] Không ghi được JSON section {}: {}", key.getKey(), e.getMessage());
            throw new AppException(ErrorCode.LANDING_CONTENT_INVALID);
        }
    }

    private boolean hasChanges(LandingSection section) {
        try {
            return !objectMapper.readTree(section.getDraftContent())
                    .equals(objectMapper.readTree(section.getPublishedContent()));
        } catch (JsonProcessingException e) {
            log.error("[Landing] JSON hỏng ở section {}: {}", section.getSectionKey(), e.getMessage());
            return true;
        }
    }

    private Map<String, Object> parse(String json) {
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (JsonProcessingException e) {
            log.error("[Landing] Không đọc được JSON nội dung: {}", e.getMessage());
            return Map.of();
        }
    }

    private LandingSectionResponse toResponse(LandingSection section) {
        return mapper.toResponse(section, parse(section.getDraftContent()),
                parse(section.getPublishedContent()), hasChanges(section));
    }

    private String currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null ? null : authentication.getName();
    }

    private void log(ActivityAction action, String operation, LandingSection section) {
        activityLogService.record(ActivityLogService.Entry.byActor(
                action, currentActor(), "LandingSection",
                section.getSectionKey(), Map.of("operation", operation)));
    }
}
