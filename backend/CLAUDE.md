# CLAUDE.md — AIMA Backend

> Backend module of the **AIMA – AI Marketing Assistant** project.
> This file documents the backend's structure, conventions and rules. It is referenced from the
> root [`../CLAUDE.md`](../CLAUDE.md); read the root file first for product scope, business rules
> (BR-xx), post-status state machine and retry policy.

## 1. Project Overview

| Field | Value |
|---|---|
| **Name** | AIMA Backend |
| **Artifact** | `com.aima:aima-backend:0.1.0` |
| **Base package** | `com.aima` |
| **Java** | 21 |
| **Spring Boot** | 4.0.6 |
| **Build tool** | Maven Wrapper (`mvnw` / `mvnw.cmd`) |

> ⚠️ Build/run with **JDK 21**. If `JAVA_HOME` points at an older JDK you will get
> `error: release version 21 not supported`. Set `JAVA_HOME` to a JDK 21 install for Maven.

**Runtime dependencies (from `pom.xml`):**

| Library | Version | Notes |
|---|---|---|
| Spring Boot Starter Web | (Boot-managed) | |
| Spring Boot Starter Data JPA | (Boot-managed) | |
| Spring Boot Starter Security | (Boot-managed) | |
| Spring Boot Starter Validation | (Boot-managed) | Bean Validation on request DTOs |
| Spring Boot Starter Actuator | (Boot-managed) | `/actuator/health` |
| Spring Boot Starter Mail | (Boot-managed) | OTP / password-reset emails |
| Spring Boot Starter Data Redis | (Boot-managed) | ACCESS token blacklist + REFRESH token tracking + OTP state |
| Spring Boot Starter OAuth2 Client | (Boot-managed) | Google OAuth2 login (brings in Nimbus JOSE used by `JwtServiceImpl`) |
| Spring Boot Starter WebFlux | (Boot-managed) | `WebClient` (reactive HTTP) |
| PostgreSQL JDBC | (Boot-managed, runtime) | |
| jjwt (api/impl/jackson) | 0.12.6 | Declared in pom; **token signing/verification is done with Nimbus JOSE** in `JwtServiceImpl` |
| Lombok | (Boot-managed, compile-only) | |
| MapStruct | 1.5.5.Final | |
| springdoc-openapi-starter-webmvc-ui | 3.0.3 | Swagger UI |
| H2 / spring-security-test | (test scope) | tests |

> **Not an OAuth2 Resource Server.** The pom has `oauth2-client` (for Google login) but **no**
> `oauth2-resource-server`. Access tokens are verified by a hand-written `JwtAuthenticationFilter`
> + `JwtService` (Nimbus JOSE), **not** by Spring's `JwtDecoder` pipeline.

---

## 2. Project Structure

