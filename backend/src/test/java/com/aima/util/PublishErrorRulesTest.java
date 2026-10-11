package com.aima.util;

import com.aima.dto.publish.PlatformErrorDetail;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorType;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Luật phân loại lỗi đăng bài — fixture theo payload lỗi trong tài liệu chính thức của Meta
 * (Graph API "Handling Errors" + "Rate Limiting", Threads "Troubleshooting"); xem
 * docs/failed-posts-error-handling-plan.md §2.3.
 */
class PublishErrorRulesTest {

    private static PlatformErrorDetail graph(int http, Integer code, Integer subcode, String message) {
        return new PlatformErrorDetail(Platform.FACEBOOK, http, code, subcode, "OAuthException", message,
                null, null, "AbCdEf123", false, null);
    }

    @Test
    void tokenErrors_splitBySubcode() {
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED,
                PublishErrorRules.classify(graph(400, 190, null, "Error validating access token")));
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED,
                PublishErrorRules.classify(graph(400, 190, 463, "Session has expired on Friday")));
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED,
                PublishErrorRules.classify(graph(400, 190, 467, "Invalid OAuth access token")));
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED, PublishErrorRules.classify(graph(400, 102, null, "Session key invalid")));
        assertEquals(PublishErrorCode.AUTH_APP_REMOVED,
                PublishErrorRules.classify(graph(400, 190, 458, "The user has not authorized application")));
        assertEquals(PublishErrorCode.AUTH_PASSWORD_CHANGED,
                PublishErrorRules.classify(graph(400, 190, 460, "The session has been invalidated because the user changed their password")));
        assertEquals(PublishErrorCode.ACCOUNT_CHECKPOINT, PublishErrorRules.classify(graph(400, 190, 459, "User is checkpointed")));
        assertEquals(PublishErrorCode.ACCOUNT_CHECKPOINT, PublishErrorRules.classify(graph(400, 190, 464, "Unconfirmed user")));
        assertEquals(PublishErrorCode.AUTH_PAGE_ROLE_MISSING,
                PublishErrorRules.classify(graph(400, 190, 492, "Invalid session")));
    }

    @Test
    void permissionErrors() {
        assertEquals(PublishErrorCode.AUTH_PERMISSION_MISSING,
                PublishErrorRules.classify(graph(403, 10, null, "(#10) Application does not have permission for this action")));
        assertEquals(PublishErrorCode.AUTH_PERMISSION_MISSING,
                PublishErrorRules.classify(graph(403, 200, null, "(#200) Requires pages_manage_posts permission")));
        assertEquals(PublishErrorCode.AUTH_PERMISSION_MISSING,
                PublishErrorRules.classify(graph(403, 299, null, "(#299) Requires extended permission")));
        assertEquals(PublishErrorCode.AUTH_PERMISSION_MISSING,
                PublishErrorRules.classify(graph(400, 100, 33, "Unsupported post request. Object with ID '1' does not exist,"
                        + " cannot be loaded due to missing permissions")));
    }

    @Test
    void policyErrors() {
        // 368 = tài khoản bị TẠM CHẶN (không phải nội dung bài) — vẫn không tự đăng lại (BR-07).
        PublishErrorCode block = PublishErrorRules.classify(graph(400, 368,
                null, "The action attempted has been deemed abusive or is otherwise disallowed"));
        assertEquals(PublishErrorCode.POLICY_TEMPORARY_BLOCK, block);
        assertEquals(PublishErrorType.POLICY_VIOLATION, block.legacyType());
        assertFalse(block.isAutoRetry());

        assertEquals(PublishErrorCode.POLICY_VIOLATION,
                PublishErrorRules.classify(graph(400, 100, null, "This content violates our Community Standards")));
        assertEquals(PublishErrorCode.POLICY_VIOLATION,
                PublishErrorRules.classify(graph(400, 9999, null, "Rejected by advertising policy")));
    }

    @Test
    void rateLimits_areAutoRetried() {
        for (int code : new int[]{4, 17, 32, 341, 613, 80001, 80002, 80014}) {
            PublishErrorCode result = PublishErrorRules.classify(graph(400, code, null, "Application request limit reached"));
            assertEquals(PublishErrorCode.RATE_LIMITED, result, "code " + code);
            assertTrue(result.isAutoRetry());
            assertEquals(PublishErrorType.TEMPORARY, result.legacyType());
        }
        assertEquals(PublishErrorCode.RATE_LIMITED, PublishErrorRules.classify(graph(429, null, null, "Too Many Requests")));
        assertEquals(PublishErrorCode.UNKNOWN, PublishErrorRules.classify(graph(400, 80015, null, "x")), "80015 ngoài dải BUC");
    }

    @Test
    void temporaryPlatformErrors() {
        assertEquals(PublishErrorCode.PLATFORM_TEMPORARY, PublishErrorRules.classify(graph(500, 1, null, "An unknown error occurred")));
        assertEquals(PublishErrorCode.PLATFORM_TEMPORARY, PublishErrorRules.classify(graph(503, 2, null, "Service temporarily unavailable")));
        assertEquals(PublishErrorCode.PLATFORM_TEMPORARY, PublishErrorRules.classify(graph(502, null, null, "HTTP 502")));
        assertEquals(PublishErrorCode.PLATFORM_TEMPORARY, PublishErrorRules.classify(new PlatformErrorDetail(
                Platform.THREADS, 400, 9007, null, null, "Try later", null, null, null, true, null)));
    }

    @Test
    void contentErrors() {
        assertEquals(PublishErrorCode.CONTENT_DUPLICATE,
                PublishErrorRules.classify(graph(400, 506, null, "Duplicate status message")));
        assertEquals(PublishErrorCode.CONTENT_INVALID,
                PublishErrorRules.classify(graph(400, 1609005, null, "Error posting link")));
        assertEquals(PublishErrorCode.CONTENT_INVALID,
                PublishErrorRules.classify(graph(400, 100, null, "(#100) Param message must be a string")));
        assertTrue(PublishErrorCode.CONTENT_DUPLICATE.isRequiresContentChange());
    }

    @Test
    void accountAndQuotaAndMediaByMessage() {
        assertEquals(PublishErrorCode.ACCOUNT_RESTRICTED,
                PublishErrorRules.classify(graph(400, 9999, null, "Your account is restricted right now")));
        assertEquals(PublishErrorCode.QUOTA_EXCEEDED,
                PublishErrorRules.classify(graph(400, 9999, null, "You have reached the publishing limit")));
        assertEquals(PublishErrorCode.MEDIA_INVALID,
                PublishErrorRules.classify(graph(400, 9999, null, "Container status ERROR: INVALID_ASPEC_RATIO")));
        assertEquals(PublishErrorCode.UNKNOWN, PublishErrorRules.classify(graph(400, 12345, null, "Something odd")));
    }

    @Test
    void internalCodes() {
        assertEquals(PublishErrorCode.NETWORK_TIMEOUT, PublishErrorRules.classifyInternal(PublishErrorRules.CODE_NETWORK));
        assertEquals(PublishErrorCode.CONTENT_TOO_LONG, PublishErrorRules.classifyInternal(PublishErrorRules.CODE_TEXT_LIMIT));
        assertEquals(PublishErrorCode.MEDIA_REQUIRED, PublishErrorRules.classifyInternal(PublishErrorRules.CODE_MEDIA_REQUIRED));
        assertEquals(PublishErrorCode.ACCOUNT_TYPE_UNSUPPORTED, PublishErrorRules.classifyInternal(PublishErrorRules.CODE_ACCOUNT_TYPE));
        assertEquals(PublishErrorCode.PUBLISH_INTERRUPTED, PublishErrorRules.classifyInternal(PublishErrorRules.CODE_STUCK_RUNNING));
        assertEquals(PublishErrorCode.INTERNAL_ERROR, PublishErrorRules.classifyInternal(PublishErrorRules.CODE_INTERNAL));
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED, PublishErrorRules.classifyInternal(PublishErrorRules.CODE_TOKEN_EXPIRED));
        assertNull(PublishErrorRules.classifyInternal("190"));
        assertNull(PublishErrorRules.classifyInternal(null));
    }

    @Test
    void legacyRows_normalizedFromStoredCodeMessageAndType() {
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED,
                PublishErrorRules.classifyLegacy("190", "Error validating access token", PublishErrorType.PERMANENT));
        assertEquals(PublishErrorCode.POLICY_TEMPORARY_BLOCK,
                PublishErrorRules.classifyLegacy("368", "blocked", PublishErrorType.POLICY_VIOLATION));
        assertEquals(PublishErrorCode.CONTENT_TOO_LONG,
                PublishErrorRules.classifyLegacy("TEXT_LIMIT_EXCEEDED", "Threads tối đa 500 ký tự", PublishErrorType.PERMANENT));
        // HTTP status lưu thay mã Graph khi body không phải JSON.
        assertEquals(PublishErrorCode.PLATFORM_TEMPORARY, PublishErrorRules.classifyLegacy("503", "HTTP 503", PublishErrorType.TEMPORARY));
        assertEquals(PublishErrorCode.RATE_LIMITED, PublishErrorRules.classifyLegacy("429", "HTTP 429", PublishErrorType.TEMPORARY));
        assertEquals(PublishErrorCode.CONTENT_DUPLICATE, PublishErrorRules.classifyLegacy("506", "Duplicate", PublishErrorType.PERMANENT));
        // Lỗi nội bộ cũ (message là tên exception) → INTERNAL_ERROR, không UNKNOWN.
        assertEquals(PublishErrorCode.INTERNAL_ERROR, PublishErrorRules.classifyLegacy("INTERNAL",
                "Lỗi nội bộ khi đăng bài — LazyInitializationException: could not initialize proxy", PublishErrorType.INTERNAL));
        // Không suy được → theo phân loại thô.
        assertEquals(PublishErrorCode.PLATFORM_TEMPORARY, PublishErrorRules.classifyLegacy(null, null, PublishErrorType.TEMPORARY));
        assertEquals(PublishErrorCode.UNKNOWN, PublishErrorRules.classifyLegacy("777", "odd", PublishErrorType.PERMANENT));
        assertEquals(PublishErrorCode.UNKNOWN, PublishErrorRules.classifyLegacy(null, null, null));
    }

    @Test
    void everyCodeHasActionsAndAConsistentRetryType() {
        for (PublishErrorCode code : PublishErrorCode.values()) {
            assertFalse(code.actions().isEmpty(), code.name());
            assertEquals(code.isAutoRetry(), code.legacyType() == PublishErrorType.TEMPORARY,
                    code + ": chỉ lỗi tạm thời mới tự retry (FR-56)");
        }
        assertEquals(PublishErrorCode.UNKNOWN, PublishErrorCode.parse("UNKNOWN"));
        assertNull(PublishErrorCode.parse("NOT_A_CODE"));
    }

    @Test
    void referenceCode_isDeterministicAndSearchable() {
        UUID jobId = UUID.fromString("3f9a1c2b-0000-4000-8000-000000000001");
        assertEquals("ERR-3F9A1C", PublishReference.of(jobId));
        assertEquals("3f9a1c", PublishReference.toIdPrefix(" err-3F9A1C "));
        assertNull(PublishReference.toIdPrefix("caption có chữ ERR"));
        assertNull(PublishReference.of(null));
    }
}
