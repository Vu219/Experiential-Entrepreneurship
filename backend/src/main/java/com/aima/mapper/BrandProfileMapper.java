package com.aima.mapper;

import com.aima.dto.request.BrandProfileRequest;
import com.aima.dto.response.BrandProfileResponse;
import com.aima.entity.BrandProfile;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;

import java.util.ArrayList;
import java.util.List;

@Mapper(componentModel = "spring")
public interface BrandProfileMapper {

    BrandProfileResponse toResponse(BrandProfile brandProfile);

    List<BrandProfileResponse> toResponseList(List<BrandProfile> brandProfiles);

    // logoUrl is owned entirely by the service (it stores the private bucket PATH, not the
    // request's data-URL/signed-URL), so never let MapStruct copy request.logoUrl onto the entity.
    @Mapping(target = "user", ignore = true)
    @Mapping(target = "logoUrl", ignore = true)
    @Mapping(target = "brandName", source = "brandName", qualifiedByName = "trim")
    @Mapping(target = "industry", source = "industry", qualifiedByName = "trim")
    @Mapping(target = "targetAudience", source = "targetAudience", qualifiedByName = "trim")
    BrandProfile toBrandProfile(BrandProfileRequest request);

    @Mapping(target = "user", ignore = true)
    @Mapping(target = "logoUrl", ignore = true)
    @Mapping(target = "brandName", source = "brandName", qualifiedByName = "trim")
    @Mapping(target = "industry", source = "industry", qualifiedByName = "trim")
    @Mapping(target = "targetAudience", source = "targetAudience", qualifiedByName = "trim")
    void update(BrandProfileRequest request, @MappingTarget BrandProfile profile);

    @Named("trim")
    default String trim(String value) {
        return value == null ? null : value.trim();
    }

    // Never store a null collection: a missing list (keywords / dos / donts) becomes an empty one.
    default List<String> mapStringList(List<String> values) {
        return values == null ? new ArrayList<>() : new ArrayList<>(values);
    }
}
