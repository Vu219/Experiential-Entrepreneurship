package com.aima.controller;

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
import com.aima.dto.request.UserRegisterRequest;
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
}
