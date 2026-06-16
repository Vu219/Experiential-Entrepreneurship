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

    BrandProfileResponse toBrandProfileResponse(BrandProfile brandProfile);

    List<BrandProfileResponse> toBrandProfileResponseList(List<BrandProfile> brandProfiles);

    @Mapping(target = "user", ignore = true)
    @Mapping(target = "brandName", source = "brandName", qualifiedByName = "trim")
    @Mapping(target = "industry", source = "industry", qualifiedByName = "trim")
    @Mapping(target = "targetAudience", source = "targetAudience", qualifiedByName = "trim")
    BrandProfile toBrandProfile(BrandProfileRequest request);

    @Mapping(target = "user", ignore = true)
    @Mapping(target = "brandName", source = "brandName", qualifiedByName = "trim")
    @Mapping(target = "industry", source = "industry", qualifiedByName = "trim")
    @Mapping(target = "targetAudience", source = "targetAudience", qualifiedByName = "trim")
    void updateBrandProfile(@MappingTarget BrandProfile profile, BrandProfileRequest request);

    @Named("trim")
    default String trim(String value) {
        return value == null ? null : value.trim();
    }

    // Never store a null collection: a missing list becomes an empty one.
    default List<String> mapPreferredTimes(List<String> times) {
        return times == null ? new ArrayList<>() : new ArrayList<>(times);
    }
}
