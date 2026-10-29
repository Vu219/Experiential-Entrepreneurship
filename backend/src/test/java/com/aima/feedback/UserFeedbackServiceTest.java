package com.aima.feedback;

import com.aima.dto.request.FeedbackRequest;
import com.aima.dto.response.FeedbackResponse;
import com.aima.dto.response.FeedbackSummaryResponse;
import com.aima.entity.User;
import com.aima.entity.UserFeedback;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UserFeedbackMapperImpl;
import com.aima.repository.UserFeedbackRepository;
import com.aima.repository.UserRepository;
import com.aima.service.Impl.UserFeedbackServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UserFeedbackServiceTest {

    UserFeedbackRepository feedbackRepository;
    UserRepository userRepository;
    UserFeedbackServiceImpl service;
    User user;

    @BeforeEach
    void setUp() {
        feedbackRepository = mock(UserFeedbackRepository.class);
        userRepository = mock(UserRepository.class);
        service = new UserFeedbackServiceImpl(feedbackRepository, userRepository, new UserFeedbackMapperImpl(),
                mock(JdbcTemplate.class), new MockEnvironment());
        user = new User();
        user.setEmail("khach@example.com");
        user.setFullName("Khách");
        when(userRepository.findByEmail("khach@example.com")).thenReturn(Optional.of(user));
        when(feedbackRepository.save(any(UserFeedback.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void submitTrimsCommentAndStripsQueryStringFromPage() {
        FeedbackRequest request = FeedbackRequest.builder()
                .rating((short) 4).comment("  Rất hữu ích  ").page("/billing/return?orderCode=123#x").build();

        FeedbackResponse response = service.submit("khach@example.com", request).getResult();

        ArgumentCaptor<UserFeedback> saved = ArgumentCaptor.forClass(UserFeedback.class);
        verify(feedbackRepository).save(saved.capture());
        assertThat(saved.getValue().getUser()).isSameAs(user);
        assertThat(saved.getValue().getRating()).isEqualTo((short) 4);
        assertThat(saved.getValue().getComment()).isEqualTo("Rất hữu ích");
        assertThat(saved.getValue().getPage()).isEqualTo("/billing/return");
        // Người gửi không nhận lại email/tên của chính mình trong response.
        assertThat(response.getUserEmail()).isNull();
    }

    @Test
    void submitDropsBlankCommentAndNonPathPage() {
        service.submit("khach@example.com", FeedbackRequest.builder()
                .rating((short) 5).comment("   ").page("https://evil.example").build());

        ArgumentCaptor<UserFeedback> saved = ArgumentCaptor.forClass(UserFeedback.class);
        verify(feedbackRepository).save(saved.capture());
        assertThat(saved.getValue().getComment()).isNull();
        assertThat(saved.getValue().getPage()).isNull();
    }

    @Test
    void submitUnknownUserFails() {
        assertThatThrownBy(() -> service.submit("ai@example.com", FeedbackRequest.builder().rating((short) 3).build()))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_EXISTED);
    }

    @Test
    void summaryFillsAllStarsAndRoundsAverage() {
        when(feedbackRepository.countByRating()).thenReturn(List.of(
                new Object[]{(short) 5, 2L}, new Object[]{(short) 4, 1L}));

        FeedbackSummaryResponse summary = service.summary().getResult();

        assertThat(summary.getTotal()).isEqualTo(3);
        assertThat(summary.getAverageRating()).isEqualTo(4.67);
        assertThat(summary.getDistribution()).containsExactly(
                org.assertj.core.api.Assertions.entry("1", 0L), org.assertj.core.api.Assertions.entry("2", 0L),
                org.assertj.core.api.Assertions.entry("3", 0L), org.assertj.core.api.Assertions.entry("4", 1L),
                org.assertj.core.api.Assertions.entry("5", 2L));
    }

    @Test
    void summaryWithoutFeedbackIsZero() {
        when(feedbackRepository.countByRating()).thenReturn(List.of());
        assertThat(service.summary().getResult().getAverageRating()).isZero();
    }

    @Test
    void listRejectsRatingOutOfRange() {
        assertThatThrownBy(() -> service.list((short) 6, 0, 20))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.FEEDBACK_RATING_INVALID);
    }

    @Test
    void devSeedIsOffByDefault() {
        // Cờ aima.dev.feedback-seed-enabled mặc định false → không bao giờ sinh dữ liệu mô phỏng ngoài ý muốn.
        assertThatThrownBy(() -> service.devSeed("admin@example.com"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.DEV_FEEDBACK_SEED_DISABLED);
        verifyNoInteractions(feedbackRepository);
    }
}
