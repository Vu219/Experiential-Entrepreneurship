package com.aima.content;

import com.aima.dto.ai.BrandVoiceCheckPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.ScriptSectionPayload;
import com.aima.dto.ai.ScriptStepPayload;
import com.aima.dto.ai.VideoScriptPayload;
import com.aima.dto.common.VideoScriptDto;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.response.ContentItemResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.Platform;
import com.aima.mapper.ContentItemMapper;
import com.aima.mapper.ContentItemMapperImpl;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Hợp đồng B2: kết quả /generate của Python → ContentVersion GIÀU (kèm brand-voice,
 * image_prompt), response bài chỉ chứa bản còn hiệu lực, và partial update version.
 * Test thuần (không Spring context) — dùng thẳng MapStruct impl đã generate.
 */
class ContentVersionMappingTest {

    private final ContentItemMapper mapper = new ContentItemMapperImpl();

    private GeneratedContentResult sampleResult() {
        return GeneratedContentResult.builder()
                .script(VideoScriptPayload.builder()
                        .hook(ScriptSectionPayload.builder()
                                .content("Da xỉn màu, lỗ chân lông to?")
                                .sceneSuggestion("Cận cảnh da trước gương").timing("0-3s").build())
                        .steps(List.of(
                                ScriptStepPayload.builder().index(1)
                                        .content("Làm sạch").sceneSuggestion("Cận cảnh rửa mặt").build(),
                                ScriptStepPayload.builder().index(2)
                                        .content("Dưỡng ẩm + chống nắng").sceneSuggestion("Text nổi từng bước").build()))
                        .cta(ScriptSectionPayload.builder()
                                .content("Theo dõi để nhận mẹo mỗi ngày!")
                                .sceneSuggestion("Logo + nút follow").timing("25-30s").build())
                        .build())
                .caption("Chỉ 3 bước mỗi ngày, da bạn đổi khác bất ngờ.")
                .hashtags(List.of("skincare", "toigian"))
                .cta("Theo dõi kênh nhé!")
                .mediaPrompt("Clip quay routine 3 bước, ánh sáng tự nhiên.")
                .imagePrompt("Ảnh vuông bàn trang điểm tối giản, tông pastel.")
                .brandVoiceCheck(BrandVoiceCheckPayload.builder().aligned(true).score(91).notes("Đúng giọng").build())
                .build();
    }

    @Test
    void generatedResultMapsToRichVersion() {
        ContentVersion version = mapper.toGeneratedVersion(sampleResult());

        // script lưu dạng JSON có cấu trúc — parse lại phải giữ đủ hook/steps/cta + timing + cảnh quay.
        VideoScriptDto script = mapper.parseScript(version.getScript());
        assertEquals("Da xỉn màu, lỗ chân lông to?", script.getHook().getContent());
        assertEquals("0-3s", script.getHook().getTiming());
        assertEquals(2, script.getSteps().size());
        assertEquals("Cận cảnh rửa mặt", script.getSteps().get(0).getSceneSuggestion());
        assertEquals("Theo dõi để nhận mẹo mỗi ngày!", script.getCta().getContent());
        assertEquals("25-30s", script.getCta().getTiming());
        assertEquals("Chỉ 3 bước mỗi ngày, da bạn đổi khác bất ngờ.", version.getFormattedCaption());
        assertEquals("skincare,toigian", version.getFormattedHashtag());
        assertEquals("Theo dõi kênh nhé!", version.getCta());
        assertEquals("Clip quay routine 3 bước, ánh sáng tự nhiên.", version.getMediaPrompt());
        assertEquals("Ảnh vuông bàn trang điểm tối giản, tông pastel.", version.getImagePrompt());
        // FR-30: brand voice giờ được persist thay vì bỏ qua.
        assertEquals(Boolean.TRUE, version.getVoiceAligned());
        assertEquals(91, version.getVoiceScore());
        assertEquals("Đúng giọng", version.getVoiceNotes());
        assertEquals(ContentVersionStatus.GENERATED, version.getStatus());
    }

    @Test
    void itemResponseContainsOnlyActiveVersionsAndBrandName() {
        UUID brandId = UUID.randomUUID();
        BrandProfile brand = new BrandProfile();
        brand.setId(brandId);
        brand.setBrandName("AIMA Skincare");

        ContentVersion active = mapper.toGeneratedVersion(sampleResult());
        active.setPlatformName(Platform.FACEBOOK);
        ContentVersion replaced = mapper.toGeneratedVersion(sampleResult());
        replaced.setPlatformName(Platform.FACEBOOK);
        replaced.setDeletedAt(LocalDateTime.now()); // bản cũ đã bị retry thay thế

        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.getContentVersions().addAll(List.of(replaced, active));

        ContentItemResponse response = mapper.toResponse(item);
        assertEquals(1, response.getVersions().size(), "chỉ bản còn hiệu lực được trả về");
        assertEquals(91, response.getVersions().get(0).getVoiceScore());
        assertEquals("AIMA Skincare", response.getBrandName());
        // Brand filter của thư viện nội dung lọc theo id — response phải mang brandProfileId.
        assertEquals(brandId, response.getBrandProfileId());
    }

    @Test
    void updateVersionIsPartial() {
        ContentVersion version = mapper.toGeneratedVersion(sampleResult());
        mapper.updateVersion(ContentVersionUpdateRequest.builder()
                .caption("Caption đã sửa tay")
                .hashtags(List.of("moi"))
                .build(), version);

        assertEquals("Caption đã sửa tay", version.getFormattedCaption());
        assertEquals("moi", version.getFormattedHashtag());
        // field bỏ trống giữ nguyên
        assertEquals("Da xỉn màu, lỗ chân lông to?",
                mapper.parseScript(version.getScript()).getHook().getContent());
        assertEquals("Theo dõi kênh nhé!", version.getCta());
        assertNull(version.getPlatformName(), "mapper không tự gán platform — worker gán");
    }

    @Test
    void legacyPlainScriptParsesAsFallback() {
        // Bài cũ lưu script dạng dòng — parse fallback: dòng đầu = hook, cuối = CTA, giữa = các bước.
        VideoScriptDto script = mapper.parseScript("Hook cũ\nBước giữa 1\nBước giữa 2\nCTA cũ");
        assertEquals("Hook cũ", script.getHook().getContent());
        assertEquals(2, script.getSteps().size());
        assertEquals("Bước giữa 1", script.getSteps().get(0).getContent());
        assertEquals("CTA cũ", script.getCta().getContent());
        assertNull(script.getHook().getTiming(), "bài cũ không có timing");
    }
}
