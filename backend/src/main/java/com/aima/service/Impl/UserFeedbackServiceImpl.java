package com.aima.service.Impl;

import com.aima.dto.request.FeedbackRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FeedbackResponse;
import com.aima.dto.response.FeedbackSummaryResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.User;
import com.aima.entity.UserFeedback;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UserFeedbackMapper;
import com.aima.repository.UserFeedbackRepository;
import com.aima.repository.UserRepository;
import com.aima.service.UserFeedbackService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class UserFeedbackServiceImpl implements UserFeedbackService {

    static final int MAX_PAGE_SIZE = 50;

    static final int SEED_DAYS = 14;
    static final String ADMIN_ROLE = "ADMIN";

    UserFeedbackRepository feedbackRepository;
    UserRepository userRepository;
    UserFeedbackMapper feedbackMapper;
    JdbcTemplate jdbcTemplate;
    Environment environment;

    /** Cờ dev-only cho devSeed — mặc định TẮT. */
    @NonFinal
    @Value("${aima.dev.feedback-seed-enabled:false}")
    boolean feedbackSeedEnabled;

    /** Công tắc production ĐỘC LẬP với Spring profile — chặn cứng mọi dev-tool. */
    @NonFinal
    @Value("${aima.production-mode:false}")
    boolean productionMode;

    @Override
    public ApiResponse<FeedbackResponse> submit(String email, FeedbackRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        UserFeedback saved = feedbackRepository.save(
                feedbackMapper.toEntity(request, user, normalizeComment(request.getComment()), normalizePage(request.getPage())));
        log.info("[Feedback] User {} gửi đánh giá {} sao", user.getId(), saved.getRating());
        return ApiResponse.success("Cảm ơn bạn đã gửi đánh giá", feedbackMapper.toResponse(saved));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<FeedbackResponse>> list(Short rating, int page, int size) {
        if (rating != null && (rating < 1 || rating > 5)) {
            throw new AppException(ErrorCode.FEEDBACK_RATING_INVALID);
        }
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<UserFeedback> result = rating == null
                ? feedbackRepository.findByDeletedAtIsNull(pageable)
                : feedbackRepository.findByRatingAndDeletedAtIsNull(rating, pageable);
        PageResponse<FeedbackResponse> response =
                PageResponse.from(result, feedbackMapper.toAdminResponseList(result.getContent()));
        return ApiResponse.success("Lấy danh sách đánh giá thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<FeedbackSummaryResponse> summary() {
        Map<String, Long> distribution = new LinkedHashMap<>();
        for (int star = 1; star <= 5; star++) {
            distribution.put(String.valueOf(star), 0L);
        }
        long total = 0;
        long sum = 0;
        for (Object[] row : feedbackRepository.countByRating()) {
            int star = ((Number) row[0]).intValue();
            long count = ((Number) row[1]).longValue();
            distribution.put(String.valueOf(star), count);
            total += count;
            sum += star * count;
        }
        double average = total == 0 ? 0 : Math.round(sum * 100.0 / total) / 100.0;
        return ApiResponse.success("Lấy tổng quan đánh giá thành công", feedbackMapper.toSummary(total, average, distribution));
    }

    @Override
    public ApiResponse<Integer> devSeed(String actorEmail) {
        guardDevTool();
        List<UUID> userIds = userRepository.findAll().stream()
                .filter(u -> u.getDeletedAt() == null)
                .filter(u -> u.getRole() == null || !ADMIN_ROLE.equals(u.getRole().getRoleName()))
                .map(User::getId)
                .toList();
        if (userIds.isEmpty()) {
            throw new AppException(ErrorCode.USER_NOT_EXISTED);
        }

        // Seed cố định → chạy lại cho cùng hình dạng dữ liệu. Ngày thường đông hơn cuối tuần; điểm lệch về 4–5 sao.
        Random random = new Random(20261029L);
        LocalDateTime now = LocalDateTime.now();
        LocalDate firstDay = now.toLocalDate().minusDays(SEED_DAYS - 1L);
        List<Object[]> rows = new ArrayList<>();
        for (int d = 0; d < SEED_DAYS; d++) {
            LocalDate day = firstDay.plusDays(d);
            boolean weekend = day.getDayOfWeek().getValue() >= 6;
            int count = (weekend ? 2 : 4) + random.nextInt(weekend ? 3 : 5);
            for (int i = 0; i < count; i++) {
                LocalDateTime at = day.atTime(8 + random.nextInt(15), random.nextInt(60), random.nextInt(60));
                if (at.isAfter(now)) continue;
                short rating = sampleRating(random);
                String[] comments = SAMPLE_COMMENTS[rating - 1];
                String comment = random.nextInt(100) < 70 ? comments[random.nextInt(comments.length)] : null;
                String page = SAMPLE_PAGES[random.nextInt(SAMPLE_PAGES.length)];
                Timestamp ts = Timestamp.valueOf(at);
                rows.add(new Object[]{UUID.randomUUID(), ts, ts, userIds.get(random.nextInt(userIds.size())),
                        rating, comment, page});
            }
        }
        jdbcTemplate.batchUpdate("""
                INSERT INTO user_feedback (id, created_at, updated_at, user_id, rating, comment, page, sample)
                VALUES (?, ?, ?, ?, ?, ?, ?, true)""", rows);
        log.warn("[FeedbackSeed] {} đã tạo {} đánh giá MÔ PHỎNG ({} ngày) — KHÔNG phải đánh giá thật",
                actorEmail, rows.size(), SEED_DAYS);
        return ApiResponse.success("Đã tạo dữ liệu đánh giá mô phỏng", rows.size());
    }

    @Override
    public ApiResponse<Integer> devSeedClear(String actorEmail) {
        guardDevTool();
        int removed = feedbackRepository.deleteSamples();
        log.info("[FeedbackSeed] {} đã xoá {} đánh giá mô phỏng", actorEmail, removed);
        return ApiResponse.success("Đã xoá dữ liệu đánh giá mô phỏng", removed);
    }

    /** Ba lớp khoá như dev-seed doanh thu: cờ .env + AIMA_PRODUCTION_MODE + profile prod. */
    private void guardDevTool() {
        if (!feedbackSeedEnabled || productionMode || isProductionProfile()) {
            throw new AppException(ErrorCode.DEV_FEEDBACK_SEED_DISABLED);
        }
    }

    private boolean isProductionProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    /** 5★ 40% · 4★ 33% · 3★ 15% · 2★ 8% · 1★ 4%. */
    private static short sampleRating(Random random) {
        int roll = random.nextInt(100);
        if (roll < 40) return 5;
        if (roll < 73) return 4;
        if (roll < 88) return 3;
        if (roll < 96) return 2;
        return 1;
    }

    static final String[] SAMPLE_PAGES = {"/dashboard", "/create", "/create/new", "/calendar", "/analytics", "/trends", "/brand", "/billing"};

    /** Nhận xét mẫu theo số sao (index 0 = 1 sao). */
    static final String[][] SAMPLE_COMMENTS = {
            {"Kết nối Facebook bị lỗi mãi không được.", "Bài tạo ra chưa đúng giọng thương hiệu của tôi."},
            {"Tạo nội dung hơi chậm, phải chờ lâu.", "Giao diện lịch đăng hơi khó dùng trên điện thoại.", "Muốn có thêm mẫu cho ngành F&B."},
            {"Dùng được, nhưng cần chỉnh sửa lại khá nhiều.", "Gợi ý xu hướng ổn, mong có thêm Instagram Reels.", "Giá gói hơi cao với shop nhỏ."},
            {"Tiết kiệm thời gian viết bài đáng kể.", "Lên lịch đăng tiện, mong có thêm báo cáo theo tuần.", "Nội dung khá hợp, chỉ cần sửa nhẹ.", "Phần nghiên cứu xu hướng hữu ích."},
            {"Rất tiện, một lần tạo được bài cho cả Facebook và Instagram.", "Tuyệt vời, shop tôi đăng đều đặn hơn hẳn.", "Giao diện đẹp, dễ dùng.", "AI viết caption rất bắt trend.", "Đáng tiền, sẽ giới thiệu cho bạn bè."},
    };

    private static String normalizeComment(String comment) {
        if (comment == null || comment.isBlank()) return null;
        return comment.trim();
    }

    /** Chỉ giữ pathname: bỏ query/hash (có thể chứa mã OTP/đơn hàng) và giá trị không bắt đầu bằng "/". */
    private static String normalizePage(String page) {
        if (page == null || page.isBlank()) return null;
        String path = page.trim().split("[?#]", 2)[0];
        return path.startsWith("/") ? path : null;
    }
}
