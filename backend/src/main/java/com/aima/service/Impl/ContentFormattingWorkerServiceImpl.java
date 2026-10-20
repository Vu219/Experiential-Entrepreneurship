package com.aima.service.Impl;

import com.aima.service.JobEventService;
import com.aima.enums.RealtimeJobKind;
import com.aima.dto.ai.BrandProfileInputPayload;
import com.aima.dto.ai.ContentVersionPayload;
import com.aima.dto.ai.FormatContentPayload;
import com.aima.dto.ai.FormatPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.entity.ContentFormattingJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.AiTaskCode;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.ContentFormattingMapper;
import com.aima.repository.ContentFormattingJobRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.ScheduleHoldService;
import com.aima.service.ContentFormattingWorkerService;
import com.aima.service.AiUsageService;
import com.aima.service.TokenUsageService;
import com.aima.util.UserFacingErrors;
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
    ContentItemStatusResolver statusResolver;
    ScheduleHoldService holdService;
    JobEventService jobEventService;

    /** Nguồn format của MỘT nền tảng: id bản GỐC (để adapt từ bản gốc + gắn source_version_id) + payload gửi AI. */
    /** Nguồn format của một nền tảng + bản đang hiệu lực lúc bắt đầu (id + revision) để phát hiện sửa/lên lịch giữa chừng. */
    private record PlatformSource(UUID sourceVersionId, FormatContentPayload payload, UUID activeVersionId, int activeRevision) {
    }

    /** Ngữ cảnh dựng trong transaction ngắn đầu tiên, tiêu thụ NGOÀI transaction khi gọi AI. */
    private record FormatContext(UUID userId,
                                 UUID itemId,
                                 BrandProfileInputPayload brandProfile,
                                 List<Platform> platforms,
                                 Map<Platform, PlatformSource> sources,
                                 AiUsageService.AiCallContext callContext) {
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

        int done = 0;
        for (Platform platform : ctx.platforms()) {
            if (done > 0) {
                // Tiến độ realtime sau mỗi nền tảng (stage chỉ có trong sự kiện, không lưu DB).
                jobEventService.formattingProgress(ctx.userId(), jobId, ctx.itemId(), done, ctx.platforms().size(),
                        ctx.platforms().get(done - 1));
            }
            done++;
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
                // NGOÀI transaction (rule #24); recordCall ghi event usage MỖI nền tảng một dòng
                // (mỗi nền tảng một cuộc gọi AI) — label = tên nền tảng để idempotency key không trùng.
                FormatResultPayload result = aiUsageService.recordCall(
                        ctx.callContext().withLabel(platform.name()),
                        () -> aiServiceClient.format(payload));
                if (result == null || result.getVersions() == null || result.getVersions().isEmpty()) {
                    // AI không trả bản nào cho nền tảng này → nền tảng THẤT BẠI (không tính là đã định dạng).
                    log.warn("[ContentFormatting] Job {} nền tảng {}: AI không trả bản định dạng nào", jobId, platform);
                    failures.add(platform + ": AI không trả bản định dạng nào");
                    continue;
                }
                transactionTemplate.executeWithoutResult(s -> savePlatformResult(jobId, platform, source, result));
                anySuccess = true;
            } catch (Exception e) {
                // AppException truyền message của ErrorCode vào super(...) nên getMessage() luôn có nghĩa.
                String message = UserFacingErrors.messageOf(e); // chuỗi kỹ thuật không lộ ra người dùng — e vẫn được log đủ
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
        if (job.getStatus() != GenerationJobStatus.PENDING) {
            // Đã bị job dọn kẹt chốt FAILED trong lúc chờ hàng đợi executor — không chạy lại.
            log.warn("[ContentFormatting] Job {} không còn PENDING ({}) — bỏ qua", jobId, job.getStatus());
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
                        sources.put(platform, new PlatformSource(sourceId, contentFormattingMapper.toFormatContentPayload(source),
                                active.getId(), active.getRevision()));
                    });
        }
        AiUsageService.AiCallContext callContext = AiUsageService.AiCallContext.of(
                item.getBrandProfile().getUser(), AiTaskCode.PLATFORM_FORMATTING, jobId,
                job.getClientIp(), job.getUserAgent());
        jobEventService.jobUpdated(item.getBrandProfile().getUser().getId(), RealtimeJobKind.FORMATTING, jobId,
                GenerationJobStatus.RUNNING.name(), item.getId(), null, null);
        return new FormatContext(item.getBrandProfile().getUser().getId(), item.getId(), brandProfile, platforms, sources,
                callContext);
    }

    private void checkQuota(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            tokenUsageService.checkQuota(user); // hết hạn mức tháng → AppException(TOKEN_QUOTA_EXCEEDED)
        }
    }

    // Lưu kết quả format của MỘT nền tảng: xóa mềm bản cũ cùng nền tảng (FR-46), thêm bản FORMATTED mới.
    // Job hoàn tất trễ: bản hiện hành đã bị sửa/thay/đang đăng/đã đăng so với lúc bắt đầu → bỏ kết quả.
    private void savePlatformResult(UUID jobId, Platform platform, PlatformSource expected, FormatResultPayload result) {
        UUID sourceVersionId = expected.sourceVersionId();
        ContentFormattingJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentFormatting] Job {} biến mất trước khi lưu kết quả", jobId);
            return;
        }

        List<ContentVersionPayload> payloads = result.getVersions() == null ? List.of() : result.getVersions();
        if (payloads.isEmpty()) {
            return; // AI không trả bản nào cho nền tảng này — coi như chưa format, không đụng bản cũ
        }
        // Khóa bài trước khi thay version (thứ tự item → version); trạng thái tổng tính lại ở cuối.
        ContentItem item = statusResolver.lock(job.getContentItem().getId());
        ContentVersion active = item.getContentVersions().stream()
                .filter(v -> v.getDeletedAt() == null && v.getPlatformName() == platform)
                .findFirst().orElse(null);
        PostSchedule schedule = active == null ? null : active.getPostSchedule();
        boolean scheduleLocked = schedule != null && schedule.getDeletedAt() == null
                && (schedule.getStatus() == ScheduleStatus.POSTING || schedule.getStatus() == ScheduleStatus.POSTED);
        if (active == null || !active.getId().equals(expected.activeVersionId())
                || active.getRevision() != expected.activeRevision() || scheduleLocked) {
            log.warn("[ContentFormatting] Job {} nền tảng {}: nội dung đã đổi/đang đăng trong lúc định dạng — bỏ kết quả",
                    jobId, platform);
            throw new AppException(ErrorCode.CONTENT_CHANGED_DURING_FORMAT);
        }

        LocalDateTime now = LocalDateTime.now();
        item.getContentVersions().stream()
                .filter(v -> v.getDeletedAt() == null && v.getPlatformName() == platform)
                .forEach(v -> v.setDeletedAt(now));

        // Bản GỐC để giữ nguyên kịch bản video (FR-25) + media prompt (FR-29) + image prompt +
        // brand voice metrics (FR-30) — format chỉ đổi trình bày caption/hashtag/CTA, KHÔNG sinh mới các trường này.
        ContentVersion source = contentVersionRepository.findById(sourceVersionId).orElse(null);

        List<ContentVersion> created = new ArrayList<>();
        payloads.forEach(payload -> {
            // Mapper set formatted_caption/hashtag/media_format + CTA (đã chuyển thể, không rỗng) + status FORMATTED.
            ContentVersion version = contentFormattingMapper.toContentVersion(payload);
            version.setContentItem(item);
            version.setSourceVersionId(sourceVersionId); // truy vết + "Định dạng lại" adapt từ bản gốc
            if (source != null) {
                version.setScript(source.getScript());
                version.setMediaPrompt(source.getMediaPrompt());
                version.setImagePrompt(source.getImagePrompt());
                version.setVoiceAligned(source.getVoiceAligned());
                version.setVoiceScore(source.getVoiceScore());
                version.setVoiceNotes(source.getVoiceNotes());
            }
            item.getContentVersions().add(version);
            created.add(version);
        });
        // Lịch chưa đăng của bản cũ (SCHEDULED/ON_HOLD/FAILED) chuyển sang bản mới — lịch đã hủy ở lại bản cũ.
        if (schedule != null && schedule.getDeletedAt() == null && schedule.getStatus() != ScheduleStatus.CANCELLED) {
            ContentVersion replacement = created.getFirst();
            // KHÔNG gán active.postSchedule = null: orphanRemoval trên phía inverse sẽ xoá cứng chính lịch này.
            schedule.setContentVersion(replacement);
            replacement.setPostSchedule(schedule);
        }

        jobRepository.save(job); // item + versions lưu qua cascade từ item đang managed trong tx
        // Nội dung đổi thật → bỏ duyệt cũ; policy bật thì giữ lịch chờ duyệt lại (tự tính lại trạng thái tổng).
        holdService.onContentChanged(item);

        // Usage (event + cache hạn mức) đã được recordCall ghi tại thời điểm gọi AI.
    }

    // Chốt trạng thái job sau khi lặp hết nền tảng: ≥1 nền tảng xong → SUCCESS; không nền tảng nào
    // xong → FAILED. Trạng thái tổng của item đã được resolver tính lại ở từng lần lưu nền tảng.
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
        jobEventService.jobUpdated(job.getContentItem().getBrandProfile().getUser().getId(), RealtimeJobKind.FORMATTING,
                jobId, job.getStatus().name(), job.getContentItem().getId(), null, null);
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
