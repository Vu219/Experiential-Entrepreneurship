package com.aima.service;

import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.GoldenHourResponse;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;

import java.util.List;
import java.util.UUID;

public interface PostScheduleService {

    ApiResponse<PostScheduleResponse> create(String email, PostScheduleRequest request);

    ApiResponse<List<PostScheduleResponse>> list(String email, ScheduleStatus status, Platform platform);

    ApiResponse<PostScheduleResponse> get(String email, UUID scheduleId);

    ApiResponse<PostScheduleResponse> update(String email, UUID scheduleId, PostScheduleUpdateRequest request);

    ApiResponse<PostScheduleResponse> cancel(String email, UUID scheduleId);

    ApiResponse<GoldenHourResponse> suggestGoldenHours(Platform platform);
}
