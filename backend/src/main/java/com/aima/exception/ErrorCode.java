package com.aima.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@AllArgsConstructor
@NoArgsConstructor
@Getter
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(1000, "Yêu cầu không hợp lệ", HttpStatus.BAD_REQUEST),
    INVALID_KEY(1001, "Invalid message key", HttpStatus.BAD_REQUEST),
    UNAUTHENTICATED(401, "Bạn chưa được xác thực", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(403, "Bạn không có quyền truy cập", HttpStatus.FORBIDDEN),

    //USER ERRORS
    USER_EXISTED(1002, "Username đã được sử dụng, hãy sử dụng username khác!", HttpStatus.BAD_REQUEST),
    EMAIL_EXISTED(1003, "Email đã được sử dụng, hãy sử dụng email khác", HttpStatus.BAD_REQUEST),
    USERNAME_INVALID(1004, "Tên người dùng phải có ít nhất 3 ký tự", HttpStatus.BAD_REQUEST),
    INVALID_PASSWORD(1005, "Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ cái và số", HttpStatus.BAD_REQUEST),
    USER_NOT_FOUND(1006, "Tên đăng nhập hoặc mật khẩu không đúng", HttpStatus.UNAUTHORIZED),
    INVALID_CREDENTIALS(1007, "Tên đăng nhập hoặc mật khẩu không đúng", HttpStatus.UNAUTHORIZED),
    USERNAME_REQUIRED(1008, "Username không được để trống", HttpStatus.BAD_REQUEST),
    PASSWORD_REQUIRED(1009, "Password không được để trống", HttpStatus.BAD_REQUEST),
    FULLNAME_REQUIRED(1010, "Họ tên không được để trống", HttpStatus.BAD_REQUEST),
    EMAIL_REQUIRED(1011, "Email không được để trống", HttpStatus.BAD_REQUEST),
    PHONE_REQUIRED(1012, "Số điện thoại không được để trống", HttpStatus.BAD_REQUEST),
    ROLE_ID_REQUIRED(1013, "Role ID không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_PHONE(1014, "Số điện thoại phải có 10-11 chữ số", HttpStatus.BAD_REQUEST),
    INVALID_EMAIL_FORMAT(1015, "Email không đúng định dạng (ví dụ: 112@gmail.com)", HttpStatus.BAD_REQUEST),
    USER_NOT_EXISTED(1016, "Người dùng không tồn tại", HttpStatus.NOT_FOUND),
    INVALID_FULLNAME(1017, "Họ tên không được vượt quá 255 ký tự", HttpStatus.BAD_REQUEST),
    INVALID_AVATAR_URL(1028, "Đường dẫn ảnh đại diện không được vượt quá 500 ký tự", HttpStatus.BAD_REQUEST),
    USER_LIST_EMPTY(1018, "Không có tài khoản nào trong hệ thống!!!", HttpStatus.NOT_FOUND),
    DATE_OF_BIRTH_REQUIRED(1025, "Ngày sinh không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_DATE_OF_BIRTH(1026, "Ngày sinh phải là một ngày trong quá khứ", HttpStatus.BAD_REQUEST),
    ACCOUNT_ALREADY_PENDING_DELETE(1026, "Tài khoản đã trong trạng thái chờ xóa", HttpStatus.BAD_REQUEST),
    ACCOUNT_NOT_PENDING_DELETE(1027, "Tài khoản không trong trạng thái chờ xóa", HttpStatus.BAD_REQUEST),

    // ROLE ERRORS
    ROLE_NOT_FOUND(1019, "Role không tồn tại", HttpStatus.NOT_FOUND),
    DEFAULT_ROLE_NOT_FOUND(1020, "Không tìm thấy role mặc định", HttpStatus.NOT_FOUND),
    USER_INACTIVE(1021, "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để mở lại.", HttpStatus.FORBIDDEN),

    DELETE_ADMIN_INVALID(1022, "Không thể xóa tài khoản Quản trị viên hệ thống", HttpStatus.BAD_REQUEST),
    DELETE_SELF_INVALID(1023, "Bạn không thể tự khóa tài khoản của chính mình!", HttpStatus.BAD_REQUEST),
    DELETE_OTHER_ADMIN_INVALID(1024, "Bạn không thể xóa tài khoản Quản trị viên khác!", HttpStatus.BAD_REQUEST),

    //reset password
    EMAIL_NOT_FOUND(1057, "Email không tồn tại trong hệ thống", HttpStatus.NOT_FOUND),
    OTP_REQUIRED(1058, "Mã OTP không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_OTP(1059, "Mã OTP phải có 6 chữ số", HttpStatus.BAD_REQUEST),
    OTP_NOT_FOUND(1060, "Mã OTP không hợp lệ hoặc đã hết hạn", HttpStatus.BAD_REQUEST),
    OTP_EXPIRED(1061, "Mã OTP đã hết hạn", HttpStatus.BAD_REQUEST),
    OTP_ALREADY_USED(1062, "Mã OTP đã được sử dụng", HttpStatus.BAD_REQUEST),
    INVALID_OTP_OR_EMAIL(1063, "Mã OTP hoặc email không chính xác", HttpStatus.BAD_REQUEST),
    TOKEN_NOT_FOUND(1064, "Token không hợp lệ", HttpStatus.BAD_REQUEST),
    PASSWORDS_NOT_MATCH(1065, "Mật khẩu xác nhận không khớp", HttpStatus.BAD_REQUEST),
    CONFIRM_PASSWORD_REQUIRED(1066, "Vui lòng xác nhận mật khẩu", HttpStatus.BAD_REQUEST),

    CHAT_SESSION_ID_REQUIRED(1067, "Session chat không được để trống", HttpStatus.BAD_REQUEST),
    CHAT_SESSION_PROCESSING_ERROR(1068, "Không thể xử lý dữ liệu lịch sử chat", HttpStatus.INTERNAL_SERVER_ERROR),
    CHAT_SESSION_TITLE_REQUIRED(1069, "Tiêu đề phiên chat không được để trống", HttpStatus.BAD_REQUEST),
    CHAT_SESSION_NOT_FOUND(1077, "Không tìm thấy phiên chat", HttpStatus.NOT_FOUND),

    PASSWORD_INCORRECT(1070, "Mật khẩu hiện tại không chính xác", HttpStatus.BAD_REQUEST),
    PASSWORD_CHANGE_LIMIT(1071, "Bạn chỉ được phép đổi mật khẩu 1 lần trong vòng 7 ngày", HttpStatus.BAD_REQUEST),
    OTP_ATTEMPTS_EXCEEDED(1072, "Bạn đã nhập sai mã OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.", HttpStatus.BAD_REQUEST),
    OTP_NOT_VERIFIED(1073, "Vui lòng xác thực mã OTP trước khi đặt lại mật khẩu", HttpStatus.BAD_REQUEST),

    // ONBOARDING (complete-profile)
    WEAK_PASSWORD(1074, "Mật khẩu quá yếu. Cần tối thiểu 8 ký tự và đạt mức Trung bình (gồm chữ hoa, chữ thường, số hoặc ký tự đặc biệt).", HttpStatus.BAD_REQUEST),
    PROFILE_ALREADY_COMPLETED(1075, "Hồ sơ của bạn đã được hoàn tất trước đó", HttpStatus.BAD_REQUEST),
    DOB_REQUIRED(1076, "Ngày sinh không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_DOB(1077, "Ngày sinh phải là một ngày trong quá khứ", HttpStatus.BAD_REQUEST),


    // NOTIFICATION & FEEDBACK ERRORS
    NOTIFICATION_NOT_FOUND(1600, "Không tìm thấy thông báo", HttpStatus.NOT_FOUND),
    FEEDBACK_NOT_FOUND(1601, "Không tìm thấy nhận xét", HttpStatus.NOT_FOUND),

    // BRAND PROFILE ERRORS
    BRAND_NAME_REQUIRED(1700, "Tên thương hiệu không được để trống", HttpStatus.BAD_REQUEST),
    INDUSTRY_REQUIRED(1701, "Lĩnh vực không được để trống", HttpStatus.BAD_REQUEST),
    TARGET_AUDIENCE_REQUIRED(1702, "Đối tượng mục tiêu không được để trống", HttpStatus.BAD_REQUEST),
    PLATFORM_REQUIRED(1703, "Vui lòng chọn ít nhất một nền tảng", HttpStatus.BAD_REQUEST),
    POSTING_FREQUENCY_REQUIRED(1704, "Tần suất đăng bài không được để trống", HttpStatus.BAD_REQUEST),
    BRAND_PROFILE_NOT_FOUND(1705, "Không tìm thấy hồ sơ thương hiệu", HttpStatus.NOT_FOUND),

    // OAUTH2 ERRORS
    OAUTH2_EMAIL_NOT_VERIFIED(2001, "Email Google chưa được xác thực. Vui lòng xác thực email trước khi đăng nhập.", HttpStatus.BAD_REQUEST),
    OAUTH2_PROCESSING_ERROR(2002, "Lỗi xử lý đăng nhập Google. Vui lòng thử lại.", HttpStatus.INTERNAL_SERVER_ERROR),

    // FILE / STORAGE ERRORS
    FILE_REQUIRED(1700, "File không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_FILE_TYPE(1701, "Định dạng file không được hỗ trợ", HttpStatus.BAD_REQUEST),
    FILE_TOO_LARGE(1702, "Kích thước file vượt quá giới hạn cho phép", HttpStatus.BAD_REQUEST),
    FILE_READ_FAILED(1703, "Không thể đọc nội dung file", HttpStatus.INTERNAL_SERVER_ERROR),
    FILE_UPLOAD_FAILED(1704, "Tải file lên thất bại, vui lòng thử lại", HttpStatus.INTERNAL_SERVER_ERROR),
    FILE_DELETE_FAILED(1705, "Xóa file thất bại, vui lòng thử lại", HttpStatus.INTERNAL_SERVER_ERROR),
    SIGNED_URL_FAILED(1706, "Không thể tạo đường dẫn truy cập file", HttpStatus.INTERNAL_SERVER_ERROR),
    FILE_PATH_REQUIRED(1707, "Đường dẫn file không được để trống", HttpStatus.BAD_REQUEST),;

    private int code;
    private String message;
    private HttpStatusCode statusCode;

}
