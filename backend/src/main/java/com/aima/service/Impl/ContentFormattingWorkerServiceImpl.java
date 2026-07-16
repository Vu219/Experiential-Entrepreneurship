package com.aima.service.Impl;

import com.aima.dto.ai.BrandProfileInputPayload;
import com.aima.dto.ai.ContentVersionPayload;
import com.aima.dto.ai.FormatContentPayload;
import com.aima.dto.ai.FormatPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.entity.ContentFormattingJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.User;
import com.aima.enums.AiTaskCode;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.ContentFormattingMapper;
import com.aima.repository.ContentFormattingJobRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentFormattingWorkerService;
import com.aima.service.AiUsageService;
import com.aima.service.TokenUsageService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Xử lý nền cho {@link ContentFormattingJob} (NFR-04, FR-40..FR-46) — cùng mẫu
 * {@link ContentGenerationWorkerServiceImpl}: RUNNING commit ngay qua transaction ngắn,
 * cuộc gọi AI chạy NGOÀI transaction, kết quả/lỗi lưu trong transaction ngắn.
 *
 * <p>PA2-a: mỗi nền tảng được format từ CHÍNH bản active của nó (giữ chỉnh sửa tay của user
 * làm đầu vào) — worker lặp từng nền tảng, gọi AI {@code /format} riêng cho nền tảng đó.
 * Vì số lần gọi AI tăng theo số nền tảng, quota token được kiểm tra TRƯỚC mỗi lần gọi (không
 * chỉ một lần lúc start) — hết hạn mức giữa job thì các nền tảng còn lại bị chặn thay vì âm thầm vượt.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ContentFormattingWorkerServiceImpl implements ContentFormattingWorkerService {

    ContentFormattingJobRepository jobRepository;
    ContentVersionRepository contentVersionRepository;
    UserRepository userRepository;
    AiServiceClient aiServiceClient;
    ContentFormattingMapper contentFormattingMapper;
    AiContentMapper aiContentMapper;
    TransactionTemplate transactionTemplate;
    TokenUsageService tokenUsageService;
    AiUsageService aiUsageService;

    /** Nguồn format của MỘT nền tảng: id bản GỐC (để adapt từ bản gốc + gắn source_version_id) + payload gửi AI. */
    private record PlatformSource(UUID sourceVersionId, FormatContentPayload payload) {
    }

    /** Ngữ cảnh dựng trong transaction ngắn đầu tiên, tiêu thụ NGOÀI transaction khi gọi AI. */
    private record FormatContext(UUID userId,
                                 BrandProfileInputPayload brandProfile,
                                 List<Platform> platforms,
                                 Map<Platform, PlatformSource> sources) {
    }

    @Async("contentFormattingExecutor")
    @Override
    public void process(UUID jobId) {
        FormatContext ctx = transactionTemplate.execute(status -> markRunningAndBuildContext(jobId));
        if (ctx == null) {
            return; // job không tồn tại / đã bị xóa
        }

        boolean anySuccess = false;
        List<String> failures = new ArrayList<>();

        for (Platform platform : ctx.platforms()) {
            PlatformSource source = ctx.sources().get(platform);
            if (source == null) {
                // Nền tảng được yêu cầu nhưng chưa có bản nội dung nguồn (chưa generate) — bỏ qua.
                failures.add(platform + ": không có bản nội dung nguồn để định dạng");
                continue;
            }

            // Quota: PA2-a tăng số lần gọi AI → kiểm tra trước mỗi nền tảng. Hết hạn mức thì DỪNG
            // (các nền tảng còn lại cũng sẽ vượt) thay vì tiếp tục gọi.
            try {
                transactionTemplate.executeWithoutResult(s -> checkQuota(ctx.userId()));
            } catch (AppException quota) {
                log.warn("[ContentFormatting] Job {} dừng ở nền tảng {} do hết hạn mức token: {}",
                        jobId, platform, quota.getMessage());
                failures.add(platform + ": " + quota.getMessage());
                break;
            }

            try {
                FormatPayload payload = FormatPayload.builder()
                        .brandProfile(ctx.brandProfile())
                        .content(source.payload())
                        .platforms(List.of(platform.name()))
                        .build();
                FormatResultPayload result = aiServiceClient.format(payload); // NGOÀI transaction (rule #24)
                transactionTemplate.executeWithoutResult(s -> savePlatformResult(jobId, platform, source.sourceVersionId(), result));
                anySuccess = true;
            } catch (Exception e) {
                // AppException truyền message của ErrorCode vào super(...) nên getMessage() luôn có nghĩa.
                String message = e.getMessage();
                log.warn("[ContentFormatting] Job {} nền tảng {} thất bại: {}", jobId, platform, message, e);
                failures.add(platform + ": " + message);
            }
        }

        boolean success = anySuccess;
        transactionTemplate.executeWithoutResult(s -> finalizeJob(jobId, success, failures));
    }

    private FormatContext markRunningAndBuildContext(UUID jobId) {
        ContentFormattingJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentFormatting] Job {} không tồn tại khi bắt đầu xử lý", jobId);
            return null;
        }
        job.setStatus(GenerationJobStatus.RUNNING);
        jobRepository.save(job);

        ContentItem item = job.getContentItem();
        BrandProfileInputPayload brandProfile = aiContentMapper.toBrandProfilePayload(item.getBrandProfile());

        List<Platform> platforms = new ArrayList<>();
        Map<Platform, PlatformSource> sources = new LinkedHashMap<>();
        for (String token : job.getPlatforms().split(",")) {
            Platform platform = parsePlatform(token);
            if (platform == null || platforms.contains(platform)) {
                continue;
            }
            platforms.add(platform);
            // Bản active của nền tảng (generate/sửa tay xóa mềm bản cũ). "Định dạng lại" luôn adapt từ
            // bản GỐC: nếu bản active đã là bản format (có source_version_id) thì lấy bản gốc đó làm
            // nguồn — tránh trôi nghĩa khi format chồng lên bản format trước (FR-40, Yêu cầu 4).
            contentVersionRepository
                    .findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(item.getId(), platform)
                    .stream().findFirst()
                    .ifPresent(active -> {
                        UUID sourceId = active.getSourceVersionId() != null ? active.getSourceVersionId() : active.getId();
                        ContentVersion source = contentVersionRepository.findById(sourceId).orElse(active);
                        sources.put(platform, new PlatformSource(sourceId, contentFormattingMapper.toFormatContentPayload(source)));
                    });
        }
        return new FormatContext(item.getBrandProfile().getUser().getId(), brandProfile, platforms, sources);
    }

    private void checkQuota(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            tokenUsageService.checkQuota(user); // hết hạn mức tháng → AppException(TOKEN_QUOTA_EXCEEDED)
        }
    }

    // Lưu kết quả format của MỘT nền tảng: xóa mềm bản cũ cùng nền tảng (FR-46), thêm bản FORMATTED mới.
    private void savePlatformResult(UUID jobId, Platform platform, UUID sourceVersionId, FormatResultPayload result) {
        ContentFormattingJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentFormatting] Job {} biến mất trước khi lưu kết quả", jobId);
            return;
        }

        ContentItem item = job.getContentItem();
        List<ContentVersionPayload> payloads = result.getVersions() == null ? List.of() : result.getVersions();
        if (payloads.isEmpty()) {
            return; // AI không trả bản nào cho nền tảng này — coi như chưa format, không đụng bản cũ
        }

        LocalDateTime now = LocalDateTime.now();
        item.getContentVersions().stream()
                .filter(v -> v.getDeletedAt() == null && v.getPlatformName() == platform)
                .forEach(v -> v.setDeletedAt(now));

        // Bản GỐC để giữ nguyên kịch bản video (FR-25) + media prompt (FR-29) — format chỉ đổi
        // trình bày caption/hashtag/CTA, KHÔNG sinh mới các trường này.
        ContentVersion source = contentVersionRepository.findById(sourceVersionId).orElse(null);

        payloads.forEach(payload -> {
            // Mapper set formatted_caption/hashtag/media_format + CTA (đã chuyển thể, không rỗng) + status FORMATTED.
            ContentVersion version = contentFormattingMapper.toContentVersion(payload);
            version.setContentItem(item);
            version.setSourceVersionId(sourceVersionId); // truy vết + "Định dạng lại" adapt từ bản gốc
            if (source != null) {
                version.setScript(source.getScript());
                version.setMediaPrompt(source.getMediaPrompt());
            }
            item.getContentVersions().add(version);
        });

        jobRepository.save(job); // item + versions lưu qua cascade từ item đang managed trong tx

        // Cộng token LLM thật của lần gọi vào hạn mức tháng của user (thanh usage ở sidebar).
        tokenUsageService.record(item.getBrandProfile().getUser(), result.getTokensUsed());
        aiUsageService.record(item.getBrandProfile().getUser(), AiTaskCode.PLATFORM_FORMATTING, result.getTokensUsed());
    }

    // Chốt trạng thái job sau khi lặp hết nền tảng: ≥1 nền tảng xong → SUCCESS; không nền tảng nào
    // xong → FAILED. KHÔNG lật status của item — format chạy TRƯỚC Duyệt (thứ tự mới): item giữ
    // vòng đời review (DRAFT→NEED_REVIEW→APPROVED), chỉ VERSION mang status FORMATTED (điều kiện lên lịch).
    private void finalizeJob(UUID jobId, boolean anySuccess, List<String> failures) {
        ContentFormattingJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return;
        }
        if (anySuccess) {
            job.setStatus(GenerationJobStatus.SUCCESS);
            job.setErrorMessage(failures.isEmpty()
                    ? null
                    : "Một số nền tảng chưa định dạng được: " + String.join("; ", failures));
        } else {
            job.setStatus(GenerationJobStatus.FAILED);
            job.setErrorMessage(failures.isEmpty()
                    ? "Định dạng nội dung thất bại"
                    : String.join("; ", failures));
        }
        jobRepository.save(job);
    }

    private Platform parsePlatform(String token) {
        try {
            return Platform.valueOf(token.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            log.warn("[ContentFormatting] Bỏ qua nền tảng không hợp lệ: {}", token);
            return null;
        }
    }
}
