package com.aima.mapper;

import com.aima.dto.request.FeedbackRequest;
import com.aima.dto.response.FeedbackResponse;
import com.aima.dto.response.FeedbackSummaryResponse;
import com.aima.entity.User;
import com.aima.entity.UserFeedback;
import org.mapstruct.IterableMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.List;
import java.util.Map;

@Mapper(componentModel = "spring")
public interface UserFeedbackMapper {

    /** comment/page đã chuẩn hoá ở service (trim, bỏ query string). */
    @Mapping(target = "user", source = "user")
    @Mapping(target = "rating", source = "request.rating")
    @Mapping(target = "comment", source = "comment")
    @Mapping(target = "page", source = "page")
    @Mapping(target = "sample", ignore = true)
    UserFeedback toEntity(FeedbackRequest request, User user, String comment, String page);

    /** Cho người gửi: không kèm email/tên. */
    @Mapping(target = "userEmail", ignore = true)
    @Mapping(target = "userFullName", ignore = true)
    FeedbackResponse toResponse(UserFeedback feedback);

    @Named("admin")
    @Mapping(target = "userEmail", source = "user.email")
    @Mapping(target = "userFullName", source = "user.fullName")
    FeedbackResponse toAdminResponse(UserFeedback feedback);

    @IterableMapping(qualifiedByName = "admin")
    List<FeedbackResponse> toAdminResponseList(List<UserFeedback> feedback);

    /** Khai báo tường minh vì MapStruct coi tham số Map là nguồn property → mọi field đều mơ hồ. */
    @Mapping(target = "total", source = "total")
    @Mapping(target = "averageRating", source = "averageRating")
    @Mapping(target = "distribution", source = "distribution")
    FeedbackSummaryResponse toSummary(long total, double averageRating, Map<String, Long> distribution);
}
