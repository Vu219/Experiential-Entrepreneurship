package com.aima.service.Impl;

import com.aima.dto.ai.RegeneratePartPayload;
import com.aima.dto.ai.RegeneratePartResultPayload;
import com.aima.dto.ai.ScriptSectionPayload;
import com.aima.dto.ai.ScriptStepPayload;
import com.aima.dto.common.ScriptSectionDto;
import com.aima.dto.common.ScriptStepDto;
import com.aima.dto.common.VideoScriptDto;
import com.aima.dto.response.ScriptPartPatch;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentRegenerationJob;
import com.aima.entity.ContentVersion;
import com.aima.enums.AiTaskCode;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.RegenField;
import com.aima.enums.RegenSection;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AiContentMapper;
import com.aima.repository.ContentRegenerationJobRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.AiUsageService;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.ContentRegenerationWorkerService;
import com.aima.service.ScheduleHoldService;
import com.aima.util.ScriptJson;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Xử lý nền cho {@link ContentRegenerationJob} (NFR-04, cùng mẫu ContentGeneration): cuộc gọi AI
 * chạy NGOÀI transaction, mỗi bước ghi DB là một transaction ngắn qua {@link TransactionTemplate}.
 * <p>
 * PATCH IN-PLACE: worker đọc script HIỆN TẠI của version từ DB, chỉ ghi đè đúng nhánh được tạo lại
 * (hook/body/cta × content/scene), giữ nguyên mọi nhánh khác → không clobber phần khác. Không tạo
 * ContentVersion mới; kết quả (chỉ fragment) lưu vào {@code resultPatch} cho FE poll merge.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ContentRegenerationWorkerServiceImpl implements ContentRegenerationWorkerService {

    ContentRegenerationJobRepository jobRepository;
    ContentVersionRepository contentVersionRepository;
    AiServiceClient aiServiceClient;
    AiContentMapper aiContentMapper;
    AiUsageService aiUsageService;
    ObjectMapper objectMapper;
    TransactionTemplate transactionTemplate;
    ContentItemStatusResolver statusResolver;
    ScheduleHoldService holdService;

    /** Payload + ngữ cảnh event usage, dựng trong TX ngắn #1 để dùng ngoài transaction. */
    private record RegenerationTask(RegeneratePartPayload payload, AiUsageService.AiCallContext callContext) {
    }

    @Async("contentRegenerationExecutor")
    @Override
    public void process(UUID jobId) {
        // TX ngắn #1: RUNNING + dựng payload từ dữ liệu lazy, commit ngay (client poll thấy RUNNING).
        RegenerationTask task = transactionTemplate.execute(status -> markRunningAndBuildPayload(jobId));
        if (task == null) {
            return; // job không tồn tại / version đã mất
        }
        try {
            // Gọi AI NGOÀI transaction (rule #24), bọc recordCall để ghi event usage (kể cả lỗi).
            RegeneratePartResultPayload result = aiUsageService.recordCall(task.callContext(),
                    () -> aiServiceClient.regeneratePart(task.payload()));
            transactionTemplate.executeWithoutResult(status -> saveSuccess(jobId, result));
        } catch (Exception e) {
            String message = e.getMessage();
            log.warn("[ContentRegen] Job {} thất bại: {}", jobId, message, e);
            transactionTemplate.executeWithoutResult(status -> saveFailure(jobId, message));
        }
    }

    private RegenerationTask markRunningAndBuildPayload(UUID jobId) {
        ContentRegenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentRegen] Job {} không tồn tại khi bắt đầu xử lý", jobId);
            return null;
        }
        ContentVersion version = job.getContentVersion();
        if (version == null || version.getDeletedAt() != null) {
            saveFailureOn(job, "Bản nội dung không còn tồn tại");
            return null;
        }
        if (job.getStatus() != GenerationJobStatus.PENDING) {
            // Đã bị job dọn kẹt chốt FAILED trong lúc chờ hàng đợi executor — không chạy lại.
            log.warn("[ContentRegen] Job {} không còn PENDING ({}) — bỏ qua", jobId, job.getStatus());
            return null;
        }
        job.setStatus(GenerationJobStatus.RUNNING);
        jobRepository.save(job);

        ContentItem item = version.getContentItem();
        BrandProfile brand = item.getBrandProfile();
        VideoScriptDto script = parseOrEmpty(version.getScript());
        RegeneratePartPayload payload = RegeneratePartPayload.builder()
                .brandProfile(aiContentMapper.toBrandProfilePayload(brand))
                .platform(version.getPlatformName().name())
                .section(job.getSection().name().toLowerCase())
                .field(job.getField().name().toLowerCase())
                .stepIndex(job.getStepIndex())
                .currentScript(aiContentMapper.toVideoScriptPayload(script))
                .build();
        AiUsageService.AiCallContext callContext = AiUsageService.AiCallContext.of(
                brand.getUser(), AiTaskCode.CONTENT_REGENERATION, jobId, job.getClientIp(), job.getUserAgent());
        return new RegenerationTask(payload, callContext);
    }

    // Patch đúng nhánh vào script HIỆN TẠI của version (đọc lại từ DB), lưu fragment vào job.
    // Cùng quy tắc sửa tay (ContentItemServiceImpl.updateVersion): khóa bài trước (item → version → job),
    // kiểm lại khóa đang đăng, đổi thật thì tăng revision + bỏ duyệt cũ / giữ lịch chờ duyệt lại.
    private void saveSuccess(UUID jobId, RegeneratePartResultPayload result) {
        ContentRegenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return;
        }
        // Khóa bài TRƯỚC khi nạp version (proxy lazy chỉ lộ id) → đọc đúng bản đã commit mới nhất.
        UUID itemId = contentVersionRepository.findContentItemId(job.getContentVersion().getId()).orElse(null);
        ContentItem item = itemId == null ? null : statusResolver.lock(itemId);
        ContentVersion version = job.getContentVersion();
        if (item == null || item.getDeletedAt() != null || version.getDeletedAt() != null) {
            saveFailureOn(job, "Bản nội dung không còn tồn tại");
            return;
        }
        // Lịch chuyển POSTING trong lúc gọi AI → không ghi đè bản đang đăng (worker ghi FAILED với message này).
        if (ContentItemServiceImpl.isPostingLocked(version)) {
            throw new AppException(ErrorCode.CONTENT_VERSION_POSTING_LOCKED);
        }

        VideoScriptDto script = parseOrEmpty(version.getScript());
        String before = ScriptJson.toJson(script); // so trên cùng dạng chuẩn hoá — AI trả y nguyên = no-op như sửa tay
        ScriptPartPatch patch = applyPatch(job.getSection(), job.getField(), job.getStepIndex(), script, result);

        String after = ScriptJson.toJson(script);
        if (!Objects.equals(before, after)) {
            version.setScript(after);
            version.setRevision(version.getRevision() + 1); // format đang chạy trên revision cũ sẽ bỏ kết quả
            contentVersionRepository.save(version);
            // Nội dung đổi thật → bỏ duyệt cũ; policy bật thì giữ lịch chờ duyệt lại (tự tính lại trạng thái tổng).
            holdService.onContentChanged(item);
        }

        try {
            job.setResultPatch(objectMapper.writeValueAsString(patch));
        } catch (Exception e) {
            log.warn("[ContentRegen] Không serialize được patch job {}: {}", jobId, e.getMessage());
        }
        job.setStatus(GenerationJobStatus.SUCCESS);
        jobRepository.save(job);

        // Usage (event + cache hạn mức) đã được recordCall ghi tại thời điểm gọi AI.
    }

    /** Ghi đè CHỈ nhánh được yêu cầu vào {@code script} và trả về fragment (chỉ phần thay đổi). */
    private ScriptPartPatch applyPatch(RegenSection section, RegenField field, Integer stepIndex,
                                       VideoScriptDto script, RegeneratePartResultPayload result) {
        ScriptPartPatch.ScriptPartPatchBuilder patch = ScriptPartPatch.builder()
                .section(section).field(field).stepIndex(stepIndex);

        if (section == RegenSection.HOOK || section == RegenSection.CTA) {
            ScriptSectionPayload ai = result.getSection();
            if (ai == null) {
                throw new AppException(ErrorCode.AI_SERVICE_ERROR);
            }
            ScriptSectionDto target = section == RegenSection.HOOK ? script.getHook() : script.getCta();
            if (target == null) {
                target = ScriptSectionDto.builder().build();
                if (section == RegenSection.HOOK) {
                    script.setHook(target);
                } else {
                    script.setCta(target);
                }
            }
            if (field == RegenField.CONTENT) {
                target.setContent(nullToEmpty(ai.getContent()));
                if (StringUtils.hasText(ai.getTiming())) {
                    target.setTiming(ai.getTiming());
                }
                patch.text(target.getContent()).timing(target.getTiming());
            } else {
                target.setSceneSuggestion(nullToEmpty(ai.getSceneSuggestion()));
                patch.text(target.getSceneSuggestion());
            }
            return patch.build();
        }

        // BODY — patch nội dung/scene của các bước; single-step chỉ áp đúng index yêu cầu.
        List<ScriptStepPayload> aiSteps = result.getSteps();
        if (aiSteps == null || aiSteps.isEmpty()) {
            throw new AppException(ErrorCode.AI_SERVICE_ERROR);
        }
        List<ScriptStepDto> steps = script.getSteps() != null ? script.getSteps() : new ArrayList<>();
        List<ScriptPartPatch.StepPatch> stepPatches = new ArrayList<>();
        for (ScriptStepPayload ai : aiSteps) {
            if (stepIndex != null && !stepIndex.equals(ai.getIndex())) {
                continue; // tạo lại 1 bước: bỏ qua bước AI trả dư
            }
            ScriptStepDto step = steps.stream()
                    .filter(s -> Objects.equals(s.getIndex(), ai.getIndex()))
                    .findFirst().orElse(null);
            if (step == null) {
                continue; // index lạ (bước đã bị xóa) → bỏ qua, không thêm mới
            }
            String text;
            if (field == RegenField.CONTENT) {
                text = nullToEmpty(ai.getContent());
                step.setContent(text);
            } else {
                text = nullToEmpty(ai.getSceneSuggestion());
                step.setSceneSuggestion(text);
            }
            stepPatches.add(ScriptPartPatch.StepPatch.builder().index(step.getIndex()).text(text).build());
        }
        if (stepPatches.isEmpty()) {
            throw new AppException(ErrorCode.AI_SERVICE_ERROR);
        }
        patch.steps(stepPatches);
        return patch.build();
    }

    private void saveFailure(UUID jobId, String message) {
        ContentRegenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job != null) {
            saveFailureOn(job, message);
        }
    }

    private void saveFailureOn(ContentRegenerationJob job, String message) {
        job.setStatus(GenerationJobStatus.FAILED);
        job.setErrorMessage(message);
        jobRepository.save(job);
    }

    private VideoScriptDto parseOrEmpty(String raw) {
        VideoScriptDto script = ScriptJson.parse(raw);
        if (script == null) {
            return VideoScriptDto.builder()
                    .hook(ScriptSectionDto.builder().build())
                    .steps(new ArrayList<>())
                    .cta(ScriptSectionDto.builder().build())
                    .build();
        }
        if (script.getSteps() == null) {
            script.setSteps(new ArrayList<>());
        }
        return script;
    }

    private String nullToEmpty(String v) {
        return v == null ? "" : v;
    }
}
