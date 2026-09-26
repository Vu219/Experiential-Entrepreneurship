package com.aima.landing;

import com.aima.config.init.LandingDataInitializer;
import com.aima.dto.request.LandingSectionUpdateRequest;
import com.aima.dto.response.LandingSectionResponse;
import com.aima.entity.LandingSection;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.LandingSectionMapperImpl;
import com.aima.repository.LandingSectionRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.Impl.LandingContentServiceImpl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class LandingContentServiceImplTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private LandingSectionRepository repository;
    private LandingContentServiceImpl service;
    /** Nội dung seed theo section — lấy từ chính LandingDataInitializer để test luôn seed hợp lệ. */
    private final Map<String, String> seed = new HashMap<>();

    @BeforeEach
    void setUp() {
        LandingSectionRepository seedRepo = mock(LandingSectionRepository.class);
        when(seedRepo.existsBySectionKey(anyString())).thenReturn(false);
        ArgumentCaptor<LandingSection> captor = ArgumentCaptor.forClass(LandingSection.class);
        new LandingDataInitializer(seedRepo, objectMapper).run();
        verify(seedRepo, times(7)).save(captor.capture());
        captor.getAllValues().forEach(s -> seed.put(s.getSectionKey(), s.getDraftContent()));

        repository = mock(LandingSectionRepository.class);
        when(repository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new LandingContentServiceImpl(repository, new LandingSectionMapperImpl(),
                mock(ActivityLogService.class), Validation.buildDefaultValidatorFactory().getValidator(),
                objectMapper);
    }

    private LandingSection section(String key) {
        LandingSection s = LandingSection.builder().sectionKey(key)
                .draftContent(seed.get(key)).publishedContent(seed.get(key)).version(3L).build();
        when(repository.findBySectionKeyAndDeletedAtIsNull(key)).thenReturn(Optional.of(s));
        return s;
    }

    private Map<String, Object> content(String key) throws Exception {
        return objectMapper.readValue(seed.get(key), new TypeReference<>() {
        });
    }

    private LandingSectionUpdateRequest request(Map<String, Object> content, long version) {
        return LandingSectionUpdateRequest.builder().content(content).version(version).build();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> child(Map<String, Object> parent, String key) {
        return (Map<String, Object>) parent.get(key);
    }

    @Test
    void seedOfEverySectionPassesValidation() throws Exception {
        for (String key : seed.keySet()) {
            section(key);
            LandingSectionResponse res = service.saveDraft(key, request(content(key), 3L)).getResult();
            assertFalse(res.isHasUnpublishedChanges(), "seed lưu lại không được tạo thay đổi: " + key);
        }
    }

    @Test
    void saveDraftKeepsPublishedAndFlagsChanges() throws Exception {
        LandingSection s = section("hero");
        Map<String, Object> hero = content("hero");
        child(hero, "badge").put("vi", "Badge mới");
        hero.put("unknownField", "bị bỏ");

        LandingSectionResponse res = service.saveDraft("hero", request(hero, 3L)).getResult();

        assertTrue(res.isHasUnpublishedChanges());
        assertEquals(seed.get("hero"), s.getPublishedContent(), "lưu nháp không được đổi bản live");
        assertTrue(s.getDraftContent().contains("Badge mới"));
        assertFalse(s.getDraftContent().contains("unknownField"));
    }

    @Test
    void publishCopiesDraftToPublished() throws Exception {
        LandingSection s = section("hero");
        s.setDraftContent(seed.get("hero").replace("Tự động hoá", "Tự vận hành"));

        LandingSectionResponse res = service.publish("hero").getResult();

        assertFalse(res.isHasUnpublishedChanges());
        assertTrue(s.getPublishedContent().contains("Tự vận hành"));
        assertNotNull(s.getPublishedAt());
    }

    @Test
    void blankEnglishTitleIsRejected() throws Exception {
        section("faq");
        Map<String, Object> faq = content("faq");
        child(faq, "title").put("en", "   ");

        AppException ex = assertThrows(AppException.class, () -> service.saveDraft("faq", request(faq, 3L)));
        assertEquals(ErrorCode.LANDING_CONTENT_INVALID, ex.getErrorCode());
    }

    @Test
    void invalidLinkIsRejected() throws Exception {
        section("cta");
        Map<String, Object> cta = content("cta");
        child(cta, "primaryCta").put("href", "javascript:alert(1)");

        AppException ex = assertThrows(AppException.class, () -> service.saveDraft("cta", request(cta, 3L)));
        assertEquals(ErrorCode.LANDING_CONTENT_INVALID, ex.getErrorCode());
    }

    @Test
    void platformNeedsIconOrLogo() throws Exception {
        section("integrations");
        Map<String, Object> integrations = content("integrations");
        integrations.put("platforms", List.of(Map.of("name", "TikTok", "icon", "", "logoUrl", "")));

        assertThrows(AppException.class, () -> service.saveDraft("integrations", request(integrations, 3L)));

        integrations.put("platforms", List.of(Map.of("name", "TikTok", "icon", "", "logoUrl", "https://cdn.x/logo.png")));
        assertDoesNotThrow(() -> service.saveDraft("integrations", request(integrations, 3L)));
    }

    @Test
    void staleVersionIsRejected() throws Exception {
        section("hero");

        AppException ex = assertThrows(AppException.class, () -> service.saveDraft("hero", request(content("hero"), 2L)));
        assertEquals(ErrorCode.LANDING_VERSION_CONFLICT, ex.getErrorCode());
    }

    @Test
    void unknownSectionIsNotFound() {
        AppException ex = assertThrows(AppException.class, () -> service.publish("pricing"));
        assertEquals(ErrorCode.LANDING_SECTION_NOT_FOUND, ex.getErrorCode());
    }
}
