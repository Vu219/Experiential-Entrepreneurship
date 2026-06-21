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

    public static final String DEACTIVATE_ACCOUNT_RESPONSE = """
            {
              "code": 200,
              "message": "Yêu cầu xóa tài khoản đã được ghi nhận",
              "result": {
                "status": "PENDING_DELETE",
                "deletionDate": "2026-07-17T00:00:00",
                "daysRemaining": 30,
                "message": "Tài khoản sẽ bị xóa vĩnh viễn sau 30 ngày. Bạn có thể khôi phục trước thời hạn này."
              }
            }""";

    public static final String RESTORE_ACCOUNT_RESPONSE = """
            {
              "code": 200,
              "message": "Tài khoản đã được khôi phục thành công",
              "result": {
                "status": "ACTIVE",
                "message": "Tài khoản của bạn đã được khôi phục và hoạt động bình thường."
              }
            }""";

    // ─── Change password (authenticated, OTP) ──────────
    public static final String CHANGE_PASSWORD_INIT_REQUEST = """
            {
              "currentPassword": "OldPass@123"
            }""";

    public static final String CHANGE_PASSWORD_INIT_RESPONSE = """
            {
              "code": 200,
              "message": "Mã OTP đổi mật khẩu đã được gửi đến email của bạn",
              "result": null
            }""";

    public static final String CHANGE_PASSWORD_CONFIRM_REQUEST = """
            {
              "otpCode": "123456",
              "newPassword": "NewPass@123",
              "confirmPassword": "NewPass@123"
            }""";

    public static final String CHANGE_PASSWORD_CONFIRM_RESPONSE = """
            {
              "code": 200,
              "message": "Đổi mật khẩu thành công",
              "result": null
            }""";

    public static final String UPDATE_USER_REQUEST = """
            {
              "fullName": "Nguyen Van B",
              "phone": "0909999999",
              "dob": "2000-01-15"
            }""";

    public static final String UPDATE_USER_RESPONSE = """
            {
              "code": 200,
              "message": "Cập nhật thông tin thành công",
              "result": {
                "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "username": "john.doe@gmail.com",
                "fullName": "Nguyen Van B",
                "email": "john.doe@gmail.com",
                "phone": "0909999999",
                "dob": "2000-01-15",
                "status": "ACTIVE",
                "role": {
                  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                  "roleName": "USER",
                  "description": "Standard application user"
                }
              }
            }""";

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

    public static final String COMPLETE_PROFILE_REQUEST = """
            {
              "fullName": "Nguyen Van A",
              "phone": "0901234567",
              "dob": "2000-01-15",
              "password": "Passw0rd!",
              "confirmPassword": "Passw0rd!"
            }""";

    public static final String COMPLETE_PROFILE_RESPONSE = """
            {
              "code": 200,
              "message": "Đã lưu thông tin, email xác nhận đã được gửi",
              "result": {
                "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "username": "nguyenvana",
                "fullName": "Nguyen Van A",
                "email": "nguyenvana@gmail.com",
                "phone": "0901234567",
                "dob": "2000-01-15",
                "status": "ACTIVE",
                "role": {
                  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                  "roleName": "USER",
                  "description": "Standard application user"
                }
              }
            }""";

    // ─── Files / Storage ────────────────────────────────
    public static final String UPLOAD_AVATAR_RESPONSE = """
            {
              "code": 200,
              "message": "Tải ảnh đại diện thành công",
              "result": {
                "bucket": "avatars",
                "path": "3fa85f64-5717-4562-b3fc-2c963f66afa6/9f1c2a3b-_avatar.png",
                "url": "https://xyz.supabase.co/storage/v1/object/public/avatars/3fa85f64-5717-4562-b3fc-2c963f66afa6/9f1c2a3b-_avatar.png"
              }
            }""";

    public static final String UPLOAD_DOCUMENT_RESPONSE = """
            {
              "code": 200,
              "message": "Tải tài liệu thành công",
              "result": {
                "bucket": "documents",
                "path": "3fa85f64-5717-4562-b3fc-2c963f66afa6/4d2e1f0a-_report.pdf",
                "url": null
              }
            }""";

    public static final String SIGNED_URL_RESPONSE = """
            {
              "code": 200,
              "message": "Tạo đường dẫn truy cập thành công",
              "result": {
                "signedUrl": "https://xyz.supabase.co/storage/v1/object/sign/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/4d2e1f0a-_report.pdf?token=eyJ...",
                "expiresInSeconds": 3600
              }
            }""";
}