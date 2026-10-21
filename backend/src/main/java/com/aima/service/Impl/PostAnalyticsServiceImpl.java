package com.aima.service.Impl;

import com.aima.dto.response.AnalyzedPostResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PostAnalyticsResponse;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.User;
import com.aima.enums.PostStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PostAnalyticsMapper;
import com.aima.repository.PostRepository;
import com.aima.repository.UserRepository;
import com.aima.service.PostAnalyticsService;
import com.aima.service.PlanUsageService;
import com.aima.enums.PlanLimitKey;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * FR-60/FR-61/FR-62 (phần BE): xem số liệu các bài đã đăng — mỗi bài kèm các snapshot
 * theo mốc 24h/48h/7d để FE hiển thị và so sánh.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional(readOnly = true) // giới hạn gói đọc subscription: phần ghi của getOrCreate tự chạy REQUIRES_NEW
public class PostAnalyticsServiceImpl implements PostAnalyticsService {

    PostRepository postRepository;
    UserRepository userRepository;
    PostAnalyticsMapper postAnalyticsMapper;
    PlanUsageService planUsageService;

    @Override
    public ApiResponse<PageResponse<AnalyzedPostResponse>> list(String email, int page, int size) {
        User user = currentUser(email);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        // Gói (ANALYTICS_HISTORY_DAYS): chỉ bài đăng trong số ngày gần nhất — cùng mốc với trang Phân tích.
        Instant earliest = earliestPublishedAt(user);
        Page<Post> posts = earliest == null
                ? postRepository.findByStatusAndSchedule_PlatformAccount_User_IdAndDeletedAtIsNullOrderByPublishedAtDesc(
                        PostStatus.POSTED, user.getId(), pageable)
                : postRepository
                .findByStatusAndSchedule_PlatformAccount_User_IdAndPublishedAtGreaterThanEqualAndDeletedAtIsNullOrderByPublishedAtDesc(
                        PostStatus.POSTED, user.getId(), earliest, pageable);

        List<AnalyzedPostResponse> content = posts.getContent().stream()
                .map(this::toAnalyzedPost)
                .toList();
        PageResponse<AnalyzedPostResponse> response = PageResponse.from(posts, content);
        return ApiResponse.success("Lấy số liệu bài đăng thành công", response);
    }

    @Override
    public ApiResponse<AnalyzedPostResponse> get(String email, UUID postId) {
        User user = currentUser(email);
        Post post = postRepository
                .findByIdAndSchedule_PlatformAccount_User_IdAndDeletedAtIsNull(postId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.POST_NOT_FOUND));
        Instant earliest = earliestPublishedAt(user);
        if (earliest != null && post.getPublishedAt() != null && post.getPublishedAt().isBefore(earliest)) {
            // Bài cũ hơn số ngày lịch sử của gói — cùng envelope 2205 để FE hiện nút nâng cấp.
            planUsageService.requireCap(user, PlanLimitKey.ANALYTICS_HISTORY_DAYS,
                    ChronoUnit.DAYS.between(post.getPublishedAt(), Instant.now()) + 1);
        }
        AnalyzedPostResponse response = toAnalyzedPost(post);
        return ApiResponse.success("Lấy số liệu bài đăng thành công", response);
    }

    // Snapshot còn hiệu lực, sắp theo mốc 24h → 48h → 7d.
    private AnalyzedPostResponse toAnalyzedPost(Post post) {
        List<PostAnalytics> rows = post.getPostAnalytics().stream()
                .filter(a -> a.getDeletedAt() == null)
                .sorted(Comparator.comparing(PostAnalytics::getCollectedAt))
                .toList();
        List<PostAnalyticsResponse> analytics = postAnalyticsMapper.toResponseList(rows);
        return postAnalyticsMapper.toAnalyzedPostResponse(post, analytics);
    }

    /** Đầu ngày sớm nhất được xem theo gói (giờ hệ thống như trang Phân tích); null = không giới hạn. */
    private Instant earliestPublishedAt(User user) {
        LocalDate earliest = planUsageService.analyticsEarliestDate(user, LocalDate.now());
        return earliest == null ? null : earliest.atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
