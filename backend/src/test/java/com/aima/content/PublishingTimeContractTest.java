package com.aima.content;

import com.aima.dto.request.PostScheduleRequest;
import com.aima.util.PublishingTime;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PublishingTimeContractTest {
    @Test void missingOffsetReturnsBadRequestThroughHttpLayer() throws Exception {
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                .standaloneSetup(new com.aima.controller.PostScheduleController(
                        org.mockito.Mockito.mock(com.aima.service.PostScheduleService.class)))
                .setCustomArgumentResolvers(new org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new com.aima.exception.GlobalExceptionHandler(
                        org.mockito.Mockito.mock(com.aima.service.SystemLogService.class)))
                .build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/schedules")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"scheduledTime\":\"2030-10-02T00:30:00\"}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.code").value(1000));
    }
    @Test void instantJsonRequiresOffsetAndNormalizesEquivalentTimes() {
        var mapper = JsonMapper.builder().findAndAddModules().build();
        var request = mapper.readValue("{\"scheduledTime\":\"2026-09-30T00:30:00+07:00\"}", PostScheduleRequest.class);
        assertEquals(Instant.parse("2026-09-29T17:30:00Z"), request.getScheduledTime());
        assertThrows(Exception.class, () -> mapper.readValue("{\"scheduledTime\":\"2026-09-30T00:30:00\"}", PostScheduleRequest.class));
    }
    @Test void pastIsRejectedByValidationAndLegacyConversionIsExplicit() {
        var request = PostScheduleRequest.builder().contentVersionId(UUID.randomUUID())
                .platformAccountId(UUID.randomUUID()).scheduledTime(Instant.EPOCH).build();
        try(var factory = Validation.buildDefaultValidatorFactory()) {
            assertTrue(factory.getValidator().validate(request).stream()
                    .anyMatch(v -> v.getMessage().equals("SCHEDULE_TIME_IN_PAST")));
        }
        assertEquals(Instant.parse("2026-09-29T17:30:00Z"), PublishingTime.fromLegacy(LocalDateTime.of(2026,9,30,0,30)));
    }
}