```
backend/
├── pom.xml
├── docker-compose.yml                       — PostgreSQL + pgAdmin + Redis
├── .env / .env.example
└── src/main/java/com/aima/
    ├── AimaApplication.java                 — @SpringBootApplication
    ├── config/
    │   ├── RedisConfig.java                 — RedisTemplate / StringRedisTemplate bean(s)
    │   ├── TimezoneVerificationConfig.java   — Timezone setup on startup
    │   ├── DataInitializer.java             — Seed default roles / data on startup
    │   ├── AccountDeletionScheduler.java     — @Scheduled daily 00:00: hard-purge PENDING_DELETE users past their deletionDate
    │   ├── swagger/
    │   │   ├── OpenApiConfig.java           — OpenAPI bean, global error responses, bearer scheme
    │   │   └── SwaggerExamples.java         — All Swagger @ExampleObject strings (constants only)
    │   └── storage/
    │       ├── SupabaseConfig.java          — supabaseWebClient bean (base URL + service-key headers)
    │       ├── SupabaseProperties.java      — @ConfigurationProperties(supabase.*): url, anonKey, serviceKey
    │       └── StorageBuckets.java          — Single source of truth for bucket names (AVATARS/DOCUMENTS) + AVATAR_PUBLIC_PREFIX
    ├── security/                            — Auth CONFIG / filter / handlers only. Token & user-detail
    │   │                                       logic lives in service/ (interface) + service/Impl/.
    │   ├── SecurityConfig.java              — SecurityFilterChain, CORS, oauth2Login, PUBLIC_ENDPOINTS, jwtAuthenticationFilter
    │   ├── EncoderConfig.java               — BCryptPasswordEncoder bean
    │   ├── JwtProperties.java               — @ConfigurationProperties(jwt.*): signerKey, accessTokenExpiration, refreshTokenExpiration
    │   ├── JwtAuthenticationFilter.java     — OncePerRequestFilter: verify token per request → set SecurityContext (THE active auth mechanism)
    │   ├── CookieUtils.java                 — HttpOnly access + refresh cookie: set / clear / extract
    │   ├── CustomOAuth2User.java            — OAuth2User wrapper carrying the persisted User entity
    │   ├── OAuth2AuthenticationFailureHandler.java — redirect FE with ?error=...
    │   └── OAuth2AuthenticationSuccessHandler.java — issue JWT, set cookies, redirect FE with ?login=success
    ├── controller/
    │   ├── AuthenticationController.java    — POST /auth/{login,refresh,introspect,logout}, GET /auth/account-status
    │   ├── UserController.java              — POST /users/register, GET /users, GET /users/{id}, GET /users/me, PUT /users/me, GET /users/me/profile,
    │   │                                       POST /users/{forgot-password,verify-otp,reset-password}, POST /users/me/change-password/{init,confirm},
    │   │                                       POST /users/me/deactivate-request (request delete), POST /users/me/restore (cancel delete)
    │   ├── BrandProfileController.java      — Brand profile CRUD (BR-01..BR-04)
    │   └── FileController.java              — POST /files/avatar, POST /files/documents, GET /files/documents/signed-url (thin: delegates to FileService)
    ├── dto/
    │   ├── request/
    │   │   ├── LoginRequest.java
    │   │   ├── IntrospectRequest.java
    │   │   ├── LogoutRequest.java           — body optional (access token blacklist only)
    │   │   ├── UserRegisterRequest.java
    │   │   ├── UserRequest.java
    │   │   ├── UpdateProfileRequest.java    — fullName + phone + dateOfBirth + optional avatarUrl (complete-profile / edit; avatarUrl IGNOREd when null)
    │   │   ├── ForgotPasswordRequest.java / VerifyOtpRequest.java / ResetPasswordRequest.java
    │   │   ├── ChangePasswordInitRequest.java   — currentPassword (in-app change-password step 1)
    │   │   ├── ChangePasswordConfirmRequest.java — otpCode + newPassword + confirmPassword (step 2)
    │   │   ├── OAuth2UserInfo.java          — intermediate DTO for Google → User mapping
    │   │   └── BrandProfileRequest.java
    │   └── response/
    │       ├── ApiResponse.java             — Universal response envelope {code, message, result}
    │       ├── AuthenticationResponse.java  — {token, authenticated}; refreshToken omitted from body
    │       ├── IntrospectResponse.java      — {valid}
    │       ├── MeResponse.java              — current user identity + profileCompleted + status + deletionDate (for the FE pending-delete banner)
    │       ├── DeleteAccountResponse.java   — status + deletionDate + daysRemaining + message (delete/restore result)
    │       ├── UserResponse.java            — User details + nested RoleResponse
    │       ├── BrandProfileResponse.java
    │       ├── FileUploadResponse.java      — bucket + path + url (avatar/document upload result)
    │       └── SignedUrlResponse.java       — signedUrl + expiresInSeconds (private document access)
    ├── entity/
    │   ├── BaseEntity.java                  — @MappedSuperclass: UUID id (@UuidGenerator), createdAt, updatedAt, deletedAt (soft delete)
    │   ├── User.java                        — @Table("users"); password + phone nullable (Google users); fields: provider, googleId, dateOfBirth,
    │   │                                       status (UserStatus enum), deletionDate; @OneToMany brandProfiles (cascade ALL + orphanRemoval, for purge)
    │   ├── Role.java                        — @Table("roles"), 1:N to User
    │   └── BrandProfile.java                — @Table; belongs to a User
    ├── enums/
    │   ├── Platform.java                    — FACEBOOK / INSTAGRAM / THREADS (scope order)
    │   ├── PostingFrequency.java
    │   └── UserStatus.java                  — ACTIVE / LOCKED / PENDING_DELETE (User.status, @Enumerated STRING)
    ├── exception/
    │   ├── AppException.java                — Runtime exception carrying an ErrorCode
    │   ├── ErrorCode.java                   — Enum: code (int) + message (String) + HttpStatus
    │   └── GlobalExceptionHandler.java      — @ControllerAdvice: AppException, validation, AuthenticationException→401, AccessDeniedException→403, catch-all→500
    ├── mapper/                              — MapStruct (componentModel = "spring")
    │   ├── UserMapper.java                  — UserRegisterRequest→User, User→UserResponse/MeResponse, UpdateProfileRequest→User (@MappingTarget)
    │   ├── AuthenticationMapper.java        — String token(+refresh)→AuthenticationResponse
    │   ├── OAuth2UserMapper.java            — OAuth2UserInfo→User + updateGoogleFields(@MappingTarget)
    │   └── BrandProfileMapper.java
    ├── repository/
    │   ├── UserRepository.java              — findByEmail/findByUsername, existsByEmail/existsByUsername
    │   ├── RoleRepository.java              — + findByRoleName(String)
    │   └── BrandProfileRepository.java
    └── service/
        ├── AuthenticationService.java       — Interface
        ├── TokenBlacklistService.java       — Interface: Redis-backed ACCESS token blacklist
        ├── JwtService.java                  — Interface: generate (HS512) + parseClaims (verify signature + expiry)
        ├── RefreshTokenService.java         — Interface: REFRESH token JTI tracking in Redis (rt:{jti}, user_rt:{userId}, logout_time:{email})
        ├── UserService.java                 — Interface
        ├── CustomOAuth2UserService.java     — Interface: Google profile → find/create User
        ├── OtpService.java                  — Interface: OTP store/verify/markVerified/invalidate (Redis)
        ├── EmailService.java                — Interface: send OTP / password-reset emails
        ├── BrandProfileService.java         — Interface
        ├── SupabaseStorageService.java      — Interface: low-level Storage I/O (returns raw String url/path); used by FileService, OAuth2 handler, UserService
        ├── FileService.java                 — Interface: returns ApiResponse<FileUploadResponse>/<SignedUrlResponse> for FileController (thin-controller layer)
        └── Impl/
            ├── AuthenticationServiceImpl.java
            ├── TokenBlacklistServiceImpl.java
            ├── JwtServiceImpl.java          — Nimbus JOSE implementation (MACSigner/MACVerifier, HS512)
            ├── RefreshTokenServiceImpl.java — StringRedisTemplate implementation
            ├── UserDetailsServiceImpl.java  — Spring UserDetailsService: load user by email
            ├── CustomOAuth2UserServiceImpl.java — THE Google find/create path (uses OAuth2UserMapper)
            ├── OtpServiceImpl.java          — Redis-backed OTP
            ├── EmailServiceImpl.java
            ├── BrandProfileServiceImpl.java
            ├── SupabaseStorageServiceImpl.java — WebClient upload/delete/sign against Supabase Storage REST API
            ├── FileServiceImpl.java         — Wraps SupabaseStorageService + UserRepository; builds the ApiResponse envelope + result DTOs
            └── UserServiceImpl.java         — updateCurrentUser persists avatarUrl + deletes the old avatar AFTER commit (TransactionSynchronization)
```

