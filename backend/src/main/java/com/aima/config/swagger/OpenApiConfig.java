package com.aima.config.swagger;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    public static final String BEARER_SCHEME = "bearerAuth";
    public static final String COOKIE_SCHEME = "cookieAuth";

    @Value("${server.port:8082}")
    private String serverPort;

    @Value("${server.servlet.context-path:/api/aima}")
    private String contextPath;

//    @Value("${PRODUCTION_URL:...}")
//    private String productionUrl;

    @Bean
    public OpenAPI aimaOpenAPI() {
        final Server localServer = new Server()
                .url("http://localhost:" + serverPort + contextPath)
                .description("Local development server");

//        final Server productionServer = new Server()
//                .url(productionUrl)
//                .description("Production server");

        final SecurityScheme bearerScheme = new SecurityScheme()
                .name(BEARER_SCHEME)
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description("""
                        Paste the JWT returned by `POST /auth/login` (the `result.token` field).
                        Swagger sends it as the `Authorization: Bearer <token>` header on protected endpoints.""");

        final SecurityScheme cookieScheme = new SecurityScheme()
                .name(COOKIE_SCHEME)
                .type(SecurityScheme.Type.APIKEY)
                .in(SecurityScheme.In.COOKIE)
                .name("access_token")
                .description("JWT via access_token cookie");

        return new OpenAPI()
                .info(apiInfo())
                .servers(List.of(localServer))
                .components(new Components()
                        .addSecuritySchemes(BEARER_SCHEME, bearerScheme)
                        .addSecuritySchemes(COOKIE_SCHEME, cookieScheme))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME))
                .addSecurityItem(new SecurityRequirement().addList(COOKIE_SCHEME));
    }


    @Bean
    public OperationCustomizer globalErrorResponses() {
        Content errorContent = new Content().addMediaType(
                "application/json",
                new MediaType().schema(new Schema<>().$ref("#/components/schemas/ApiResponse")));

        ApiResponse r400 = new ApiResponse()
                .description("Validation failure or bad request — `MethodArgumentNotValidException` or `AppException` " +
                        "with a 4xx `ErrorCode` (e.g. `USER_EXISTED` 1002, `INVALID_PASSWORD` 1005).")
                .content(errorContent);
        ApiResponse r401 = new ApiResponse()
                .description("Not authenticated — missing, expired, or invalid JWT. " +
                        "Produced by `JwtAuthenticationEntryPoint` (code 401) or `AppException(UNAUTHENTICATED)`.")
                .content(errorContent);
        ApiResponse r403 = new ApiResponse()
                .description("Authenticated but not authorised — `AccessDeniedException` or " +
                        "`AppException(USER_INACTIVE)` (code 403).")
                .content(errorContent);
        ApiResponse r500 = new ApiResponse()
                .description("Unexpected server error — unhandled `Exception` fallback (code 9999).")
                .content(errorContent);

        return (operation, handlerMethod) -> {
            ApiResponses responses = operation.getResponses();
            responses.addApiResponse("400", r400);
            responses.addApiResponse("401", r401);
            responses.addApiResponse("403", r403);
            responses.addApiResponse("500", r500);
            return operation;
        };
    }

    private Info apiInfo() {
        return new Info()
                .title("AIMA API")
                .version("0.0.1-SNAPSHOT")
                .description("""
                        REST API for the AIMA platform: authentication (HS512 JWT),
                        user registration and account management.

                        **Authentication**

                        1. Call `POST /auth/login` with valid credentials to obtain a JWT.
                        2. Click **Authorize** and paste the token to call protected endpoints.

                        **Response envelope**

                        All responses use `ApiResponse`: `{ "code": int, "message": string, "result": T }`.
                        On errors `result` is absent (`@JsonInclude(NON_NULL)`). Error codes are defined
                        in the `ErrorCode` enum (e.g. `1006` = invalid credentials, `9999` = unexpected error).

                        **Error handling**

                        All errors are handled centrally by `GlobalExceptionHandler` (@ControllerAdvice):
                        - `AppException` → HTTP status from `ErrorCode.statusCode`
                        - `MethodArgumentNotValidException` → 400
                        - `AccessDeniedException` → 403
                        - Uncaught `Exception` → 500 (code 9999)""")
                .contact(new Contact()
                        .name("AIMA Project Team")
                        .email("aima-admin@educare.com"))
                .license(new License().name("Proprietary"));
    }
}
