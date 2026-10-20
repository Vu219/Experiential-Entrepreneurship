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
import com.aima.service.PlanLimitService;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

import com.aima.enums.PlanLimitKey;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring")
public interface PlanMapper {

    // ===== Plan =====

    Plan toPlan(PlanCreateRequest request);

    // monthlyTokenLimit null = giữ nguyên (FE cũ chưa gửi) — các field khác vẫn FULL update.
    @Mapping(target = "monthlyTokenLimit", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(PlanUpdateRequest request, @MappingTarget Plan plan);

    @Mapping(target = "core", expression = "java(Plan.CORE_CODES.contains(plan.getCode()))")
    PlanResponse toResponse(Plan plan);

    List<PlanResponse> toResponseList(List<Plan> plans);

    @Mapping(target = "policyCheckAiMonthlyLimit", source = "limits.policyCheckAiMonthly")
    @Mapping(target = "aiFixMaxPerVersion", source = "limits.aiFixPerVersion")
    @Mapping(target = "featureLimits", source = "featureLimits")
    PlanLimitDefaultsResponse toLimitDefaults(PlanLimitService.PlanLimits limits, PlanFeatureLimits featureLimits);

    // ===== Giới hạn tính năng (V18) =====

    PlanFeatureUsageItemResponse toUsageItem(PlanLimitKey key, PlanLimitKey.Type type, Long limit, Long used, boolean included);

    PlanFeatureUsageResponse toUsageResponse(String planCode, LocalDateTime periodStart, LocalDateTime periodEnd,
                                      List<PlanFeatureUsageItemResponse> items);

    PlanLimitViolationResponse toViolation(PlanLimitKey limitKey, Long limit, Long used, String planCode);

    // ===== PlanFeature (values do service reconcile theo planCode — mapper bỏ qua) =====

    @Mapping(target = "values", ignore = true)
    PlanFeature toFeature(PlanFeatureRequest request);

    @Mapping(target = "values", ignore = true)
    void update(PlanFeatureRequest request, @MappingTarget PlanFeature feature);

    PlanFeatureResponse toFeatureResponse(PlanFeature feature);

    List<PlanFeatureResponse> toFeatureResponseList(List<PlanFeature> features);

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