> There are **no legacy/disabled token files** in this codebase (no `CustomJwtDecoder`,
> `JwtAuthenticationEntryPoint`, `TokenCleanupTask`, `RefreshToken`/`InvalidatedToken` entities or
> their repositories). Access-token blacklist, refresh-token tracking and OTP state all live in
> **Redis** — there are no DB token tables.

---

## 3. Code Conventions

### Lombok pattern on service / controller classes
```java
@Service                                        // or @RestController
@RequiredArgsConstructor                        // constructor injection — no @Autowired
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)  // all injected fields final+private
public class FooServiceImpl implements FooService {
    SomeRepository someRepository;              // injected dep — no visibility modifier needed

    @NonFinal
    @Value("${some.property:default}")          // non-injected, configurable field
    String someProperty;
}
```

### Config classes
`@Configuration` classes use **constructor injection** (`@RequiredArgsConstructor` with `private final`
fields, e.g. `SecurityConfig`) or **`@Bean` method-parameter injection** (e.g. `RedisConfig`). Do not
use field-level `@Autowired`.

### DTO pattern
All DTOs use `@Data @Builder @AllArgsConstructor @NoArgsConstructor @FieldDefaults(level = AccessLevel.PRIVATE)`.
Request DTOs carry Bean Validation annotations whose `message` is an `ErrorCode` enum key:
```java
@NotBlank(message = "EMAIL_REQUIRED")  // resolves to ErrorCode.EMAIL_REQUIRED
String email;
```

### Error handling
**Every service/`*Impl` method must guard its inputs and failure paths with explicit exception handling — never let an invalid value, missing entity, or duplicate flow through silently.**
1. **Validate request DTOs at the boundary.** Request DTOs carry Bean Validation whose `message` is an `ErrorCode` enum key, and the controller param is annotated `@Valid`. Add a matching `ErrorCode` for every new validation message.
2. **Guard inside the service before acting:**
   - Lookups that can miss → `.orElseThrow(() -> new AppException(ErrorCode.X_NOT_EXISTED))` (e.g. `findByEmail`, `findById`).
   - Uniqueness / pre-conditions → check then `throw new AppException(ErrorCode.X_EXISTED)` (e.g. `existsByEmail`).
   - Business-state checks (locked account, OTP expired, password mismatch, etc.) → dedicated `ErrorCode`.
