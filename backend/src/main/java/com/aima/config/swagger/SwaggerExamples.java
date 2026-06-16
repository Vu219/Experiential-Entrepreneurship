package com.aima.config.swagger;

public final class SwaggerExamples {
    private SwaggerExamples() {}

    // ─── Auth ───────────────────────────────────────────
    public static final String LOGIN_REQUEST =
            "{\"email\": \"johndoe@example.com\", \"password\": \"Passw0rd\"}";

    public static final String LOGIN_RESPONSE =
            "{\"code\":200,\"result\":{\"token\":\"eyJhbGciOiJIUzUxMiJ9...\",\"authenticated\":true,\"refreshToken\":\"eyJhbGciOiJIUzUxMiJ9...\"}}";

    public static final String REFRESH_REQUEST =
            "{\"token\": \"eyJhbGciOiJIUzUxMiJ9...\"}";

    public static final String REFRESH_RESPONSE =
            "{\"code\":200,\"result\":{\"token\":\"eyJhbGciOiJIUzUxMiJ9...\",\"refreshToken\":\"eyJhbGciOiJIUzUxMiJ9...\",\"authenticated\":true}}";

    public static final String INTROSPECT_REQUEST =
            "{\"token\": \"eyJhbGciOiJIUzUxMiJ9...\"}";

    public static final String INTROSPECT_RESPONSE =
            "{\"code\":200,\"result\":{\"valid\":true}}";

    public static final String LOGOUT_REQUEST =
            "{\"token\": \"eyJhbGciOiJIUzUxMiJ9...\"}";

    public static final String LOGOUT_RESPONSE =
            "{\"code\":0}";

    public static final String ACCOUNT_STATUS_RESPONSE =
            "{\"code\":0,\"result\":{\"locked\":false}}";

    // ─── Users ──────────────────────────────────────────
    public static final String REGISTER_REQUEST = """
            {
              "password": "Passw0rd",
              "fullName": "John Doe",
              "email": "john.doe@gmail.com",
              "phone": "0901234567"
            }""";

    public static final String REGISTER_RESPONSE = """
            {
              "code": 200,
              "message": "Đăng ký thành công",
              "result": {
                "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "username": "johndoe",
                "fullName": "John Doe",
                "email": "john.doe@gmail.com",
                "phone": "0901234567",
                "status": "ACTIVE",
                "role": {
                  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                  "roleName": "USER",
                  "description": "Standard application user"
                }
              }
            }""";
}