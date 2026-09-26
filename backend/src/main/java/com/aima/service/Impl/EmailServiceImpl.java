package com.aima.service.Impl;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.aima.service.EmailService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EmailServiceImpl implements EmailService {

    final BrevoEmailSender brevoEmailSender;

    @Value("${app.frontend.base-url}")
    String frontendBaseUrl;

    static final String BRAND_NAME = "AIMA";
    static final String BRAND_SUBTITLE = "Trợ lý Marketing AI đa nền tảng";
    // Màu thương hiệu đồng bộ với web (--brand-gradient: cyan → xanh → tím; accent tím #7c3aed).
    static final String BRAND_GRADIENT = "linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6)";
    static final String BRAND_SOLID = "#6366f1"; // fallback cho client email không hỗ trợ gradient
    static final String BRAND_ACCENT = "#7c3aed";
    static final DateTimeFormatter DATE_TIME_FORMAT =
            DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy");

    @Override
    public void sendForgotPasswordOtpEmail(String toEmail, String otpCode, String fullName) {
        String htmlContent = buildOtpEmail(
                fullName,
                "Bạn vừa yêu cầu <b>khôi phục mật khẩu</b> cho tài khoản " + BRAND_NAME + " của mình.",
                otpCode,
                "Mã có hiệu lực trong 1 phút 30 giây.",
                "Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này — tài khoản của bạn vẫn an toàn."
        );
        sendHtmlEmail(toEmail, "Mã OTP khôi phục mật khẩu - " + BRAND_NAME, htmlContent);
    }

    @Override
    public void sendChangePasswordOtpEmail(String toEmail, String otpCode, String fullName) {
        String htmlContent = buildOtpEmail(
                fullName,
                "Bạn đang thực hiện <b>đổi mật khẩu</b> cho tài khoản " + BRAND_NAME + " của mình.",
                otpCode,
                "Mã có hiệu lực trong 1 phút 30 giây.",
                "Nếu bạn không thực hiện thao tác này, vui lòng đổi mật khẩu ngay hoặc liên hệ quản trị viên " + BRAND_NAME + "."
        );
        sendHtmlEmail(toEmail, "Mã OTP đổi mật khẩu - " + BRAND_NAME, htmlContent);
    }

    @Override
    public void sendRegisterOtpEmail(String toEmail, String otpCode, String fullName, long validMinutes) {
        String htmlContent = buildOtpEmail(
                fullName,
                "Cảm ơn bạn đã <b>đăng ký tài khoản</b> " + BRAND_NAME + ". Nhập mã dưới đây để xác thực email và hoàn tất đăng ký.",
                otpCode,
                "Mã có hiệu lực trong " + validMinutes + " phút và chỉ dùng được 1 lần.",
                "Nếu bạn không đăng ký tài khoản " + BRAND_NAME + ", vui lòng bỏ qua email này."
        );
        sendHtmlEmail(toEmail, "Mã OTP xác thực đăng ký - " + BRAND_NAME, htmlContent);
    }

    @Override
    public void sendAccountSetupSuccessEmail(String toEmail, String fullName, LocalDateTime setupTime) {
        String htmlContent = buildAccountSetupEmail(fullName, toEmail, setupTime);
        sendHtmlEmail(toEmail, "Thiết lập tài khoản thành công - " + BRAND_NAME, htmlContent);
    }

    @Override
    public void sendAccountDeletionWarningEmail(String toEmail, String fullName, LocalDateTime deletionDate, long daysRemaining) {
        String htmlContent = buildDeletionWarningEmail(fullName, deletionDate, daysRemaining);
        sendHtmlEmail(toEmail, "Tài khoản sắp bị xóa vĩnh viễn - " + BRAND_NAME, htmlContent);
    }

    // ===== Khung email dùng chung (đồng bộ màu với web) =====
    private String open() {
        return "<div style='margin:0;padding:24px;background-color:#f5f3fb;font-family:Segoe UI,Arial,sans-serif;'>"
                + "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;"
                + "box-shadow:0 8px 24px rgba(80,40,140,0.10);'>";
    }

    private String header() {
        return "<div style='background:" + BRAND_SOLID + ";background:" + BRAND_GRADIENT + ";padding:28px 32px;'>"
                + "<h1 style='margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.5px;'>" + BRAND_NAME + "</h1>"
                + "<p style='margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:13px;'>" + BRAND_SUBTITLE + "</p>"
                + "</div>";
    }

    private String footer() {
        return "<div style='padding:16px 32px;background:#faf7ff;text-align:center;'>"
                + "<p style='margin:0;font-size:12px;color:#a59fbb;'>© " + BRAND_NAME
                + " — Email tự động, vui lòng không trả lời.</p>"
                + "</div></div></div>";
    }

    private String buildOtpEmail(String fullName, String intro, String otpCode, String expiryNote, String footerNote) {
        String greetingName = (fullName != null && !fullName.isBlank()) ? fullName : "bạn";
        return open() + header()
                + "<div style='padding:32px;color:#241f3a;'>"
                + "<h2 style='margin:0 0 12px;font-size:18px;'>Xin chào " + greetingName + ",</h2>"
                + "<p style='margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b4660;'>" + intro + "</p>"
                + "<p style='margin:0 0 12px;font-size:14px;color:#4b4660;'>Mã xác nhận (OTP) của bạn là:</p>"
                + "<div style='text-align:center;margin:0 0 20px;'>"
                + "<span style='display:inline-block;padding:14px 28px;background:#f6f2ff;border:1px dashed " + BRAND_ACCENT + ";"
                + "border-radius:12px;font-size:32px;font-weight:800;letter-spacing:8px;color:" + BRAND_ACCENT + ";'>"
                + otpCode + "</span></div>"
                + "<p style='margin:0 0 24px;font-size:13px;color:#8a85a0;text-align:center;'>"
                + "<i>" + expiryNote + " Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</i></p>"
                + "<hr style='border:none;border-top:1px solid #efeaf8;margin:0 0 16px;'>"
                + "<p style='margin:0;font-size:12px;line-height:1.6;color:#a59fbb;'>" + footerNote + "</p>"
                + "</div>" + footer();
    }

    private String buildAccountSetupEmail(String fullName, String email, LocalDateTime setupTime) {
        String greetingName = (fullName != null && !fullName.isBlank()) ? fullName : "bạn";
        String when = setupTime != null ? DATE_TIME_FORMAT.format(setupTime) : "vừa xong";
        String forgotPasswordUrl = frontendBaseUrl + "/forgot-password";

        return open() + header()
                + "<div style='padding:32px;color:#241f3a;'>"
                + "<div style='text-align:center;margin:0 0 16px;'>"
                + "<span style='display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;"
                + "background:#e8f8ee;color:#16a34a;font-size:30px;font-weight:800;'>&#10003;</span></div>"
                + "<h2 style='margin:0 0 12px;font-size:18px;text-align:center;'>Tài khoản đã được thiết lập thành công</h2>"
                + "<p style='margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b4660;'>Xin chào <b>" + greetingName + "</b>, "
                + "bạn đã hoàn tất thiết lập tài khoản " + BRAND_NAME + " và có thể bắt đầu sử dụng ngay.</p>"
                + "<div style='background:#faf7ff;border:1px solid #efeaf8;border-radius:12px;padding:16px 20px;margin:0 0 20px;'>"
                + "<p style='margin:0 0 8px;font-size:14px;color:#4b4660;'><b>Tài khoản:</b> " + email + "</p>"
                + "<p style='margin:0;font-size:14px;color:#4b4660;'><b>Thời gian thiết lập:</b> " + when + "</p>"
                + "</div>"
                + "<p style='margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b4660;'>"
                + "Bạn đã <b>tự đặt mật khẩu</b> cho tài khoản này. Vì lý do bảo mật, " + BRAND_NAME
                + " sẽ không lưu hay gửi mật khẩu của bạn qua email.</p>"
                + "<div style='text-align:center;margin:0 0 8px;'>"
                + "<a href='" + forgotPasswordUrl + "' style='display:inline-block;padding:12px 24px;background:" + BRAND_ACCENT + ";"
                + "color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;'>Quên mật khẩu?</a></div>"
                + "<p style='margin:0 0 24px;font-size:12px;color:#8a85a0;text-align:center;'>"
                + "Nếu lỡ quên mật khẩu, hãy dùng liên kết trên để đặt lại qua email.</p>"
                + "<hr style='border:none;border-top:1px solid #efeaf8;margin:0 0 16px;'>"
                + "<p style='margin:0;font-size:12px;line-height:1.6;color:#a59fbb;'>"
                + "Nếu bạn không thực hiện thao tác này, vui lòng liên hệ ngay quản trị viên " + BRAND_NAME + ".</p>"
                + "</div>" + footer();
    }

    private String buildDeletionWarningEmail(String fullName, LocalDateTime deletionDate, long daysRemaining) {
        String greetingName = (fullName != null && !fullName.isBlank()) ? fullName : "bạn";
        String when = deletionDate != null ? DATE_TIME_FORMAT.format(deletionDate) : "sắp tới";
        String loginUrl = frontendBaseUrl + "/login";

        return open() + header()
                + "<div style='padding:32px;color:#241f3a;'>"
                + "<div style='text-align:center;margin:0 0 16px;'>"
                + "<span style='display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;"
                + "background:#fdecef;color:#dc2626;font-size:30px;font-weight:800;'>&#9888;</span></div>"
                + "<h2 style='margin:0 0 12px;font-size:18px;text-align:center;'>Tài khoản của bạn sắp bị xóa vĩnh viễn</h2>"
                + "<p style='margin:0 0 16px;font-size:15px;line-height:1.6;color:#4b4660;'>Xin chào <b>" + greetingName + "</b>, "
                + "tài khoản " + BRAND_NAME + " của bạn đang trong tiến trình <b>xóa vĩnh viễn</b> theo yêu cầu trước đó.</p>"
                + "<div style='background:#fdf0dc;border:1px solid #f7dca6;border-radius:12px;padding:16px 20px;margin:0 0 20px;text-align:center;'>"
                + "<p style='margin:0 0 4px;font-size:13px;color:#92400e;'>Còn lại</p>"
                + "<p style='margin:0;font-size:30px;font-weight:800;color:#b45309;'>" + daysRemaining + " ngày</p>"
                + "<p style='margin:6px 0 0;font-size:13px;color:#92400e;'>Tài khoản sẽ bị xóa vào <b>" + when + "</b></p></div>"
                + "<p style='margin:0 0 8px;font-size:14px;line-height:1.6;color:#4b4660;'>"
                + "Khi bị xóa, <b>toàn bộ dữ liệu</b> của bạn (thương hiệu, nội dung, lịch đăng, kết nối mạng xã hội…) "
                + "sẽ bị xóa và <b>không thể khôi phục</b>.</p>"
                + "<p style='margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b4660;'>"
                + "Bạn có <b>chắc chắn</b> muốn xóa tài khoản không? Nếu đổi ý, hãy đăng nhập và chọn "
                + "<b>Khôi phục tài khoản</b> trước thời hạn trên.</p>"
                + "<div style='text-align:center;margin:0 0 8px;'>"
                + "<a href='" + loginUrl + "' style='display:inline-block;padding:12px 28px;background:" + BRAND_ACCENT + ";"
                + "color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;'>Giữ lại tài khoản của tôi</a></div>"
                + "<p style='margin:0 0 24px;font-size:12px;color:#8a85a0;text-align:center;'>"
                + "Nếu bạn thật sự muốn xóa, không cần làm gì — tài khoản sẽ tự động bị xóa khi hết thời hạn.</p>"
                + "<hr style='border:none;border-top:1px solid #efeaf8;margin:0 0 16px;'>"
                + "<p style='margin:0;font-size:12px;line-height:1.6;color:#a59fbb;'>"
                + "Nếu bạn không thực hiện yêu cầu xóa này, vui lòng đăng nhập để khôi phục và liên hệ quản trị viên " + BRAND_NAME + ".</p>"
                + "</div>" + footer();
    }

    private void sendHtmlEmail(String toEmail, String subject, String htmlContent) {
        brevoEmailSender.sendHtml(toEmail, subject, htmlContent);
    }
}
