package com.aima.controller;

import com.aima.dto.request.*;
import com.aima.dto.response.ActivityLogResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.dto.response.DeleteAccountResponse;
import com.aima.dto.response.MeResponse;
import com.aima.dto.response.ProfileStatsResponse;
import com.aima.dto.response.UserStatsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import com.aima.config.swagger.SwaggerExamples;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.TokenUsageResponse;
import com.aima.dto.response.UserResponse;
import com.aima.dto.response.UserUsageResponse;
import com.aima.service.ActivityLogService;
import com.aima.service.TokenUsageService;
import com.aima.service.UsageQueryService;
import com.aima.service.UserService;

import java.util.UUID;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Account", description = "Account management for both regular users and admins (registration, profile, password, deletion).")
public class AccountController {
    UserService userService;
    TokenUsageService tokenUsageService;
    UsageQueryService usageQueryService;
    ActivityLogService activityLogService;

    @PostMapping("/register")
    @Operation(
            summary = "Register a new user account",
            description = "Creates a new user after validating field constraints and email uniqueness. " +
                    "The username is set to the email and the role defaults to USER."
    )
    @SecurityRequirements({})
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(schema = @Schema(implementation = UserRegisterRequest.class),
                    examples = @ExampleObject(value = SwaggerExamples.REGISTER_REQUEST)))
    public ApiResponse<UserResponse> register(@Valid @RequestBody UserRegisterRequest request) {
        return userService.registerUser(request);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "List all users (paginated, FR-80)",
            description = "Returns user accounts in pages, newest first; optional q searches name/email, " +
                    "status/role/plan filter the result. Restricted to ADMIN."
    )
    public ApiResponse<PageResponse<UserResponse>> getAllUsers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) UserPlan plan,
            @ParameterObject @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return userService.getAllUsers(q, status, role, plan, pageable);
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "User statistics for the admin dashboard (FR-80)",
            description = "Returns total / active / locked / new-this-month counts for the stat cards. Restricted to ADMIN."
    )
    public ApiResponse<UserStatsResponse> getUserStats() {
        return userService.getUserStats();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Admin creates a user (FR-80)",
            description = "Creates a user with an admin-set password, role (default USER) and plan (default FREE). " +
                    "Rejects a duplicate email. Restricted to ADMIN."
    )
    public ApiResponse<UserResponse> createUser(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody AdminCreateUserRequest request) {
        return userService.createUser(principal.getUsername(), request);
    }

    @PatchMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Admin updates a user (FR-80)",
            description = "Partial update of fullName/email/phone/avatarUrl/role/plan/status. Guards: an admin cannot " +
                    "demote or lock/delete their own account; a Google user's email cannot be changed. Restricted to ADMIN."
    )
    public ApiResponse<UserResponse> updateUser(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID userId,
            @Valid @RequestBody AdminUpdateUserRequest request) {
        return userService.updateUser(principal.getUsername(), userId, request);
    }

    @PostMapping("/{userId}/reset-password")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Admin triggers a password-reset email for a user (FR-80)",
            description = "Generates a password-reset OTP and emails it to the user (same flow as forgot-password); " +
                    "the admin never sees the password. Rejected for Google accounts. Restricted to ADMIN."
    )
    public ApiResponse<String> resetUserPassword(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID userId) {
        return userService.resetUserPassword(principal.getUsername(), userId);
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Admin hard-deletes a user (FR-80)",
            description = "Permanently deletes the account and cascades all related data (brand profiles, content, " +
                    "schedules, posts, connections, notifications, async jobs). Works even for PENDING_DELETE accounts. " +
                    "ADMIN accounts are protected. Restricted to ADMIN."
    )
    public ApiResponse<String> deleteUser(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID userId) {
        return userService.deleteUser(principal.getUsername(), userId);
    }

    @PatchMapping("/{userId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Lock/unlock a user account (FR-80)",
            description = "Sets the account status to ACTIVE or LOCKED. ADMIN accounts are protected. Restricted to ADMIN."
    )
    public ApiResponse<UserResponse> updateUserStatus(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID userId,
            @Valid @RequestBody UserStatusUpdateRequest request) {
        return userService.updateUserStatus(principal.getUsername(), userId, request);
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Get a user by id",
            description = "Looks up a single user by UUID. Restricted to ADMIN."
    )
    public ApiResponse<UserResponse> getUserById(@PathVariable UUID userId) {
        return userService.getUserById(userId);
    }

    @GetMapping("/me")
    @Operation(
            summary = "Get the currently authenticated user",
            description = "Returns the identity (id, email, role) of the user resolved from the JWT in the " +
                    "Security Context. Requires a valid access token; the user is never passed as a parameter."
    )
    public ApiResponse<MeResponse> getCurrentUser(
            @AuthenticationPrincipal UserDetails userDetails) {
        return userService.getCurrentUser(userDetails.getUsername());
    }

    @GetMapping("/me/token-usage")
    @Operation(
            summary = "Get the current user's monthly LLM token usage",
            description = "Returns tokens used this month, the monthly limit of the user's plan " +
                    "(Plan.monthlyTokenLimit; null = unlimited) and the plan code. Usage resets at the " +
                    "start of each month (lazy reset). Drives the usage bar in the sidebar."
    )
    public ApiResponse<TokenUsageResponse> getTokenUsage(
            @AuthenticationPrincipal UserDetails userDetails) {
        return tokenUsageService.getMyUsage(userDetails.getUsername());
    }

    @GetMapping("/me/usage")
    @Operation(
            summary = "Get the current user's token usage page data",
            description = "Aggregated from the ai_usage event log for the current billing period: totals vs the " +
                    "plan limit, daily series, per-feature breakdown and the current plan (with reset date from " +
                    "the user's subscription). Drives the \"Tokens & usage\" page."
    )
    public ApiResponse<UserUsageResponse> getUsage(
            @AuthenticationPrincipal UserDetails userDetails) {
        return usageQueryService.getMyUsage(userDetails.getUsername());
    }

    @GetMapping("/me/stats")
    @Operation(
            summary = "Get the current user's lifetime stats",
            description = "Posts published (POSTED) and total reach for the authenticated user, cumulative over all "
                    + "time. Drives the two stat tiles on the profile card. Reach sums one snapshot per post (the "
                    + "latest milestone) — the /analytics/* endpoints cannot serve this because they are capped to a "
                    + "366-day range."
    )
    public ApiResponse<ProfileStatsResponse> getMyStats(
            @AuthenticationPrincipal UserDetails userDetails) {
        return userService.getMyStats(userDetails.getUsername());
    }

    @GetMapping("/me/activity")
    @Operation(
            summary = "Get the current user's recent activity (paginated)",
            description = "Returns rows of activity_logs whose actor is the authenticated user (sign-ins, "
                    + "profile/content/schedule changes, publish results…), newest first. Drives the "
                    + "\"Recent activity\" card on the profile page. size is clamped to 20; admin actions performed "
                    + "on this account by someone else are not included because their actor is that admin."
    )
    public ApiResponse<PageResponse<ActivityLogResponse>> getMyActivity(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size) {
        return activityLogService.listMine(userDetails.getUsername(), page, size);
    }

    @PutMapping("/me")
    @Operation(
            summary = "Update the current user's profile",
            description = "Saves fullName, phone and dateOfBirth for the authenticated user. Used both by the " +
                    "complete-profile screen after a first Google login and by the regular profile editor."
    )
    public ApiResponse<MeResponse> updateCurrentUser(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateCurrentUser(userDetails.getUsername(), request);
    }

    //reset password
    @PostMapping("/forgot-password")
    @SecurityRequirements({})
    @Operation(
            summary = "Request a password-reset OTP",
            description = "Validates the email exists, invalidates any previous reset tokens, generates a 6-digit OTP " +
                    "valid for 1 minute 30 seconds, and emails it to the user. Returns 404 if the email is not registered."
    )
    public ApiResponse<String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return userService.forgotPassword(request);
    }

    @PostMapping("/verify-otp")
    @SecurityRequirements({})
    @Operation(
            summary = "Verify a password-reset OTP",
            description = "Checks that the OTP matches the email, has not been used, and has not expired. " +
                    "Does not consume the OTP — it is consumed only on POST /users/reset-password."
    )
    public ApiResponse<String> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        return userService.verifyOtp(request);
    }

    @PostMapping("/reset-password")
    @SecurityRequirements({})
    @Operation(
            summary = "Reset password with a verified OTP",
            description = "Re-validates the OTP, ensures newPassword equals confirmPassword, updates the user's password " +
                    "(BCrypt), and marks the OTP as used so it cannot be reused."
    )
    public ApiResponse<String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return userService.resetPassword(request);
    }

    //change password
    @PostMapping("/me/change-password/init")
    @Operation(
            summary = "Start an in-app password change (step 1)",
            description = "For the authenticated user: verifies the current password and, if correct, emails a 6-digit OTP " +
                    "valid for 1 minute 30 seconds. Enforces a 7-day cool-down between password changes. " +
                    "Fails with PASSWORD_INCORRECT (1070) if the current password is wrong and PASSWORD_CHANGE_LIMIT (1071) " +
                    "if a change was already made within the last 7 days."
    )
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(schema = @Schema(implementation = ChangePasswordInitRequest.class),
                    examples = @ExampleObject(value = SwaggerExamples.CHANGE_PASSWORD_INIT_REQUEST)))
    public ApiResponse<String> initChangePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordInitRequest request) {
        return userService.initChangePassword(userDetails.getUsername(), request);
    }

    @PostMapping("/me/change-password/confirm")
    @Operation(
            summary = "Confirm an in-app password change (step 2)",
            description = "For the authenticated user: validates the OTP, ensures newPassword equals confirmPassword and meets " +
                    "the strength rule (≥ Medium, length ≥ 8), then updates the password (BCrypt) and consumes the OTP. " +
                    "The current session stays logged in. Fails with WEAK_PASSWORD (1074), PASSWORDS_NOT_MATCH (1065), " +
                    "or an OTP error if the code is invalid/expired."
    )
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(schema = @Schema(implementation = ChangePasswordConfirmRequest.class),
                    examples = @ExampleObject(value = SwaggerExamples.CHANGE_PASSWORD_CONFIRM_REQUEST)))
    public ApiResponse<String> confirmChangePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordConfirmRequest request) {
        return userService.confirmChangePassword(userDetails.getUsername(), request);
    }

    //profile
    @PatchMapping("/complete-profile")
    @Operation(
            summary = "Complete first-time onboarding (OAuth2 users)",
            description = "One-time onboarding for a Google user who has not finished their profile yet. " +
                    "Sets fullName, phone, dob and a self-chosen password (BCrypt-hashed), marks the profile as " +
                    "completed (password becomes non-null), and emails a setup-success confirmation (never the password). " +
                    "Requires a valid access token and fails with PROFILE_ALREADY_COMPLETED if the profile is already done."
    )
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(schema = @Schema(implementation = CompleteProfileRequest.class),
                    examples = @ExampleObject(value = SwaggerExamples.COMPLETE_PROFILE_REQUEST)))
    public ApiResponse<UserResponse> completeProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CompleteProfileRequest request) {
        return userService.completeProfile(userDetails.getUsername(), request);
    }

    @GetMapping("/me/profile")
    @Operation(
            summary = "Get the current user's full profile",
            description = "Returns the complete profile (fullName, phone, dob, avatarUrl, status, createdAt, role, ...) " +
                    "of the authenticated user resolved from the JWT. Unlike GET /users/me (lightweight identity), " +
                    "this is intended for the profile page."
    )
    public ApiResponse<UserResponse> getMyProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        return userService.getMyProfile(userDetails.getUsername());
    }

    //delete
    @PostMapping("/me/deactivate-request")
    @Operation(
            summary = "Request account deletion (30-day grace period)",
            description = "Marks the account as PENDING_DELETE and sets a deletion deadline 30 days from now. " +
                    "The account is NOT hard-deleted immediately — a scheduled job runs daily at midnight and " +
                    "permanently purges accounts whose deadline has passed. " +
                    "The user can cancel within the 30-day window by calling POST /users/me/restore."
    )
    public ApiResponse<DeleteAccountResponse> requestDeleteAccount(
            @AuthenticationPrincipal UserDetails userDetails) {
        return userService.requestDeleteAccount(userDetails.getUsername());
    }

    @PostMapping("/me/restore")
    @Operation(
            summary = "Cancel account deletion and restore to ACTIVE",
            description = "Cancels a pending deletion request within the 30-day grace period. " +
                    "Sets status back to ACTIVE and clears the deletion deadline. " +
                    "Returns 400 if the account is not currently in PENDING_DELETE state."
    )
    public ApiResponse<DeleteAccountResponse> restoreAccount(
            @AuthenticationPrincipal UserDetails userDetails) {
        return userService.restoreAccount(userDetails.getUsername());
    }
}
