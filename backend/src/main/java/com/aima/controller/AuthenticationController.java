package com.aima.controller;

import com.nimbusds.jose.JOSEException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.aima.config.swagger.SwaggerExamples;
import com.aima.dto.request.IntrospectRequest;
import com.aima.dto.request.LoginRequest;
import com.aima.dto.request.LogoutRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.AuthenticationResponse;
import com.aima.dto.response.IntrospectResponse;
import com.aima.service.AuthenticationService;

import java.text.ParseException;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Authentication", description = "Login, token introspection, logout and account status checks.")
public class AuthenticationController {
    AuthenticationService authenticationService;

    @PostMapping("/login")
    @Operation(
            summary = "Authenticate and obtain a JWT",
            description = "Validates email/password and returns a signed HS512 JWT (valid for 1 hour)."
    )
    @SecurityRequirements({})
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(schema = @Schema(implementation = LoginRequest.class),
                    examples = @ExampleObject(value = SwaggerExamples.LOGIN_REQUEST)))
    ApiResponse<AuthenticationResponse> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        return authenticationService.authenticate(request, response);
    }

    @PostMapping("/refresh")
    @Operation(
            summary = "Refresh access token",
            description = "Reads the REFRESH token from the HttpOnly cookie, rotates it (the old one is " +
                    "immediately blacklisted) and returns a new ACCESS token in the body plus a new REFRESH " +
                    "token in a fresh HttpOnly cookie. Missing/expired/already-used cookie returns 401."
    )
    @SecurityRequirements({})
    ApiResponse<AuthenticationResponse> refreshToken(HttpServletRequest httpRequest, HttpServletResponse response) {
        return authenticationService.refreshToken(httpRequest, response);
    }

    @PostMapping("/introspect")
    @Operation(
            summary = "Introspect (validate) a JWT",
            description = "Returns whether the supplied token is structurally valid, correctly signed, " +
                    "unexpired and not blacklisted."
    )
    @SecurityRequirements({})
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(schema = @Schema(implementation = IntrospectRequest.class),
                    examples = @ExampleObject(value = SwaggerExamples.INTROSPECT_REQUEST)))
    ApiResponse<IntrospectResponse> introspect(@RequestBody IntrospectRequest request)
            throws ParseException, JOSEException {
        return authenticationService.introspect(request);
    }

    @PostMapping("/logout")
    @Operation(
            summary = "Log out (invalidate a JWT)",
            description = "Blacklists the supplied token until its natural expiry so it can no longer be used."
    )
    @SecurityRequirements({})
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(schema = @Schema(implementation = LogoutRequest.class),
                    examples = @ExampleObject(value = SwaggerExamples.LOGOUT_REQUEST)))
    ApiResponse<Void> logout(
            @RequestBody(required = false) LogoutRequest request, HttpServletRequest httpRequest, HttpServletResponse response)
            throws ParseException, JOSEException {
        return authenticationService.logout(request, httpRequest, response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/account-status")
    @Operation(
            summary = "Check whether an account is locked",
            description = "Looks up a user by username or email and reports whether the account is in the LOCKED state. " +
                    "Always returns 200 — unknown identifiers are reported as locked: false to avoid user enumeration."
    )
    ApiResponse<Map<String, Object>> accountStatus(
            @Parameter(description = "Username or email address to look up.", required = true, example = "johndoe")
            @RequestParam("identifier") String identifier) {
        return authenticationService.accountStatus(identifier);
    }
}
