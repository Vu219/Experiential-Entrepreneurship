package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.service.LandingContentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/landing")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Landing", description = "Nội dung Landing Page công khai.")
public class LandingContentController {

    LandingContentService landingContentService;

    @GetMapping("/public")
    @SecurityRequirements({})
    @Operation(summary = "Nội dung Landing Page đã xuất bản (public)",
            description = "Map khoá section (hero, features, how_it_works, integrations, cta, faq, footer) → "
                    + "nội dung song ngữ. Chỉ trả bản ĐÃ XUẤT BẢN, không cần đăng nhập.")
    public ApiResponse<Map<String, Object>> getPublic() {
        return landingContentService.getPublic();
    }
}
