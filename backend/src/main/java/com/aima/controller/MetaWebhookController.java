package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.service.MetaWebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/webhooks/meta")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Meta Webhook", description = "Post-publication violation notifications from Meta (SEC-06, EX-02). Public — secured by verify token + payload signature.")
public class MetaWebhookController {

    MetaWebhookService metaWebhookService;

    // Ngoại lệ rule #3 (cùng loại PlatformConnectionController.callback): Meta so sánh NGUYÊN VĂN
    // hub.challenge trả về khi xác thực đăng ký — không thể bọc trong ApiResponse envelope.
    @GetMapping
    @SecurityRequirements({})
    @Operation(summary = "Webhook subscription verification",
            description = "Meta calls this once when the webhook URL is registered; echoes hub.challenge verbatim when the verify token matches.")
    public ResponseEntity<String> verify(@RequestParam(name = "hub.mode", required = false) String mode,
                                         @RequestParam(name = "hub.verify_token", required = false) String verifyToken,
                                         @RequestParam(name = "hub.challenge", required = false) String challenge) {
        return ResponseEntity.ok(metaWebhookService.verify(mode, verifyToken, challenge));
    }

    @PostMapping
    @SecurityRequirements({})
    @Operation(summary = "Receive webhook events",
            description = "Signature-checked (X-Hub-Signature-256), stored with de-duplication, answered 200 immediately and processed "
                    + "asynchronously. Page feed: new post → page re-scan, engagement → post re-sync in ~5 min, removed post → "
                    + "\"deleted on platform\" (post status unchanged, no notification). Dashboard test events (page id 0) are stored as IGNORED.")
    public ApiResponse<Void> receive(@RequestBody String body,
                                     @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature) {
        metaWebhookService.handleEvent(body, signature);
        return ApiResponse.success("Đã nhận webhook");
    }
}