3. Service throws `new AppException(ErrorCode.SOME_CODE)`; if a new condition has no code yet, **add one to `ErrorCode`** (code + message + `HttpStatus`) first.
4. `GlobalExceptionHandler.handlingAppException()` catches it and returns `ApiResponse` with `code`/`message` from `ErrorCode`.
5. **Never throw raw exceptions to the controller** and never return an error by hand-building `ApiResponse` — always go through `AppException` + `ErrorCode` so the envelope and HTTP status stay consistent.
6. When wrapping risky calls in `try/catch`, log with `@Slf4j` and either rethrow as an `AppException` or fall back deliberately — do not swallow the exception silently.

### Response envelope
Every endpoint returns `ApiResponse<T>`:
```java
return ApiResponse.success("message", result);   // success with payload
return ApiResponse.success("message");           // success, no payload
return ApiResponse.<T>builder().result(result).build();
```
`@JsonInclude(NON_NULL)` on `ApiResponse` — absent fields are omitted from JSON.
This matches the product-wide API-01 format `{ "code", "message", "result" }`.

### Swagger
- All `@ExampleObject` strings live as `public static final String` constants in `SwaggerExamples`.
- Public endpoints carry `@SecurityRequirements({})` to remove the lock icon in Swagger UI.
- `@Operation` and `@ApiResponse` are on every endpoint; `OpenApiConfig` injects global 400/401/403/500 responses.

### MapStruct
```java
@Mapper(componentModel = "spring")  // always spring component model
public interface UserMapper { ... }
```
**Always map entity → DTO (and DTO → entity) through a MapStruct mapper method — never hand-build a DTO/entity with its Lombok `.builder()` / setters inside a service.** Applies to **every CRUD operation**:
- **Create:** map request DTO → entity via the mapper (e.g. `userMapper.toUser(request)`), then set only the fields the mapper can't (password hash, role lookup, status).
- **Read:** map entity → response DTO via the mapper (e.g. `toUserResponse`, `toMeResponse`).
- **Update:** use a MapStruct `void update(SourceDto dto, @MappingTarget Entity entity)` method (with `@BeanMapping(nullValuePropertyMappingStrategy = IGNORE)` for partial updates) instead of manually calling setters.
- **Delete:** map the affected entity → response DTO via the mapper when returning the deleted record.

If a target DTO has no mapper method yet, add one and call it from the service. Use `@Mapping(target = ..., source = ...)` for renamed/nested fields (e.g. `@Mapping(target = "role", source = "role.roleName")`).

---

## 4. Authentication Flow

> **Architecture:** Tokens are verified by a hand-written `JwtAuthenticationFilter` + `JwtService`
> (Nimbus JOSE), **NOT** by Spring's OAuth2 Resource Server. Auth **config/filter/handlers** live in
> `com.aima.security`; **token & user-detail logic** follows the interface+Impl convention in
> `service/` (`JwtService`, `RefreshTokenService`, `TokenBlacklistService`) + `service/Impl/`
> (`JwtServiceImpl`, `RefreshTokenServiceImpl`, `UserDetailsServiceImpl`). All token state lives in
> **Redis**, not the DB. Both access and refresh tokens are delivered as **HttpOnly cookies** — the
> frontend never reads or stores tokens; it calls `GET /users/me` to learn who it is.

### ACCESS token (HS512, signed with `jwt.signerKey`)
```
sub (= email), iss="AIMA", iat, exp, jti,
uid (= userId), email, typ="access",
scope="ROLE_<roleName>", role="ROLE_<roleName>"
```
- TTL: `jwt.accessTokenExpiration` seconds (default 3600 = 1 hour).
- Delivered as an **HttpOnly cookie** (`access_token`) AND accepted from the `Authorization: Bearer <token>` header (Swagger support).
- Blacklist: Redis key `blacklist:{jti}` with TTL = remaining lifetime.

### REFRESH token (also a JWT, `typ="refresh"`)
A signed HS512 JWT sent via **HttpOnly cookie** (`refresh_token`). Its `jti` is tracked in Redis
(`rt:{jti}` → userId, plus a `user_rt:{userId}` set index). No DB row, no SHA-256 hash, no token
family — rotation works purely via the Redis `rt:{jti}` entry; reuse of a rotated/revoked token fails
because its `jti` is gone → 401.

### Login — `POST /auth/login`
1. Find user **by email** → `USER_NOT_FOUND` if missing.
2. BCrypt password check → `INVALID_CREDENTIALS` if wrong.
3. Status check: `"LOCKED"` → `USER_INACTIVE`.
4. Update `user.lastActiveAt`, save.
5. Generate ACCESS + REFRESH tokens (new `jti`); store `jti` in Redis.
6. Set both tokens as HttpOnly cookies via `CookieUtils`.
7. Return `{token, authenticated: true}` — no `refreshToken` in body.

### Google OAuth2 Login — `GET /oauth2/authorization/google`
1. Spring redirects to the Google consent screen.
2. Google redirects to `/login/oauth2/code/google`.
3. `CustomOAuth2UserServiceImpl.loadUser` loads the Google profile and **finds or creates** the local
   `User` (links by email if existing; default role `"USER"`; password set to a random BCrypt hash;
   `provider="GOOGLE"`). This is the single source of truth for Google user provisioning.
