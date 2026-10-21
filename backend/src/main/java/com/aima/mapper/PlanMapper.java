package com.aima.mapper;

import com.aima.dto.request.PlanCreateRequest;
import com.aima.dto.request.PlanFeatureRequest;
import com.aima.dto.request.PlanFeatureValueRequest;
import com.aima.dto.request.PlanUpdateRequest;
import com.aima.dto.response.PlanFeatureResponse;
import com.aima.dto.response.PlanFeatureValueResponse;
import com.aima.dto.response.PlanLimitDefaultsResponse;
import com.aima.dto.response.PlanResponse;
import com.aima.dto.response.PlanLimitViolationResponse;
import com.aima.dto.response.PlanFeatureUsageItemResponse;
import com.aima.dto.response.PlanFeatureUsageResponse;
import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.PlanFeature;
import com.aima.entity.PlanFeatureValue;
import com.aima.dto.request.PlanFeatureLimitsRequest;
import com.aima.dto.response.PlanFeatureAutoValueResponse;
import com.aima.dto.response.PlanFeatureLimitsResponse;
import com.aima.dto.response.PlanFeatureScopeUsageResponse;
import com.aima.enums.Platform;
import com.aima.util.PlatformCsv;
import org.mapstruct.BeanMapping;
import org.mapstruct.Named;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

import com.aima.enums.PlanLimitKey;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring")
public interface PlanMapper {

    // ===== Plan =====

    // Giới hạn (featureLimits) do PlanServiceImpl áp qua updateLimits — kiểm "điền đủ" + reset về mặc định.
    // tokenQuota KHÔNG ghi nữa: số token hiển thị sinh từ monthlyTokenLimit (toResponse).
    @Mapping(target = "featureLimits", ignore = true)
    @Mapping(target = "tokenQuota", ignore = true)
    Plan toPlan(PlanCreateRequest request);

    // Thông tin hiển thị FULL update; monthlyTokenLimit null = giữ nguyên (-1 = không giới hạn, xử lý ở service).
    @Mapping(target = "monthlyTokenLimit", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "featureLimits", ignore = true)
    @Mapping(target = "tokenQuota", ignore = true)
    void update(PlanUpdateRequest request, @MappingTarget Plan plan);

    /** Ô giới hạn trong request: null = giữ nguyên; danh sách nền tảng → CSV (rỗng = không nền tảng nào). */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "allowedPlatforms", source = "allowedPlatforms", qualifiedByName = "platformsToCsv")
    void updateLimits(PlanFeatureLimitsRequest request, @MappingTarget PlanFeatureLimits limits);

    @Mapping(target = "allowedPlatforms", source = "allowedPlatforms", qualifiedByName = "csvToPlatforms")
    PlanFeatureLimitsResponse toLimitsResponse(PlanFeatureLimits limits);

    @Mapping(target = "core", expression = "java(Plan.CORE_CODES.contains(plan.getCode()))")
    @Mapping(target = "tokenQuota", source = "monthlyTokenLimit")
    @Mapping(target = "subscriberCount", ignore = true)
    PlanResponse toResponse(Plan plan);

    List<PlanResponse> toResponseList(List<Plan> plans);

    /** Danh sách admin: kèm số người dùng đang ở từng gói. */
    default List<PlanResponse> toResponseList(List<Plan> plans, Map<UUID, Long> subscriberCounts) {
        return plans.stream().map(plan -> {
            PlanResponse response = toResponse(plan);
            response.setSubscriberCount(subscriberCounts.getOrDefault(plan.getId(), 0L));
            return response;
        }).toList();
    }

    PlanLimitDefaultsResponse toLimitDefaults(PlanFeatureLimits featureLimits);

    @Named("platformsToCsv")
    default String platformsToCsv(List<Platform> platforms) {
        return PlatformCsv.format(platforms);
    }

    @Named("csvToPlatforms")
    default List<Platform> csvToPlatforms(String csv) {
        return csv == null ? null : List.copyOf(PlatformCsv.parse(csv));
    }

    // ===== Giới hạn tính năng (V18) =====

    PlanFeatureUsageItemResponse toUsageItem(PlanLimitKey key, PlanLimitKey.Type type, Long limit, Long used, boolean included,
                                             List<Platform> platforms, List<PlanFeatureScopeUsageResponse> scopes);

    PlanFeatureScopeUsageResponse toScopeUsage(UUID scopeId, String scopeName, long used);

    PlanFeatureUsageResponse toUsageResponse(String planCode, LocalDateTime periodStart, LocalDateTime periodEnd,
                                      List<PlanFeatureUsageItemResponse> items);

    PlanLimitViolationResponse toViolation(PlanLimitKey limitKey, Long limit, Long used, String planCode, Platform platform);

    // ===== PlanFeature (values do service reconcile theo planCode — mapper bỏ qua) =====

    @Mapping(target = "values", ignore = true)
    PlanFeature toFeature(PlanFeatureRequest request);

    @Mapping(target = "values", ignore = true)
    void update(PlanFeatureRequest request, @MappingTarget PlanFeature feature);

    @Mapping(target = "autoValues", ignore = true)
    PlanFeatureResponse toFeatureResponse(PlanFeature feature);

    List<PlanFeatureResponse> toFeatureResponseList(List<PlanFeature> features);

    /** Dòng liên kết giới hạn: kèm ô tự động theo từng gói (service tính từ giới hạn hiệu lực). */
    default List<PlanFeatureResponse> toFeatureResponseList(List<PlanFeature> features,
                                                           Map<UUID, List<PlanFeatureAutoValueResponse>> autoValues) {
        return features.stream().map(feature -> {
            PlanFeatureResponse response = toFeatureResponse(feature);
            response.setAutoValues(autoValues.get(feature.getId()));
            return response;
        }).toList();
    }

    PlanFeatureAutoValueResponse toAutoValue(String planCode, PlanFeatureAutoValueResponse.Kind kind, Long value,
                                             List<PlanFeatureAutoValueResponse.PlatformCell> platforms);

    PlanFeatureAutoValueResponse.PlatformCell toPlatformCell(Platform platform, boolean comingSoon);

    @Mapping(target = "planCode", source = "plan.code")
    PlanFeatureValueResponse toValueResponse(PlanFeatureValue value);

    // Nguồn có Plan/PlanFeature nhưng builder của entity không lộ id/audit (BaseEntity)
    // nên không thể map nhầm id nguồn sang target — không cần ignore.
    @Mapping(target = "boolValue", source = "request.boolValue")
    PlanFeatureValue toValue(PlanFeatureValueRequest request, Plan plan, PlanFeature feature);

    void updateValue(PlanFeatureValueRequest request, @MappingTarget PlanFeatureValue value);

    // ===== helpers: bullet list ↔ TEXT (mỗi dòng một mục) — MapStruct tự áp cho features/teaser =====

    default String joinLines(List<String> lines) {
        if (lines == null) return null;
        return lines.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining("\n"));
    }

    default List<String> splitLines(String text) {
        if (text == null || text.isBlank()) return new ArrayList<>();
        return Arrays.stream(text.split("\\R"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
