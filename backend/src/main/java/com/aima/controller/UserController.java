package com.aima.controller;

import com.aima.dto.request.*;
import com.aima.dto.response.DeleteAccountResponse;
import com.aima.dto.response.MeResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import com.aima.config.swagger.SwaggerExamples;
import com.aima.dto.response.UserResponse;
import com.aima.service.UserService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Users", description = "User registration and account management.")
public class UserController {
    UserService userService;

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
    @ApiResponse(responseCode = "200", description = "User registered successfully.",
            content = @Content(schema = @Schema(implementation = com.aima.dto.response.ApiResponse.class),
                    examples = @ExampleObject(value = SwaggerExamples.REGISTER_RESPONSE)))
    public com.aima.dto.response.ApiResponse<UserResponse> register(@Valid @RequestBody UserRegisterRequest request) {
        return userService.registerUser(request);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "List all users",
            description = "Returns every user account. Restricted to ADMIN."
    )
    @ApiResponse(responseCode = "200", description = "User list returned.")
    public com.aima.dto.response.ApiResponse<List<UserResponse>> getAllUsers() {
        return userService.getAllUsers();
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Get a user by id",
            description = "Looks up a single user by UUID. Restricted to ADMIN."
    )
    @ApiResponse(responseCode = "200", description = "User returned.")
    public com.aima.dto.response.ApiResponse<UserResponse> getUserById(@PathVariable UUID userId) {
        return userService.getUserById(userId);
    }

    @GetMapping("/me")
    @Operation(
            summary = "Get the currently authenticated user",
            description = "Returns the identity (id, email, role) of the user resolved from the JWT in the " +
                    "Security Context. Requires a valid access token; the user is never passed as a parameter."
    )
    @ApiResponse(responseCode = "200", description = "Current user returned.")
    public com.aima.dto.response.ApiResponse<MeResponse> getCurrentUser(
            @AuthenticationPrincipal UserDetails userDetails) {
        return userService.getCurrentUser(userDetails.getUsername());
    }

    @PutMapping("/me")
    @Operation(
            summary = "Update the current user's profile",
            description = "Saves fullName, phone and dateOfBirth for the authenticated user. Used both by the " +
                    "complete-profile screen after a first Google login and by the regular profile editor."
    )
    @ApiResponse(responseCode = "200", description = "Profile updated; current user returned.")
    public com.aima.dto.response.ApiResponse<MeResponse> updateCurrentUser(
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
    @ApiResponse(responseCode = "200", description = "OTP sent to the user's email.")
    @ApiResponse(responseCode = "404", description = "Email not found.")
    public com.aima.dto.response.ApiResponse<String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return userService.forgotPassword(request);
    }

    @PostMapping("/verify-otp")
    @SecurityRequirements({})
    @Operation(
            summary = "Verify a password-reset OTP",
            description = "Checks that the OTP matches the email, has not been used, and has not expired. " +
                    "Does not consume the OTP — it is consumed only on POST /users/reset-password."
    )
    @ApiResponse(responseCode = "200", description = "OTP is valid.")
    @ApiResponse(responseCode = "400", description = "OTP is invalid, used, or expired.")
    public com.aima.dto.response.ApiResponse<String> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        return userService.verifyOtp(request);
    }

    @PostMapping("/reset-password")
    @SecurityRequirements({})
    @Operation(
            summary = "Reset password with a verified OTP",
            description = "Re-validates the OTP, ensures newPassword equals confirmPassword, updates the user's password " +
                    "(BCrypt), and marks the OTP as used so it cannot be reused."
    )
    @ApiResponse(responseCode = "200", description = "Password reset successfully.")
    @ApiResponse(responseCode = "400", description = "OTP invalid/expired/used or passwords do not match.")
    public com.aima.dto.response.ApiResponse<String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
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
    @ApiResponse(responseCode = "200", description = "OTP sent to the user's email.",
            content = @Content(schema = @Schema(implementation = com.aima.dto.response.ApiResponse.class),
                    examples = @ExampleObject(value = SwaggerExamples.CHANGE_PASSWORD_INIT_RESPONSE)))
    @ApiResponse(responseCode = "400", description = "Current password incorrect or 7-day change limit reached.")
    public com.aima.dto.response.ApiResponse<String> initChangePassword(
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
    @ApiResponse(responseCode = "200", description = "Password changed successfully.",
            content = @Content(schema = @Schema(implementation = com.aima.dto.response.ApiResponse.class),
                    examples = @ExampleObject(value = SwaggerExamples.CHANGE_PASSWORD_CONFIRM_RESPONSE)))
    @ApiResponse(responseCode = "400", description = "OTP invalid/expired, weak password, or passwords do not match.")
    public com.aima.dto.response.ApiResponse<String> confirmChangePassword(
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
    @ApiResponse(responseCode = "200", description = "Onboarding completed; confirmation email sent.",
            content = @Content(schema = @Schema(implementation = com.aima.dto.response.ApiResponse.class),
                    examples = @ExampleObject(value = SwaggerExamples.COMPLETE_PROFILE_RESPONSE)))
    @ApiResponse(responseCode = "400", description = "Profile already completed, weak password, or passwords do not match.")
    public com.aima.dto.response.ApiResponse<UserResponse> completeProfile(
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
    @ApiResponse(responseCode = "200", description = "Profile returned.")
    public com.aima.dto.response.ApiResponse<UserResponse> getMyProfile(
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
    @ApiResponse(responseCode = "200", description = "Deletion request accepted.",
            content = @Content(schema = @Schema(implementation = com.aima.dto.response.ApiResponse.class),
                    examples = @ExampleObject(value = SwaggerExamples.DEACTIVATE_ACCOUNT_RESPONSE)))
    @ApiResponse(responseCode = "400", description = "Account is already pending deletion or is locked.")
    public com.aima.dto.response.ApiResponse<DeleteAccountResponse> requestDeleteAccount(
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
    @ApiResponse(responseCode = "200", description = "Account restored successfully.",
            content = @Content(schema = @Schema(implementation = com.aima.dto.response.ApiResponse.class),
                    examples = @ExampleObject(value = SwaggerExamples.RESTORE_ACCOUNT_RESPONSE)))
    @ApiResponse(responseCode = "400", description = "Account is not in PENDING_DELETE state.")
    public com.aima.dto.response.ApiResponse<DeleteAccountResponse> restoreAccount(
            @AuthenticationPrincipal UserDetails userDetails) {
        return userService.restoreAccount(userDetails.getUsername());
    }
}