4. `OAuth2AuthenticationSuccessHandler` takes the persisted `User` from `CustomOAuth2User`, issues
   ACCESS + REFRESH tokens, sets cookies, and redirects to `FRONTEND_CALLBACK_URL?login=success`.
5. `OAuth2AuthenticationFailureHandler` redirects to `FRONTEND_CALLBACK_URL?error=<message>`.
6. After redirect the FE just calls `GET /users/me` (cookies are already set). A first-time Google user
   has `profileCompleted=false` (no phone/dateOfBirth) and is sent to the complete-profile screen.

### Refresh — `POST /auth/refresh` (public)
1. Read refresh JWT from the HttpOnly cookie → `UNAUTHENTICATED` if missing.
2. `parseClaims` (verify signature + expiry) and check `typ == "refresh"`.
3. Look up `jti` in Redis → `UNAUTHENTICATED` if absent (already rotated/revoked).
4. Load user, reject if `"LOCKED"`.
5. **Rotate:** revoke old `jti`, generate new ACCESS + REFRESH (new `jti`), store new `jti`.
6. Set new cookies, return `{token, authenticated: true}`.

### Introspect — `POST /auth/introspect` (public)
- Calls `parseClaims` only — verifies **signature + expiry**.
- ⚠️ Does **NOT** check the Redis blacklist or logout-time → a logged-out/blacklisted token can still return `{valid: true}`. (Known inconsistency vs. the request filter.)

### Logout — `POST /auth/logout` (public)
1. Read refresh JWT from cookie → `parseClaims` → `RefreshTokenService.revoke(jti)` + `setLogoutTime(email)`.
2. Clear both cookies via `CookieUtils`.
3. If an access token is provided in the body: blacklist its `jti` in Redis.

### Password reset (OTP via email)
`POST /users/forgot-password` → generate 6-digit OTP, store hashed in Redis with TTL, email it.
`POST /users/verify-otp` → validate OTP, mark verified (short-lived flag in Redis).
`POST /users/reset-password` → re-check verified flag, update BCrypt password, invalidate OTP,
revoke all refresh tokens + set logout-time (kills old sessions).

### Protected request flow (`JwtAuthenticationFilter`)
```
Request → JwtAuthenticationFilter (addFilterBefore UsernamePasswordAuthenticationFilter)
       → skip if path is /auth/login, /auth/refresh, /users/register
       → extract token from access_token cookie, else Authorization: Bearer header
       → JwtService.parseClaims()            ← verify signature + expiry
       → require claim typ == "access"
       → TokenBlacklistService.isBlacklisted(jti)        ← Redis (clears cookies if hit)
       → RefreshTokenService.getLogoutTime(email) vs iat ← revoked-by-logout check
       → UserDetailsServiceImpl.loadUserByUsername(email) → set SecurityContext (if enabled)
       → @EnableMethodSecurity enforces @PreAuthorize at method level
   On parse error: clear cookies + handlerExceptionResolver.resolveException(...)
```
Auth/authorization failures return clean JSON envelopes: `GlobalExceptionHandler` handles
`AuthenticationException` → `UNAUTHENTICATED` (401) and `AccessDeniedException` → `UNAUTHORIZED` (403).
A raw `JwtException` not wrapped in an `AuthenticationException` still falls through to the catch-all
500 — keep token-parse failures wrapped.

### Scheduled cleanup
- **Token/OTP state:** none needed — Redis TTL expires `blacklist:{jti}`, `rt:{jti}` and OTP keys automatically.
- **Account deletion:** `AccountDeletionScheduler` (`@EnableScheduling` on `AimaApplication`) runs daily at `00:00`
  (`@Scheduled(cron = "0 0 0 * * *")`) and **hard-deletes** users whose `status == PENDING_DELETE` and `deletionDate <= now`
  (GDPR account deletion is the documented exception to soft-delete). Cascade on `User.brandProfiles` purges dependent rows.

### In-app change password (authenticated, 2 endpoints)
`POST /users/me/change-password/init` — verify current password + 7-day cool-down → email a 6-digit OTP (reuses `OtpService`).
`POST /users/me/change-password/confirm` — re-validate OTP + password match + strength (≥ 8 chars, score ≥ 3) → update BCrypt password, consume OTP.
The session is **not** revoked (unlike forgot-password reset). The FE verifies the OTP at an intermediate step by reusing public `POST /users/verify-otp` before submitting the new password.

### Account deletion (30-day grace)
`POST /users/me/deactivate-request` — set `status = PENDING_DELETE`, `deletionDate = now + 30 days`; rejects if already pending or LOCKED.
`POST /users/me/restore` — within the window, set `status = ACTIVE`, clear `deletionDate`; rejects if not pending.
A `PENDING_DELETE` user can still log in (only `LOCKED` is blocked) so they can restore.

