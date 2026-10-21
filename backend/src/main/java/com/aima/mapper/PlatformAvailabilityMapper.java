package com.aima.mapper;

import com.aima.dto.response.PlatformAccessResponse;
import com.aima.dto.response.PlatformAvailabilityResponse;
import com.aima.entity.PlatformAvailability;
import com.aima.enums.Platform;
import com.aima.enums.PlatformLockReason;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface PlatformAvailabilityMapper {

    @Mapping(target = "connectionEnabled", source = "availability.connectionEnabled")
    PlatformAvailabilityResponse toResponse(PlatformAvailability availability, long connectedAccounts,
                                            long pendingSchedules, Integer heldSchedules);

    @Mapping(target = "platform", source = "platform")
    @Mapping(target = "systemEnabled", source = "availability.connectionEnabled")
    @Mapping(target = "reasonVi", source = "availability.reasonVi")
    @Mapping(target = "reasonEn", source = "availability.reasonEn")
    @Mapping(target = "usable", expression = "java(lockReason == null)")
    PlatformAccessResponse toAccessResponse(Platform platform, PlatformAvailability availability,
                                            boolean planAllowed, PlatformLockReason lockReason);

    // Builder của entity không lộ id/audit (BaseEntity) nên không cần ignore các field đó.
    @Mapping(target = "reasonVi", ignore = true)
    @Mapping(target = "reasonEn", ignore = true)
    @Mapping(target = "statusChangedAt", ignore = true)
    @Mapping(target = "updatedById", ignore = true)
    @Mapping(target = "updatedByEmail", ignore = true)
    PlatformAvailability toAvailability(Platform platform, Boolean connectionEnabled);
}
