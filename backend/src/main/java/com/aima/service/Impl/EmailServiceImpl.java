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
    static final DateTimeFormatter SETUP_TIME_FORMAT =
            DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy");

    @Override
    public void sendForgotPasswordOtpEmail(String toEmail, String otpCode, String fullName) {
        String htmlContent = buildOtpEmail(
                fullName,
                "Bạn vừa yêu cầu <b>khôi phục mật khẩu</b> cho tài khoản " + BRAND_NAME + " của mình.",
                otpCode,
                "#2563eb",
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
                "#7c3aed",
                "MMã có hiệu lực trong 1 phút 30 giây.",
                "Nếu bạn không thực hiện thao tác này, vui lòng đổi mật khẩu ngay hoặc liên hệ quản trị viên " + BRAND_NAME + "."
        );

        sendHtmlEmail(toEmail, "Mã OTP đổi mật khẩu - " + BRAND_NAME, htmlContent);
    }

    @Override
    public void sendAccountSetupSuccessEmail(String toEmail, String fullName, LocalDateTime setupTime) {
        String htmlContent = buildAccountSetupEmail(fullName, toEmail, setupTime);
        sendHtmlEmail(toEmail, "Thiết lập tài khoản thành công - " + BRAND_NAME, htmlContent);
    }

    private String buildAccountSetupEmail(String fullName, String email, LocalDateTime setupTime) {
        String greetingName = (fullName != null && !fullName.isBlank()) ? fullName : "bạn";
        String accentColor = "#2563eb";
        String when = setupTime != null ? SETUP_TIME_FORMAT.format(setupTime) : "vừa xong";
        String forgotPasswordUrl = frontendBaseUrl + "/forgot-password";

        return "<div style='margin:0;padding:24px;background-color:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;'>"
                + "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;"
                + "box-shadow:0 8px 24px rgba(15,23,42,0.08);'>"
                + "<div style='background:" + accentColor + ";padding:28px 32px;'>"
                + "<h1 style='margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.5px;'>"
                + BRAND_NAME + "</h1>"
                + "<p style='margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;'>"
                + "Trợ lý Marketing AI đa nền tảng</p>"
                + "</div>"
                + "<div style='padding:32px;color:#0f172a;'>"
                + "<div style='text-align:center;margin:0 0 16px;'>"
                + "<span style='display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;"
                + "background:#dcfce7;color:#16a34a;font-size:30px;font-weight:800;'>&#10003;</span></div>"
                + "<h2 style='margin:0 0 12px;font-size:18px;text-align:center;'>Tài khoản đã được thiết lập thành công</h2>"
                + "<p style='margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;'>Xin chào <b>" + greetingName + "</b>, "
                + "bạn đã hoàn tất thiết lập tài khoản " + BRAND_NAME + " và có thể bắt đầu sử dụng ngay.</p>"
                + "<div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:0 0 20px;'>"
                + "<p style='margin:0 0 8px;font-size:14px;color:#334155;'><b>Tài khoản:</b> " + email + "</p>"
                + "<p style='margin:0;font-size:14px;color:#334155;'><b>Thời gian thiết lập:</b> " + when + "</p>"
                + "</div>"
                + "<p style='margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;'>"
                + "Bạn đã <b>tự đặt mật khẩu</b> cho tài khoản này. Vì lý do bảo mật, " + BRAND_NAME
                + " hệ thống sẽ không lưu hay gửi mật khẩu của bạn qua email.</p>"
                + "<div style='text-align:center;margin:0 0 8px;'>"
                + "<a href='" + forgotPasswordUrl + "' style='display:inline-block;padding:12px 24px;background:" + accentColor + ";"
                + "color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;'>Quên mật khẩu?</a></div>"
                + "<p style='margin:0 0 24px;font-size:12px;color:#64748b;text-align:center;'>"
                + "Nếu lỡ quên mật khẩu, hãy dùng liên kết trên để đặt lại qua email.</p>"
                + "<hr style='border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;'>"
                + "<p style='margin:0;font-size:12px;line-height:1.6;color:#94a3b8;'>"
                + "Nếu bạn không thực hiện thao tác này, vui lòng liên hệ ngay quản trị viên " + BRAND_NAME + ".</p>"
                + "</div>"
                + "<div style='padding:16px 32px;background:#f8fafc;text-align:center;'>"
                + "<p style='margin:0;font-size:12px;color:#94a3b8;'>© " + BRAND_NAME
                + " — Email tự động, vui lòng không trả lời.</p>"
                + "</div>"
                + "</div></div>";
    }

    private String buildOtpEmail(String fullName, String intro, String otpCode,
                                 String accentColor, String expiryNote, String footerNote) {
        String greetingName = (fullName != null && !fullName.isBlank()) ? fullName : "bạn";
        return "<div style='margin:0;padding:24px;background-color:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;'>"
                + "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;"
                + "box-shadow:0 8px 24px rgba(15,23,42,0.08);'>"
                + "<div style='background:" + accentColor + ";padding:28px 32px;'>"
                + "<h1 style='margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.5px;'>"
                + BRAND_NAME + "</h1>"
                + "<p style='margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;'>"
                + "Nền tảng thiết kế &amp; hỗ trợ vẽ UML Diagram</p>"
                + "</div>"
                + "<div style='padding:32px;color:#0f172a;'>"
                + "<h2 style='margin:0 0 12px;font-size:18px;'>Xin chào " + greetingName + ",</h2>"
                + "<p style='margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;'>" + intro + "</p>"
                + "<p style='margin:0 0 12px;font-size:14px;color:#334155;'>Mã xác nhận (OTP) của bạn là:</p>"
                + "<div style='text-align:center;margin:0 0 20px;'>"
                + "<span style='display:inline-block;padding:14px 28px;background:#f8fafc;border:1px dashed " + accentColor + ";"
                + "border-radius:12px;font-size:32px;font-weight:800;letter-spacing:8px;color:" + accentColor + ";'>"
                + otpCode + "</span></div>"
                + "<p style='margin:0 0 24px;font-size:13px;color:#64748b;text-align:center;'>"
                + "<i>" + expiryNote + " Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</i></p>"
                + "<hr style='border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;'>"
                + "<p style='margin:0;font-size:12px;line-height:1.6;color:#94a3b8;'>" + footerNote + "</p>"
                + "</div>"
                + "<div style='padding:16px 32px;background:#f8fafc;text-align:center;'>"
                + "<p style='margin:0;font-size:12px;color:#94a3b8;'>© " + BRAND_NAME
                + " — Email tự động, vui lòng không trả lời.</p>"
                + "</div>"
                + "</div></div>";
    }

    private void sendHtmlEmail(String toEmail, String subject, String htmlContent) {
        brevoEmailSender.sendHtml(toEmail, subject, htmlContent);
    }
}