### File / avatar storage (Supabase Storage)
- **Layering:** `FileController` (thin) → `FileService`/`FileServiceImpl` (builds `ApiResponse<T>`) → `SupabaseStorageService`/`Impl` (low-level WebClient I/O, returns raw `String`). Bucket names come from `StorageBuckets`.
- **Upload avatar:** `POST /files/avatar` (multipart, jpg/png/webp ≤ 2 MB) → stores at `{userId}/{uuid}_{filename}` in the public `avatars` bucket → returns the public URL. Multipart limits in `application.yml` are 11 MB/12 MB.
- **Persist avatar:** the FE then calls `PUT /users/me` with `avatarUrl`. `UpdateProfileRequest.avatarUrl` is optional and the MapStruct update IGNOREs `null`, so a profile edit that omits it keeps the current avatar.
- **Old-avatar cleanup:** `UserServiceImpl.updateCurrentUser` captures the previous `avatarUrl`; when it changes to a different Supabase-hosted image, it deletes the old object — **after commit** (rule #24) and only for our `/object/public/avatars/` URLs (external images like Google are skipped). Failures are logged, never fatal.
- **Documents:** `POST /files/documents` (PDF ≤ 10 MB) → private `documents` bucket, returns a storage path; `GET /files/documents/signed-url` issues a time-limited signed URL. All `/files/**` endpoints require authentication (not in `PUBLIC_ENDPOINTS`).

---

## 5. Database & Cache

### PostgreSQL (`application.yml` + `.env`)
```
URL:      jdbc:postgresql://DB_HOST:DB_PORT/DB_NAME
Username: DB_USERNAME / Password: DB_PASSWORD
DDL:      hibernate.ddl-auto=update
Dialect:  PostgreSQLDialect
Timezone: APP_TIMEZONE (e.g. Asia/Ho_Chi_Minh)
```

### Redis
```
Host:    REDIS_HOST (default localhost) / Port: REDIS_PORT (default 6379) / Timeout: REDIS_TIMEOUT (default 2000ms)
```
Used for: ACCESS token blacklist (`blacklist:{jti}`), REFRESH token tracking (`rt:{jti}`,
`user_rt:{userId}`, `logout_time:{email}`), and OTP state for password reset. Run via `docker compose up -d`.

### `users` table — `User.java` (extends `BaseEntity`)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | `@UuidGenerator`, not updatable (from `BaseEntity`) |
| `user_name` | VARCHAR | unique, not null |
| `password` | VARCHAR | BCrypt hash; **nullable** (Google users get a random hash, never log in by password) |
| `full_name` | VARCHAR(100) | not null |
| `email` | VARCHAR | unique, not null |
| `phone` | VARCHAR | **nullable** (Google users may not provide one) |
| `date_of_birth` | DATE | nullable; collected on the complete-profile screen |
| `provider` | VARCHAR(20) | nullable; `"GOOGLE"` for OAuth2 users |
| `google_id` | VARCHAR | unique, nullable |
| `role_id` | UUID (FK→roles) | not null |
| `status` | VARCHAR | `UserStatus` enum (`@Enumerated(STRING)`): `ACTIVE`, `LOCKED`, `PENDING_DELETE` |
| `deletion_date` | TIMESTAMP | nullable; set when status becomes `PENDING_DELETE`; the purge deadline (now + 30 days) |
| `avatar_url` | VARCHAR(500) | nullable |
| `last_active_at` / `last_password_change_at` | TIMESTAMP | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMP | from `BaseEntity` (soft delete via `deleted_at`) |

### `roles` table — `Role.java`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | `@UuidGenerator` |
| `role_name` | VARCHAR | unique, not null |
| `description` | VARCHAR | nullable |

---

## 6. Commands

```bash
docker compose up -d                 # Start PostgreSQL + pgAdmin + Redis
./mvnw.cmd spring-boot:run           # Run (Windows)   |  ./mvnw spring-boot:run (macOS/Linux)
./mvnw.cmd package -DskipTests       # Build JAR
./mvnw.cmd test                      # Run tests
```

**Runtime URLs** (port/context-path are env-driven — dev defaults `SERVER_PORT=8082`, `CONTEXT_PATH=/api/aima`):
```
API base:     http://localhost:8082/api/aima        (= http://localhost:{SERVER_PORT}{CONTEXT_PATH})
Swagger UI:   {CONTEXT_PATH}/swagger-ui.html
OpenAPI JSON: {CONTEXT_PATH}/v3/api-docs
Health:       {CONTEXT_PATH}/actuator/health
```

**Frontend integration.** The frontend has **no dev proxy** — it calls this backend **directly** using
the absolute base URL from its own `VITE_API_BASE_URL` env var (e.g. `http://localhost:8082/api/aima`;
see `frontend/.env`). Cross-origin requests work because `SecurityConfig.corsConfigurationSource()`
allows `http://localhost:*` (+ `*.vercel.app` etc.) **with credentials**, so the HttpOnly auth cookies
flow in dev. When the API host/port/context-path changes, update the frontend's `VITE_API_BASE_URL`
(and add the deployed FE origin to the CORS allow-list if it isn't already matched).

**Required `.env` variables** (see `.env.example`):
```
APP_NAME, SERVER_PORT (dev 8082), CONTEXT_PATH (dev /api/aima)
DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD
PGADMIN_EMAIL, PGADMIN_PASSWORD, PGADMIN_PORT
APP_TIMEZONE, JWT_SIGNER_KEY
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
FRONTEND_CALLBACK_URL                 # OAuth2 success/failure redirect, e.g. http://localhost:3000/auth/google/callback
FRONTEND_BASE_URL                     # FE origin, e.g. http://localhost:3000 (default in application.yml)
MAIL_USERNAME, MAIL_PASSWORD          # SMTP (Gmail) for OTP emails
SUPABASE_URL, SUPABASE_SERVICE_KEY    # Supabase Storage — service_role key is BACKEND ONLY, never expose to FE
# Optional overrides (have defaults in application.yml):
SUPABASE_ANON_KEY                     # kept for reference; not used by the backend
JWT_ACCESS_TOKEN_EXPIRATION (3600s), JWT_REFRESH_TOKEN_EXPIRATION (604800s)
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TIMEOUT, REDIS_SSL_ENABLED
OTP_TTL_SECONDS (90), OTP_MAX_ATTEMPTS (5), OTP_VERIFIED_TTL_SECONDS (300)
AUTH_COOKIE_NAME (refresh_token), AUTH_COOKIE_SECURE (false), AUTH_COOKIE_SAME_SITE (Lax), AUTH_COOKIE_PATH (/)
```

**Google Cloud Console — redirect URI to register:** `{CONTEXT_PATH}/login/oauth2/code/google`

---

## 7. Rules

> ⚠️ **MANDATORY — these rules are binding, not advisory.** Every change to the backend MUST follow the
> package layout in §2 and every rule below. Before finishing any backend task, Claude Code MUST
> self-check the diff against this section and fix any deviation. If a requirement genuinely cannot be
> met, STOP and call it out explicitly with the reason — never silently break the structure. New files
> go in the package their role dictates (`controller/`, `service/` + `service/Impl/`, `dto/request|response/`,
> `mapper/`, `config/...`); a controller is never the place for business logic or DTO assembly.

1. **Never rename** existing packages, classes, or public interfaces — `AuthenticationService`, `UserService`, `ErrorCode` enum keys, etc. are referenced in many places.

2. **ErrorCode enum keys are validation message keys.** Every `@NotBlank(message="KEY")` maps directly to `ErrorCode.KEY`. Adding a new validation requires a matching `ErrorCode` entry.

3. **Always use `ApiResponse<T>` as the return type** for every controller method. Never return raw types or `ResponseEntity` directly.

4. **`@JsonInclude(NON_NULL)` on `ApiResponse` is intentional.** Do not remove it; absent fields must be omitted from JSON output.

5. **JWT signing algorithm is HS512** with `jwt.signerKey`. Do not change the algorithm or the `JWSAlgorithm.HS512` constant.

6. **Token verification is hand-written** via `JwtAuthenticationFilter` + `JwtService.parseClaims` — the app is **not** an OAuth2 Resource Server. The access-token type claim is `typ` (value `"access"`), and login/identity is keyed on **email** (`sub` = email). Do not assume Spring's `JwtDecoder`/`JwtAuthenticationConverter` pipeline is active.

7. **Swagger example strings belong in `SwaggerExamples`** as public static final constants. Do not inline raw JSON strings in annotation attributes on controllers.

8. **`@SecurityRequirements({})` is required on every public endpoint** in the controller to remove the Swagger bearer lock icon. Missing it will make Swagger UI require a token on that operation.

9. **Soft delete by default.** Entities extend `BaseEntity` (`deleted_at`); mark `deleted_at` instead of hard-deleting, except GDPR account deletion (per the root `DATA_MODEL.md`). Do not physically `delete` rows for normal flows.

10. **`ddl-auto: update` is active.** Adding new entity fields auto-creates columns on startup. Do not use `create` or `create-drop` in any environment that has existing data.

11. **Service implementations live in `service/Impl/`**, not in `service/`. The pattern `FooService` (interface) + `FooServiceImpl` (class in `Impl/`) must be maintained.

12. **Constructor injection via `@RequiredArgsConstructor`** is the convention for service and controller classes. Do not add field-level `@Autowired`.

13. **Refresh token is a signed JWT (`typ="refresh"`), tracked by `jti` in Redis** (`RefreshTokenService` / `RefreshTokenServiceImpl`, key `rt:{jti}`). There is no DB row, SHA-256 hash, or token family. Never log or return the raw refresh token except as the HttpOnly cookie value.

14. **`password` and `phone` are nullable on `User`.** Always null-check before using them. Google OAuth2 users get a random BCrypt password (never used to log in) and may have no phone until they complete their profile.

15. **ACCESS token blacklist lives in Redis, not the DB.** Use `TokenBlacklistService` — never create a DB table for token invalidation.

16. **Use constructor injection everywhere — no field-level `@Autowired`.** Service/controller classes use `@RequiredArgsConstructor` (+ `@FieldDefaults(makeFinal = true)`); `@Configuration` classes use `@RequiredArgsConstructor` with `private final` fields or `@Bean` method-parameter injection.

17. **`authenticate()`, `refreshToken()`, `generateTokenForOAuth2User()` in `AuthenticationServiceImpl` are `@Transactional`** — they update `user.lastActiveAt` and write refresh-token state to Redis. Do not call them from another `@Transactional` context you want to keep separate.

18. **Use MapStruct for all entity↔DTO conversion across the full CRUD surface — never hand-build DTOs/entities in services.** Applies to Create, Read, Update, and Delete on every entity. Do not construct a response/entity with Lombok `.builder()` or setters inside a service method when a mapper can do it: requests → entity on create, entity → response on read/delete, and a `@MappingTarget` update method on update. Add (or reuse) a method on the relevant `@Mapper(componentModel = "spring")` mapper and call it. Use `@Mapping` for renamed/nested fields (e.g. `source = "role.roleName"`).

19. **Always handle errors via `AppException` + `ErrorCode` — guard inputs and failure paths in every service method.** Validate request DTOs at the boundary (`@Valid` + `message = "ERROR_CODE_KEY"`); inside the `*Impl`, guard every lookup (`.orElseThrow(...)`), uniqueness/pre-condition, and business-state check by throwing `AppException(ErrorCode.X)`. Add a new `ErrorCode` (code + message + `HttpStatus`) for any new condition. Never throw raw exceptions to the controller, never hand-build an error `ApiResponse`, and never swallow a caught exception silently.

20. **Auth-failure responses return a clean 401/403.** `GlobalExceptionHandler` has `@ExceptionHandler(AuthenticationException.class)` → `UNAUTHENTICATED` and `@ExceptionHandler(AccessDeniedException.class)` → `UNAUTHORIZED`. A raw `JwtException` thrown outside an `AuthenticationException` still falls through to the catch-all 500, so wrap token-parse failures in an `AuthenticationException` (or `AppException`) where possible.

21. **Time-consuming AI / posting tasks must run async (background jobs)** and never block the request thread (root `CLAUDE.md` NFR-04). Return a job/handle immediately and process in the background.

22. **Thin controllers — the service layer returns the `ApiResponse<T>`; controllers only delegate.** Every controller method body is a single `return xService.method(...)`; it MUST NOT contain business logic, URL/string parsing, entity lookups, or DTO assembly (`.builder()`/setters). Each `*Service` (interface in `service/`, impl in `service/Impl/`) is what builds the `ApiResponse<T>` envelope and result DTOs. If an endpoint needs a service that currently exposes lower-level primitives (e.g. `SupabaseStorageService` returns raw `String`), add a dedicated `*Service`/`*ServiceImpl` that wraps it and returns `ApiResponse<T>` (pattern: `FileController` → `FileService`/`FileServiceImpl` → `SupabaseStorageService`). This is consistent with `UserController`/`AuthenticationController`/`BrandProfileController`.

23. **Centralize shared constants — never duplicate magic strings/values across files.** Supabase Storage bucket names and URL markers live ONLY in `config/storage/StorageBuckets` (`AVATARS`, `DOCUMENTS`, `AVATAR_PUBLIC_PREFIX`); reference them from `SupabaseStorageServiceImpl`, `FileServiceImpl`, `UserServiceImpl`, etc. Do not re-declare the literal `"avatars"`/`"documents"` (or any equivalent shared constant) inline in multiple classes.

24. **No external/network I/O inside an open DB `@Transactional` boundary.** Calls to Supabase Storage (or any remote service) MUST NOT run while a DB transaction is held open. When a side-effect (e.g. deleting the old avatar object after a profile update) should happen only on success, defer it with `TransactionSynchronizationManager.registerSynchronization(...).afterCommit()` so it runs after commit and is skipped on rollback (see `UserServiceImpl.scheduleOldAvatarDeletion`). Best-effort cleanups still log on failure and never break the main flow.
