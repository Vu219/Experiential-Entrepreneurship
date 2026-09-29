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
    ACCOUNT_ALREADY_PENDING_DELETE(1029, "Tài khoản đã trong trạng thái chờ xóa", HttpStatus.BAD_REQUEST),
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
    CHAT_SESSION_NOT_FOUND(1078, "Không tìm thấy phiên chat", HttpStatus.NOT_FOUND),

    PASSWORD_INCORRECT(1070, "Mật khẩu hiện tại không chính xác", HttpStatus.BAD_REQUEST),
    PASSWORD_CHANGE_LIMIT(1071, "Bạn chỉ được phép đổi mật khẩu 1 lần trong vòng 7 ngày", HttpStatus.BAD_REQUEST),
    OTP_ATTEMPTS_EXCEEDED(1072, "Bạn đã nhập sai mã OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.", HttpStatus.BAD_REQUEST),
    OTP_NOT_VERIFIED(1073, "Vui lòng xác thực mã OTP trước khi đặt lại mật khẩu", HttpStatus.BAD_REQUEST),

    // ONBOARDING (complete-profile)
    WEAK_PASSWORD(1074, "Mật khẩu quá yếu. Cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.", HttpStatus.BAD_REQUEST),
    PROFILE_ALREADY_COMPLETED(1075, "Hồ sơ của bạn đã được hoàn tất trước đó", HttpStatus.BAD_REQUEST),
    DOB_REQUIRED(1076, "Ngày sinh không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_DOB(1077, "Ngày sinh phải là một ngày trong quá khứ", HttpStatus.BAD_REQUEST),

    // ĐĂNG KÝ QUA OTP
    OTP_RESEND_TOO_SOON(1079, "Bạn vừa yêu cầu mã OTP. Vui lòng đợi 60 giây trước khi gửi lại.", HttpStatus.TOO_MANY_REQUESTS),
    REGISTRATION_SESSION_EXPIRED(1080, "Phiên đăng ký đã hết hạn. Vui lòng đăng ký lại.", HttpStatus.BAD_REQUEST),
    REGISTER_OTP_INCORRECT(1081, "Mã OTP không chính xác. Vui lòng kiểm tra lại.", HttpStatus.BAD_REQUEST),


    // NOTIFICATION & FEEDBACK ERRORS
    NOTIFICATION_NOT_FOUND(1600, "Không tìm thấy thông báo", HttpStatus.NOT_FOUND),
    FEEDBACK_NOT_FOUND(1601, "Không tìm thấy nhận xét", HttpStatus.NOT_FOUND),

    // BRAND PROFILE ERRORS
    BRAND_NAME_REQUIRED(1700, "Tên thương hiệu không được để trống", HttpStatus.BAD_REQUEST),
    INDUSTRY_REQUIRED(1701, "Lĩnh vực không được để trống", HttpStatus.BAD_REQUEST),
    TARGET_AUDIENCE_REQUIRED(1702, "Đối tượng mục tiêu không được để trống", HttpStatus.BAD_REQUEST),
    PLATFORM_REQUIRED(1703, "Vui lòng chọn ít nhất một nền tảng", HttpStatus.BAD_REQUEST),
    BRAND_PROFILE_NOT_FOUND(1705, "Không tìm thấy hồ sơ thương hiệu", HttpStatus.NOT_FOUND),

    // CONTENT STRATEGY ERRORS
    BRAND_ID_REQUIRED(1710, "Thiếu mã hồ sơ thương hiệu", HttpStatus.BAD_REQUEST),
    STRATEGY_NAME_REQUIRED(1711, "Tên chiến lược không được để trống", HttpStatus.BAD_REQUEST),
    STRATEGY_GOAL_REQUIRED(1712, "Vui lòng chọn ít nhất một mục tiêu", HttpStatus.BAD_REQUEST),
    STRATEGY_CONTENT_TYPE_REQUIRED(1713, "Vui lòng chọn ít nhất một loại nội dung", HttpStatus.BAD_REQUEST),
    STRATEGY_FREQUENCY_COUNT_REQUIRED(1714, "Tần suất đăng không được để trống", HttpStatus.BAD_REQUEST),
    CONTENT_STRATEGY_NOT_FOUND(1715, "Không tìm thấy chiến lược nội dung", HttpStatus.NOT_FOUND),
    STRATEGY_STATUS_REQUIRED(1716, "Trạng thái chiến lược không được để trống", HttpStatus.BAD_REQUEST),

    // OAUTH2 ERRORS
    OAUTH2_EMAIL_NOT_VERIFIED(2001, "Email Google chưa được xác thực. Vui lòng xác thực email trước khi đăng nhập.", HttpStatus.BAD_REQUEST),
    OAUTH2_PROCESSING_ERROR(2002, "Lỗi xử lý đăng nhập Google. Vui lòng thử lại.", HttpStatus.INTERNAL_SERVER_ERROR),

    // FILE / STORAGE ERRORS
    FILE_REQUIRED(1800, "File không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_FILE_TYPE(1801, "Định dạng file không được hỗ trợ", HttpStatus.BAD_REQUEST),
    FILE_TOO_LARGE(1802, "Kích thước file vượt quá giới hạn cho phép", HttpStatus.BAD_REQUEST),
    FILE_READ_FAILED(1803, "Không thể đọc nội dung file", HttpStatus.INTERNAL_SERVER_ERROR),
    FILE_UPLOAD_FAILED(1804, "Tải file lên thất bại, vui lòng thử lại", HttpStatus.INTERNAL_SERVER_ERROR),
    FILE_DELETE_FAILED(1805, "Xóa file thất bại, vui lòng thử lại", HttpStatus.INTERNAL_SERVER_ERROR),
    SIGNED_URL_FAILED(1806, "Không thể tạo đường dẫn truy cập file", HttpStatus.INTERNAL_SERVER_ERROR),
    FILE_PATH_REQUIRED(1807, "Đường dẫn file không được để trống", HttpStatus.BAD_REQUEST),

    // PLATFORM CONNECTION (MXH) ERRORS
    INVALID_PLATFORM(1820, "Nền tảng không hợp lệ", HttpStatus.BAD_REQUEST),
    OAUTH_FAILED(1821, "Liên kết tài khoản thất bại. Vui lòng thử lại.", HttpStatus.BAD_REQUEST),
    INVALID_OAUTH_STATE(1822, "Phiên liên kết không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.", HttpStatus.BAD_REQUEST),
    CONNECTION_NOT_FOUND(1823, "Không tìm thấy kết nối tài khoản", HttpStatus.NOT_FOUND),
    TOKEN_ENCRYPTION_FAILED(1824, "Xử lý mã hoá token thất bại", HttpStatus.INTERNAL_SERVER_ERROR),
    TOKEN_REFRESH_FAILED(1825, "Làm mới token thất bại. Vui lòng kết nối lại.", HttpStatus.BAD_REQUEST),
    META_API_ERROR(1826, "Lỗi khi gọi API nền tảng. Vui lòng thử lại sau.", HttpStatus.BAD_GATEWAY),
    CONNECTION_VALIDATION_FAILED(1827, "Kiểm tra kết nối thất bại", HttpStatus.BAD_REQUEST),
    META_MISSING_PERMISSIONS(1828, "Bạn chưa cấp đủ quyền quản lý và đăng bài lên Trang. Vui lòng liên kết lại và chọn đủ quyền.", HttpStatus.BAD_REQUEST),
    META_TOKEN_INVALID(1829, "Token nền tảng đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại.", HttpStatus.BAD_REQUEST),
    INVALID_SIGNED_REQUEST(1833, "signed_request không hợp lệ", HttpStatus.BAD_REQUEST),
    DATA_DELETION_REQUEST_NOT_FOUND(1834, "Không tìm thấy yêu cầu xóa dữ liệu", HttpStatus.NOT_FOUND),

    // PLATFORM API VERSION (ADMIN) ERRORS
    VERSION_REQUIRED(1830, "Version không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_VERSION_FORMAT(1831, "Version sai định dạng (ví dụ: v25.0)", HttpStatus.BAD_REQUEST),
    VERSION_NOT_FOUND(1832, "Không tìm thấy cấu hình version cho nền tảng này", HttpStatus.NOT_FOUND),

    // CONTENT GENERATION ERRORS
    STRATEGY_ID_REQUIRED(1900, "Thiếu mã chiến lược nội dung", HttpStatus.BAD_REQUEST),
    GENERATION_PLATFORM_REQUIRED(1901, "Vui lòng chọn nền tảng để tạo nội dung", HttpStatus.BAD_REQUEST),
    STRATEGY_NOT_ACTIVE(1902, "Chiến lược chưa được kích hoạt (ACTIVE) nên không thể tạo nội dung", HttpStatus.BAD_REQUEST),
    CONTENT_GENERATION_JOB_NOT_FOUND(1903, "Không tìm thấy tác vụ tạo nội dung", HttpStatus.NOT_FOUND),
    AI_SERVICE_ERROR(1904, "Lỗi khi gọi dịch vụ AI. Vui lòng thử lại sau.", HttpStatus.BAD_GATEWAY),
    CONTENT_ITEM_ID_REQUIRED(1905, "Thiếu mã bài nội dung để ghi bản nền tảng", HttpStatus.BAD_REQUEST),
    CONTENT_ITEM_NOT_DRAFT(1906, "Chỉ tạo bản nội dung vào bài đang ở trạng thái Nháp (DRAFT)", HttpStatus.BAD_REQUEST),
    AI_TIMEOUT(1907, "Quá trình tạo nội dung mất nhiều thời gian hơn dự kiến, vui lòng thử lại.", HttpStatus.GATEWAY_TIMEOUT),
    IDEMPOTENCY_KEY_INVALID(1944, "Idempotency-Key không hợp lệ (tối đa 64 ký tự)", HttpStatus.BAD_REQUEST),

    // TREND RESEARCH ERRORS
    ACTIVE_BRAND_PROFILE_REQUIRED(1910, "Cần có hồ sơ thương hiệu đang hoạt động trước khi nghiên cứu xu hướng", HttpStatus.BAD_REQUEST),
    ACTIVE_STRATEGY_REQUIRED(1911, "Cần có chiến lược nội dung ACTIVE trước khi nghiên cứu xu hướng", HttpStatus.BAD_REQUEST),
    RESEARCH_ALREADY_RUNNING(1912, "Đã có phiên nghiên cứu xu hướng đang chạy. Vui lòng chờ hoàn tất.", HttpStatus.CONFLICT),
    RESEARCH_SESSION_NOT_FOUND(1913, "Không tìm thấy phiên nghiên cứu xu hướng", HttpStatus.NOT_FOUND),
    RESEARCH_ARTICLE_COUNT_INVALID(1914, "Số ý tưởng mong muốn phải từ 1 đến 20", HttpStatus.BAD_REQUEST),
    TREND_IDS_REQUIRED(1915, "Vui lòng chọn ít nhất một trend để xóa", HttpStatus.BAD_REQUEST),
    TREND_NOT_FOUND(1916, "Không tìm thấy trend để xóa", HttpStatus.NOT_FOUND),

    // CONTENT ITEM (EDIT / REVIEW) ERRORS
    CONTENT_ITEM_NOT_FOUND(1920, "Không tìm thấy nội dung", HttpStatus.NOT_FOUND),
    CONTENT_ITEM_NOT_EDITABLE(1921, "Nội dung ở trạng thái này không thể chỉnh sửa", HttpStatus.BAD_REQUEST),
    INVALID_CONTENT_STATUS_TRANSITION(1922, "Chuyển trạng thái nội dung không hợp lệ", HttpStatus.BAD_REQUEST),
    CONTENT_STATUS_REQUIRED(1923, "Thiếu trạng thái nội dung", HttpStatus.BAD_REQUEST),

    // PLATFORM FORMATTING ERRORS
    FORMAT_PLATFORMS_REQUIRED(1924, "Vui lòng chọn ít nhất một nền tảng để định dạng nội dung", HttpStatus.BAD_REQUEST),
    CONTENT_ITEM_NOT_FORMATTABLE(1925, "Nội dung ở trạng thái này không thể định dạng theo nền tảng", HttpStatus.BAD_REQUEST),
    CONTENT_FORMATTING_JOB_NOT_FOUND(1926, "Không tìm thấy tác vụ định dạng nội dung", HttpStatus.NOT_FOUND),

    // POST SCHEDULING ERRORS (FR-47..FR-51)
    SCHEDULE_CONTENT_VERSION_REQUIRED(1930, "Thiếu mã bản định dạng nội dung cần lên lịch", HttpStatus.BAD_REQUEST),
    SCHEDULE_PLATFORM_ACCOUNT_REQUIRED(1931, "Thiếu tài khoản nền tảng để đăng bài", HttpStatus.BAD_REQUEST),
    SCHEDULE_TIME_REQUIRED(1932, "Thiếu thời gian đăng bài", HttpStatus.BAD_REQUEST),
    SCHEDULE_TIME_IN_PAST(1933, "Thời gian đăng bài phải ở tương lai", HttpStatus.BAD_REQUEST),
    CONTENT_VERSION_NOT_FOUND(1934, "Không tìm thấy bản định dạng nội dung", HttpStatus.NOT_FOUND),
    CONTENT_VERSION_NOT_SCHEDULABLE(1935, "Chỉ lên lịch được nội dung đã định dạng (FORMATTED)", HttpStatus.BAD_REQUEST),
    CONNECTION_NOT_ACTIVE(1936, "Tài khoản nền tảng chưa kết nối hoặc không còn hoạt động", HttpStatus.BAD_REQUEST),
    SCHEDULE_PLATFORM_MISMATCH(1937, "Nền tảng của tài khoản không khớp với nền tảng của nội dung", HttpStatus.BAD_REQUEST),
    SCHEDULE_ALREADY_EXISTS(1938, "Bản nội dung này đã có lịch đăng. Vui lòng cập nhật hoặc hủy lịch cũ.", HttpStatus.CONFLICT),
    SCHEDULE_NOT_FOUND(1939, "Không tìm thấy lịch đăng bài", HttpStatus.NOT_FOUND),
    SCHEDULE_NOT_EDITABLE(1940, "Lịch đăng ở trạng thái này không thể cập nhật", HttpStatus.BAD_REQUEST),
    SCHEDULE_NOT_CANCELLABLE(1941, "Chỉ hủy được lịch chưa đăng bài", HttpStatus.BAD_REQUEST),
    SCHEDULING_BLOCKED_PENDING_DELETE(1942, "Tài khoản đang chờ xóa nên không thể lên lịch hoặc kích hoạt lại bài. Hãy khôi phục tài khoản trước.", HttpStatus.BAD_REQUEST),
    SCHEDULE_TARGET_NOT_PAGE(1943, "Facebook chỉ cho phép đăng lên Trang, vui lòng chọn một Trang", HttpStatus.BAD_REQUEST),

    // PERFORMANCE ANALYSIS ERRORS (FR-59..FR-62)
    POST_NOT_FOUND(1946, "Không tìm thấy bài đăng", HttpStatus.NOT_FOUND),

    // CONTENT LIBRARY ERRORS (FR-87..FR-89)
    CONTENT_ITEM_NOT_DELETABLE(1947, "Chỉ xóa được nội dung ở trạng thái Draft/Generated", HttpStatus.BAD_REQUEST),
    INVALID_CONTENT_SCRIPT(1948, "Kịch bản video không hợp lệ", HttpStatus.BAD_REQUEST),
    CONTENT_WIZARD_STEP_INVALID(1949, "Bước wizard không hợp lệ (1-4)", HttpStatus.BAD_REQUEST),

    // PARTIAL SCRIPT REGENERATION ERRORS (tạo lại từng phần kịch bản)
    REGEN_SECTION_REQUIRED(1950, "Thiếu phần cần tạo lại (hook/body/cta)", HttpStatus.BAD_REQUEST),
    REGEN_FIELD_REQUIRED(1951, "Thiếu loại nội dung cần tạo lại (content/scene)", HttpStatus.BAD_REQUEST),
    CONTENT_REGENERATION_JOB_NOT_FOUND(1952, "Không tìm thấy tác vụ tạo lại", HttpStatus.NOT_FOUND),
    REGEN_STEP_NOT_FOUND(1953, "Không tìm thấy bước cần tạo lại trong kịch bản", HttpStatus.BAD_REQUEST),

    // STRATEGY OPTIMIZATION ERRORS (FR-65..FR-68)
    STRATEGY_OPTIMIZATION_JOB_NOT_FOUND(1960, "Không tìm thấy tác vụ tối ưu chiến lược", HttpStatus.NOT_FOUND),
    NO_ANALYZED_POSTS(1961, "Chưa có bài đăng nào có số liệu để phân tích — cần ít nhất một bài đã thu analytics", HttpStatus.BAD_REQUEST),
    ADJUSTMENT_NOT_FOUND(1962, "Không tìm thấy đề xuất điều chỉnh chiến lược", HttpStatus.NOT_FOUND),
    ADJUSTMENT_ALREADY_DECIDED(1963, "Đề xuất này đã được quyết định trước đó", HttpStatus.BAD_REQUEST),
    ADJUSTMENT_DECISION_REQUIRED(1964, "Thiếu quyết định cho đề xuất (APPLIED/REJECTED)", HttpStatus.BAD_REQUEST),
    INVALID_ADJUSTMENT_DECISION(1965, "Quyết định không hợp lệ — chỉ chấp nhận APPLIED hoặc REJECTED", HttpStatus.BAD_REQUEST),

    // ADMIN ERRORS (FR-80..FR-84)
    USER_STATUS_REQUIRED(1970, "Thiếu trạng thái tài khoản (ACTIVE/LOCKED)", HttpStatus.BAD_REQUEST),
    INVALID_USER_STATUS(1971, "Trạng thái không hợp lệ — chỉ đổi được sang ACTIVE hoặc LOCKED", HttpStatus.BAD_REQUEST),
    ADMIN_PROTECTED(1972, "Không thể khóa/xóa tài khoản quản trị", HttpStatus.BAD_REQUEST),

    // WEBHOOK ERRORS
    WEBHOOK_VERIFY_FAILED(1973, "Xác thực webhook thất bại", HttpStatus.FORBIDDEN),

    // ADMIN USER MANAGEMENT (FR-80)
    ADMIN_CANNOT_DEMOTE_SELF(1974, "Bạn không thể tự hạ vai trò của chính mình", HttpStatus.BAD_REQUEST),
    EMAIL_LOCKED_FOR_GOOGLE(1975, "Tài khoản đăng nhập bằng Google không được đổi email", HttpStatus.BAD_REQUEST),
    GOOGLE_NO_PASSWORD(1976, "Tài khoản đăng nhập qua Google không dùng mật khẩu", HttpStatus.BAD_REQUEST),

    // PLAN MANAGEMENT (quản lý gói dịch vụ — admin + landing)
    PLAN_NOT_FOUND(1980, "Không tìm thấy gói dịch vụ", HttpStatus.NOT_FOUND),
    PLAN_CODE_REQUIRED(1981, "Thiếu mã gói", HttpStatus.BAD_REQUEST),
    PLAN_CODE_EXISTED(1982, "Mã gói đã tồn tại", HttpStatus.BAD_REQUEST),
    PLAN_CORE_PROTECTED(1983, "Không thể xóa gói mặc định (FREE/PLUS/PRO)", HttpStatus.BAD_REQUEST),
    PLAN_NAME_REQUIRED(1984, "Thiếu tên gói", HttpStatus.BAD_REQUEST),
    PLAN_PRICE_INVALID(1985, "Giá gói không hợp lệ", HttpStatus.BAD_REQUEST),
    PLAN_FEATURE_NOT_FOUND(1986, "Không tìm thấy dòng tính năng", HttpStatus.NOT_FOUND),
    PLAN_FEATURE_NAME_REQUIRED(1987, "Thiếu tên tính năng", HttpStatus.BAD_REQUEST),
    PLAN_FIELD_REQUIRED(1988, "Thiếu trường bắt buộc của gói", HttpStatus.BAD_REQUEST),
    PLAN_BILLING_INTERVAL_INVALID(1989, "Chu kỳ thanh toán phải từ 1 đến 60 tháng", HttpStatus.BAD_REQUEST),

    // TOKEN USAGE (hạn mức token LLM theo tháng — Plan.monthlyTokenLimit)
    TOKEN_QUOTA_EXCEEDED(1990, "Bạn đã dùng hết hạn mức token của tháng này. Nâng cấp gói hoặc chờ sang tháng sau.", HttpStatus.TOO_MANY_REQUESTS),

    // AI CONFIG (cấu hình AI theo DB — admin quản lý provider/model/routing)
    AI_PROVIDER_NOT_FOUND(2010, "Không tìm thấy nhà cung cấp AI", HttpStatus.NOT_FOUND),
    AI_MODEL_NOT_FOUND(2011, "Không tìm thấy model AI", HttpStatus.NOT_FOUND),
    AI_ROUTING_NOT_FOUND(2012, "Không tìm thấy định tuyến AI cho nghiệp vụ này", HttpStatus.NOT_FOUND),
    AI_MODEL_CODE_REQUIRED(2013, "Thiếu mã model", HttpStatus.BAD_REQUEST),
    AI_MODEL_EXISTED(2014, "Model này đã tồn tại cho nhà cung cấp", HttpStatus.CONFLICT),
    AI_MODEL_IN_USE(2015, "Model đang được dùng trong định tuyến — đổi định tuyến trước khi xóa", HttpStatus.BAD_REQUEST),
    AI_MODEL_PROVIDER_REQUIRED(2016, "Thiếu nhà cung cấp của model", HttpStatus.BAD_REQUEST),
    AI_PROVIDER_KEY_MISSING(2017, "Nhà cung cấp chưa có API key", HttpStatus.BAD_REQUEST),
    AI_ROUTING_PRIMARY_MODEL_REQUIRED(2018, "Thiếu model chính cho định tuyến", HttpStatus.BAD_REQUEST),
    AI_TEMPERATURE_INVALID(2019, "Temperature phải trong khoảng 0–2", HttpStatus.BAD_REQUEST),
    AI_MAX_TOKENS_INVALID(2020, "Max tokens phải là số dương", HttpStatus.BAD_REQUEST),
    AI_ROUTING_ENABLED_REQUIRED(2021, "Thiếu trạng thái bật/tắt của định tuyến", HttpStatus.BAD_REQUEST),
    AI_USAGE_MONTH_INVALID(2022, "Tháng không hợp lệ — dùng định dạng YYYY-MM", HttpStatus.BAD_REQUEST),

    // SUBSCRIPTION & USAGE (gói đăng ký + điều chỉnh token — grant/reset admin dùng từ pha sau)
    SUBSCRIPTION_NOT_FOUND(2023, "Không tìm thấy gói đăng ký của người dùng", HttpStatus.NOT_FOUND),
    USAGE_ADJUSTMENT_INVALID(2024, "Điều chỉnh token không hợp lệ", HttpStatus.BAD_REQUEST),

    // BILLING RATES (hệ số quy đổi hạn mức — billing_rates, append-only versioning)
    BILLING_RATE_UNIT_TYPE_REQUIRED(2025, "Thiếu loại đơn vị quy đổi", HttpStatus.BAD_REQUEST),
    BILLING_RATE_MULTIPLIER_INVALID(2026, "Hệ số quy đổi phải lớn hơn 0", HttpStatus.BAD_REQUEST),
    BILLING_RATE_MIN_CHARGE_INVALID(2027, "Mức trừ tối thiểu phải ≥ 0", HttpStatus.BAD_REQUEST),
    BILLING_RATE_EFFECTIVE_FROM_INVALID(2028,
            "Mốc hiệu lực không hợp lệ — phải từ bây giờ trở đi và sau version đang mở cùng scope",
            HttpStatus.BAD_REQUEST),

    // DEV TOOLS (chỉ bật ở môi trường dev qua cờ cấu hình)
    DEV_TOOL_DISABLED(2029, "Công cụ dev đang tắt — bật AIMA_DEV_CREDIT_SEED=true (chỉ môi trường dev)",
            HttpStatus.FORBIDDEN),
    DEV_SEED_SCENARIO_INVALID(2030, "Kịch bản seed không hợp lệ — dùng SIMPLE, FIFO hoặc EXPIRY",
            HttpStatus.BAD_REQUEST),

    // USAGE EVENTS (tab Nhật ký sử dụng)
    USAGE_EXPORT_TOO_LARGE(2031, "Kết quả vượt trần 50.000 dòng — thu hẹp bộ lọc rồi export lại",
            HttpStatus.BAD_REQUEST),
    USAGE_EVENT_NOT_FOUND(2032, "Không tìm thấy bản ghi usage", HttpStatus.NOT_FOUND),
    USAGE_CURSOR_INVALID(2033, "Con trỏ phân trang không hợp lệ — tải lại trang đầu", HttpStatus.BAD_REQUEST),

    // USAGE ALERTS (cảnh báo bất thường — pha 5A alert-only)
    USAGE_ALERT_NOT_FOUND(2034, "Không tìm thấy cảnh báo", HttpStatus.NOT_FOUND),
    USAGE_ALERT_ALREADY_ACKED(2035, "Cảnh báo đã được xác nhận trước đó", HttpStatus.BAD_REQUEST),
    ALERT_CONFIG_KEY_INVALID(2036, "Khoá cấu hình ngưỡng cảnh báo không hợp lệ", HttpStatus.BAD_REQUEST),
    ALERT_CONFIG_VALUE_INVALID(2037, "Giá trị ngưỡng cảnh báo phải là số không âm", HttpStatus.BAD_REQUEST),

    // QUẢN LÝ DOANH THU (trang admin /admin/revenue — sổ cái payments)
    REVENUE_PARAM_REQUIRED(2038,
            "Thiếu tham số cho chế độ lọc đã chọn (theo ngày cần year+month, theo tháng cần year, "
                    + "theo nửa năm cần year+half, theo năm cần fromYear+toYear, tuỳ chỉnh cần from+to)",
            HttpStatus.BAD_REQUEST),
    REVENUE_RANGE_INVALID(2039, "Khoảng thời gian không hợp lệ — mốc bắt đầu phải trước mốc kết thúc",
            HttpStatus.BAD_REQUEST),
    REVENUE_RANGE_TOO_LARGE(2040,
            "Khoảng thời gian quá dài — tối đa 10 năm, riêng chế độ tuỳ chỉnh tối đa 366 ngày",
            HttpStatus.BAD_REQUEST),
    REVENUE_EXPORT_TOO_LARGE(2041, "Kết quả vượt trần 50.000 dòng — thu hẹp bộ lọc rồi export lại",
            HttpStatus.BAD_REQUEST),
    DEV_PAYMENT_SEED_DISABLED(2042,
            "Công cụ dev đang tắt — bật AIMA_DEV_PAYMENT_SEED=true (chỉ môi trường dev)",
            HttpStatus.FORBIDDEN),

    // LOG HOẠT ĐỘNG NGƯỜI DÙNG (tab /admin/logs?tab=activity)
    ACTIVITY_LOG_NOT_FOUND(2043, "Không tìm thấy bản ghi hoạt động", HttpStatus.NOT_FOUND),
    ACTIVITY_LOG_EXPORT_TOO_LARGE(2044,
            "Kết quả vượt trần 50.000 dòng — thu hẹp bộ lọc rồi export lại", HttpStatus.BAD_REQUEST),
    ACTIVITY_LOG_RANGE_INVALID(2045, "Khoảng thời gian không hợp lệ — từ ngày phải trước đến ngày",
            HttpStatus.BAD_REQUEST),

    // Phân tích (Analytics summary/timeseries — UI-08) — 2050+
    ANALYTICS_RANGE_INVALID(2050, "Khoảng thời gian không hợp lệ — từ ngày phải trước đến ngày",
            HttpStatus.BAD_REQUEST),
    ANALYTICS_RANGE_TOO_LARGE(2051, "Khoảng thời gian quá dài — tối đa 366 ngày", HttpStatus.BAD_REQUEST),
    ANALYTICS_SEED_DISABLED(2052,
            "Công cụ dev đang tắt — bật AIMA_DEV_ANALYTICS_SEED=true (chỉ môi trường dev)", HttpStatus.FORBIDDEN),
    ANALYTICS_EXPORT_TOO_LARGE(2053,
            "Kết quả vượt trần 50.000 dòng — thu hẹp khoảng ngày hoặc bộ lọc rồi export lại",
            HttpStatus.BAD_REQUEST),

    // Bài đăng lỗi & bị từ chối (admin — FR-82/FR-83) — 2060+
    FAILED_POST_RANGE_INVALID(2060, "Khoảng thời gian không hợp lệ — từ ngày phải trước đến ngày",
            HttpStatus.BAD_REQUEST),
    FAILED_POST_RANGE_TOO_LARGE(2061, "Khoảng thời gian quá dài — tối đa 366 ngày", HttpStatus.BAD_REQUEST),
    FAILED_POST_EXPORT_TOO_LARGE(2062,
            "Kết quả vượt trần 50.000 dòng — thu hẹp bộ lọc rồi export lại", HttpStatus.BAD_REQUEST),

    // Thanh toán gói dịch vụ qua payOS — 2070+
    PAYMENT_NOT_FOUND(2070, "Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND),
    PLAN_NOT_PURCHASABLE(2071, "Gói này hiện không bán — vui lòng chọn gói khác",
            HttpStatus.BAD_REQUEST),
    PLAN_DOWNGRADE_NOT_ALLOWED(2072,
            "Chỉ nâng cấp được lên gói có giá cao hơn gói bạn đang dùng. Vui lòng chờ gói hiện tại hết hạn rồi mua gói này.",
            HttpStatus.BAD_REQUEST),
    PAYMENT_PENDING_EXISTS(2073,
            "Bạn đang có một đơn chờ thanh toán. Hoàn tất hoặc huỷ đơn đó trước khi tạo đơn mới.",
            HttpStatus.CONFLICT),
    PAYMENT_NOT_CANCELLABLE(2074, "Chỉ huỷ được đơn đang chờ thanh toán", HttpStatus.BAD_REQUEST),
    PAYMENT_ALREADY_PAID(2075, "Đơn hàng này đã được thanh toán", HttpStatus.CONFLICT),
    PAYMENT_ACCESS_DENIED(2076, "Bạn không có quyền xem đơn hàng này", HttpStatus.FORBIDDEN),
    PAYMENT_GATEWAY_ERROR(2077, "Không kết nối được cổng thanh toán — vui lòng thử lại sau",
            HttpStatus.BAD_GATEWAY),
    PAYMENT_GATEWAY_NOT_CONFIGURED(2078,
            "Cổng thanh toán chưa được cấu hình — thiếu PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY",
            HttpStatus.SERVICE_UNAVAILABLE),
    PAYMENT_SIGNATURE_INVALID(2079, "Chữ ký dữ liệu thanh toán không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_MISMATCH(2080, "Số tiền không khớp với đơn hàng", HttpStatus.BAD_REQUEST),
    PAYMENT_ORDER_CODE_UNAVAILABLE(2081,
            "Không sinh được mã đơn hàng duy nhất — vui lòng thử lại", HttpStatus.INTERNAL_SERVER_ERROR),
    PAYMENT_REASON_REQUIRED(2082, "Thiếu lý do cho thao tác này", HttpStatus.BAD_REQUEST),
    PAYMENT_MOCK_DISABLED(2083,
            "Cổng giả lập đang tắt — đặt PAYMENT_GATEWAY=mock (chỉ môi trường dev)",
            HttpStatus.FORBIDDEN),
    // Chữ ký lệch NHƯNG khớp với biến thể định dạng số còn lại (PayOSSignature.NumberStyle).
    // Tách riêng khỏi PAYMENT_SIGNATURE_INVALID để luồng webhook bật reconcile_required và
    // admin thấy ngay nguyên nhân, thay vì mò nửa ngày. Vẫn KHÔNG kích hoạt gói.
    PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH(2084,
            "Chữ ký dữ liệu thanh toán không hợp lệ", HttpStatus.BAD_REQUEST),
    // KHÔNG KẾT LUẬN ĐƯỢC (timeout/lỗi mạng) — khác hẳn PAYMENT_GATEWAY_ERROR (cổng đã từ
    // chối). Link có thể ĐÃ được tạo bên payOS, nên đơn KHÔNG được set FAILED: giữ PENDING,
    // bật reconcile_required và để job đối soát gọi getPaymentLink kết luận.
    PAYMENT_GATEWAY_TIMEOUT(2085,
            "Cổng thanh toán không phản hồi kịp — đơn đang được đối soát, vui lòng chờ",
            HttpStatus.GATEWAY_TIMEOUT),
    // Cổng khẳng định KHÔNG CÓ link này (HTTP 404). Khác hẳn PAYMENT_GATEWAY_ERROR: đây là
    // bằng chứng link CHƯA TỪNG được tạo, nên đóng đơn treo là an toàn và bắt buộc — nếu
    // không, đơn PENDING không có checkoutUrl sẽ khoá cứng user khỏi việc mua lại.
    PAYMENT_GATEWAY_LINK_NOT_FOUND(2086,
            "Cổng thanh toán không có đơn này", HttpStatus.NOT_FOUND),
    // Đơn đã thu tiền hoặc đã hoàn tiền thì không còn gì để "đánh dấu đã trả" — chặn để admin
    // không vô tình ghi đè sổ cái và cộng hạn gói lần hai.
    PAYMENT_NOT_MARKABLE_PAID(2087,
            "Đơn này đã thu tiền hoặc đã hoàn tiền — không đánh dấu lại được", HttpStatus.CONFLICT),
    // Admin gia hạn/thu hồi gói: mốc hết hạn phải ở TƯƠNG LAI. Đặt mốc quá khứ nghĩa là hạ gói
    // ngay lập tức, việc đó phải làm tường minh bằng cách chọn gói Free.
    SUBSCRIPTION_EXPIRY_INVALID(2088,
            "Ngày hết hạn phải ở tương lai — muốn hạ gói ngay thì chọn gói Free",
            HttpStatus.BAD_REQUEST),
    // Lưu đơn vi phạm một ràng buộc DB KHÁC ràng buộc một-đơn-PENDING (vd CHECK constraint của
    // cột enum lệch với Java). Là lỗi hệ thống, không phải lỗi của user — không thử lại, tên
    // constraint chỉ nằm trong log (không lộ schema DB ra client).
    PAYMENT_ORDER_SAVE_FAILED(2089,
            "Không tạo được đơn thanh toán do lỗi hệ thống — vui lòng thử lại sau hoặc liên hệ hỗ trợ",
            HttpStatus.INTERNAL_SERVER_ERROR),
    // Admin thao tác gói của MỘT user (tab "Gói dịch vụ" trong modal chi tiết người dùng).
    SUBSCRIPTION_DURATION_INVALID(2090,
            "Thời hạn không hợp lệ — cho phép 1–365 ngày, 1–52 tuần hoặc 1–24 tháng", HttpStatus.BAD_REQUEST),
    SUBSCRIPTION_NOT_EXTENDABLE(2091,
            "Gói hiện tại không có hạn dùng để gia hạn (Free hoặc không hết hạn) — hãy dùng Đổi gói",
            HttpStatus.BAD_REQUEST),
    SUBSCRIPTION_SAME_PLAN(2092,
            "Người dùng đang ở gói này — muốn cộng thêm thời hạn thì dùng Gia hạn", HttpStatus.BAD_REQUEST),
    SUBSCRIPTION_ALREADY_FREE(2093, "Người dùng đang ở gói Free — không có gì để thu hồi", HttpStatus.BAD_REQUEST),
    SUBSCRIPTION_CHANGE_TO_FREE(2094, "Muốn hạ về gói Free thì dùng Thu hồi", HttpStatus.BAD_REQUEST),
    SUBSCRIPTION_REASON_REQUIRED(2095, "Vui lòng nhập lý do (tối đa 500 ký tự)", HttpStatus.BAD_REQUEST),
    SUBSCRIPTION_CATEGORY_REQUIRED(2096, "Vui lòng chọn phân loại thao tác", HttpStatus.BAD_REQUEST),
    // PATCH /users/{id} không còn đổi được gói: nó chỉ ghi nhãn cache User.plan, không đụng tới
    // subscriptions (nguồn sự thật) → nhãn và gói thật lệch nhau (bug 25/9).
    USER_PLAN_UPDATE_NOT_ALLOWED(2097,
            "Không đổi gói qua cập nhật tài khoản — dùng mục Gói dịch vụ", HttpStatus.BAD_REQUEST),
    PAYMENT_SUMMARY_RANGE_INVALID(2098,
            "Khoảng thời gian không hợp lệ — cần đủ từ ngày và đến ngày, từ ngày không sau đến ngày",
            HttpStatus.BAD_REQUEST),
    USER_HAS_PENDING_PAYMENT(2099, "Tài khoản còn đơn thanh toán đang chờ — hãy hủy hoặc đợi đơn kết thúc rồi mới xóa tài khoản", HttpStatus.CONFLICT),

    // Quản lý nội dung Landing Page — 2100+
    LANDING_SECTION_NOT_FOUND(2100, "Không tìm thấy section Landing Page", HttpStatus.NOT_FOUND),
    LANDING_CONTENT_INVALID(2101,
            "Nội dung chưa hợp lệ — kiểm tra các ô bắt buộc (đủ cả tiếng Việt và tiếng Anh) và định dạng đường link",
            HttpStatus.BAD_REQUEST),
    LANDING_VERSION_CONFLICT(2102,
            "Section này vừa được người khác cập nhật — tải lại trang để xem bản mới nhất", HttpStatus.CONFLICT),

    // Bộ lọc thời gian trang Token & hạn mức (admin usage) — 2110+
    USAGE_RANGE_INVALID(2110, "Khoảng thời gian không hợp lệ — cần đủ từ ngày và đến ngày, từ ngày không sau đến ngày",
            HttpStatus.BAD_REQUEST),
    USAGE_RANGE_TOO_LARGE(2111, "Khoảng thời gian quá dài — tối đa 366 ngày", HttpStatus.BAD_REQUEST),

    // Trang "Xem lại đơn hàng" + khấu trừ khi nâng cấp gói — 2120+
    UPGRADE_CREDIT_EXCEEDS_PRICE(2120,
            "Giá trị còn lại của gói hiện tại gần bằng hoặc vượt giá gói mới nên không thể nâng cấp lúc này. Vui lòng chờ gói hiện tại hết hạn rồi mua gói này.",
            HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_BELOW_MINIMUM(2121,
            "Số tiền thanh toán thấp hơn mức tối thiểu cổng thanh toán chấp nhận — vui lòng chọn gói khác",
            HttpStatus.BAD_REQUEST),
    PAYMENT_QUOTE_CHANGED(2122,
            "Số tiền của đơn hàng vừa thay đổi (số ngày còn lại của gói hiện tại đã khác). Vui lòng xem lại đơn hàng rồi thanh toán.",
            HttpStatus.CONFLICT),
    PAYMENT_METHOD_NOT_SUPPORTED(2123, "Phương thức thanh toán này hiện chưa hỗ trợ — vui lòng chọn phương thức khác",
            HttpStatus.BAD_REQUEST),
    PLAN_ALREADY_PERMANENT(2124, "Gói hiện tại của bạn không có hạn dùng — không cần gia hạn",
            HttpStatus.BAD_REQUEST),
    ;

    private int code;
    private String message;
    private HttpStatusCode statusCode;

}
