import ColorModeToggle from '../components/ColorModeToggle';
import { DARK_MODE_ENABLED } from '../store/colorMode';
import { useIsDark } from '../hooks/useIsDark';
import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, KeyRound, Eye, ChevronLeft, Globe } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import AimaScene from "../components/AimaScene";
import { forgotPassword, resetPassword, verifyOtp } from "../api/auth";
import type { ApiError } from "../api/apiClient";
import PasswordStrengthBar from "../components/PasswordStrengthBar";
import { passwordValid } from "../validations/password";
import { validEmail, otpValid, passwordsMatch } from "../validations/authValidation";
import { C } from "../styles/colors";

type Step = "email" | "otp" | "reset";

// Khớp otp.ttl-seconds mặc định ở backend (90s).
const OTP_TTL = 90;
// ErrorCode backend cần xử lý riêng ở bước OTP: OTP đã bị đốt → buộc gửi lại mã.
const OTP_NOT_FOUND = 1060; // hết hạn hoặc không tồn tại
const OTP_ATTEMPTS_EXCEEDED = 1072; // sai quá số lần cho phép

// Style đồng bộ với trang Auth.tsx.
const inputWrap = (error?: string): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: `1.5px solid ${error ? C.inputErrorBorder : C.border}`,
  borderRadius: 13,
  padding: "0 15px",
  background: C.surfaceSubtle,
  transition: "border .2s",
});
const inputStyle: CSSProperties = { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, padding: "14px 0", color: C.textStrong };
const labelStyle: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, letterSpacing: ".04em", color: C.ink600, marginBottom: 8 };
const errStyle: CSSProperties = { minHeight: 18, fontSize: 12.5, color: C.rose, marginTop: 5 };

const MailIcon = () => <Mail size={18} color={C.ink350} strokeWidth={1.7} />;
const LockIcon = () => <Lock size={18} color={C.ink350} strokeWidth={1.7} />;
const KeyIcon = () => <KeyRound size={18} color={C.ink350} strokeWidth={1.7} />;
const EyeBtn = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink350, display: 'flex', position: 'relative' }}>
    <Eye size={19} strokeWidth={1.7} />
    <svg width="19" height="19" viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <line x1="3" y1="3" x2="21" y2="21" stroke={C.surfaceSubtle} strokeWidth="4" strokeLinecap="round" style={{ strokeDasharray: 26, strokeDashoffset: on ? 26 : 0, transition: 'stroke-dashoffset 0.2s ease-out' }} />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ strokeDasharray: 26, strokeDashoffset: on ? 26 : 0, transition: 'stroke-dashoffset 0.2s ease-out' }} />
    </svg>
  </button>
);

export default function ForgotPasswordPage() {
  const isDark = useIsDark();
  const { t, lang, brandGradient, toggleLang } = useApp();
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; otp?: string; password?: string; confirm?: string }>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Đếm ngược hiệu lực OTP.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const sendOtp = async () => {
    setFieldErrors({});
    setMessage("");
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setStep("otp");
      setOtpCode("");
      setSecondsLeft(OTP_TTL);
      setMessage(t.fpOtpSent);
    } catch (err) {
      setFieldErrors({ email: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmail = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return setFieldErrors({ email: t.errEmailReq });
    if (!validEmail(email)) return setFieldErrors({ email: t.errEmailBad });
    sendOtp();
  };

  const handleOtp = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (!otpCode) return setFieldErrors({ otp: t.errOtpReq });
    if (!otpValid(otpCode)) return setFieldErrors({ otp: t.errOtpBad });
    setSubmitting(true);
    try {
      await verifyOtp(email, otpCode);
      setStep("reset");
    } catch (err) {
      const code = (err as ApiError).code;
      if (code === OTP_ATTEMPTS_EXCEEDED || code === OTP_NOT_FOUND) {
        setSecondsLeft(0);
        setOtpCode("");
      }
      setFieldErrors({ otp: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    const er: { password?: string; confirm?: string } = {};
    if (!newPassword) er.password = t.errPwReq;
    else if (!passwordValid(newPassword)) er.password = t.errPwWeak;
    if (!passwordsMatch(newPassword, confirmPassword)) er.confirm = t.errConfirmBad;
    setFieldErrors(er);
    if (Object.keys(er).length > 0) return;
    
    setSubmitting(true);
    try {
      await resetPassword({ email, otpCode, newPassword, confirmPassword });
      navigate("/login", { replace: true, state: { notice: t.fpSuccess } });
    } catch (err) {
      const code = (err as ApiError).code;
      if (code === OTP_NOT_FOUND) {
        setStep("otp");
        setSecondsLeft(0);
        setOtpCode("");
      }
      setFieldErrors({ password: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const sub = step === "email" ? t.fpSubEmail : step === "otp" ? t.fpSubOtp : t.fpSubReset;
  const btnPrimary: CSSProperties = { width: "100%", border: "none", borderRadius: 13, padding: 16, fontWeight: 700, fontSize: 15, letterSpacing: ".05em", color: C.onBrand, background: brandGradient, boxShadow: `0 16px 30px -12px ${C.legacyShadowrgba13992246_6_}`, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.75 : 1 };

  const steps: { key: Step; label: string }[] = [
    { key: "email", label: t.fpStepEmail },
    { key: "otp", label: t.fpStepOtp },
    { key: "reset", label: t.fpStepReset },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="view-pop" style={{ minHeight: "100vh", display: "flex", flexDirection: isMobile ? "column" : "row", background: C.surface }}>
      {/* Illustration panel — hidden on mobile */}
      {!isMobile && (
        <div style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden", background: `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent 55%),radial-gradient(900px 700px at 90% 90%,rgba(217,70,239,.11),transparent 55%),linear-gradient(160deg,${C.bg},${C.surfaceMuted} 55%,${C.surfaceMuted})`, padding: "48px 54px", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "fixed", top: 16, right: 18, zIndex: 101 }}><ColorModeToggle /></div>
          <img src={isDark ? "/aima-h-dark.png" : "/aima-logo.png"} alt="AIMA" style={{ height: 74, width: "auto", alignSelf: "flex-start" }} />
          <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 44, letterSpacing: "-.02em", color: C.ink900, margin: "8px 0 0" }}>AI - Marketing Assistant</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: C.ink550, maxWidth: 430, margin: "16px 0 0" }}>{t.authIntro}</p>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", margin: "6px 0" }}>
            <div style={{ width: 460, height: 420, maxWidth: "100%" }}>
              <AimaScene />
            </div>
          </div>
        </div>
      )}

      {/* Form panel */}
      <div style={{ width: isMobile ? "100%" : "min(48%,640px)", background: C.surface, padding: isMobile ? "64px 20px 30px" : "56px 64px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: isMobile ? 18 : 32, left: isMobile ? 18 : 48 }}>
          <button onClick={() => navigate("/login")} style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", fontSize: 15, fontWeight: 600, color: C.ink650, cursor: "pointer" }}>
            <ChevronLeft size={19} color={C.textSecondary} strokeWidth={1.8} />
            {t.fpBackLogin}
          </button>
        </div>
        <div style={{ position: "absolute", top: isMobile ? 18 : 32, right: isMobile ? 18 : DARK_MODE_ENABLED ? 84 : 48 }}>
          <button onClick={toggleLang} style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", fontSize: 15, fontWeight: 600, color: C.ink650, cursor: "pointer" }}>
            <Globe size={18} color={C.textSecondary} strokeWidth={1.7} />
            {t.langLabel}
          </button>
        </div>

        <div style={{ maxWidth: 400, width: "100%", margin: "0 auto", padding: isMobile ? 0 : "8px 0" }}>
          <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: lang === "vi" ? (isMobile ? 26 : 34) : (isMobile ? 30 : 40), margin: 0, letterSpacing: "-.02em" }}>{t.fpTitle}</h2>
          <p style={{ fontSize: 15, color: C.textSecondary, margin: "8px 0 24px" }}>{sub}</p>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 26 }}>
            {steps.map((s, i) => (
              <div key={s.key} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, flex: "none", color: i <= activeIdx ? C.onBrand : C.ink350, background: i <= activeIdx ? brandGradient : C.surfaceMuted }}>
                    {i < activeIdx ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: i <= activeIdx ? C.text : C.ink350, whiteSpace: "nowrap" }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 2, borderRadius: 2, background: i < activeIdx ? brandGradient : C.surfaceMuted }} />}
              </div>
            ))}
          </div>

          {message && <div style={{ fontSize: 13, color: C.success, background: C.successSoft, border: `1px solid ${C.legacyBordercdeed8}`, borderRadius: 10, padding: "10px 13px", marginBottom: 16 }}>{message}</div>}

          {step === "email" && (
            <form onSubmit={handleEmail}>
              <label style={labelStyle}>EMAIL</label>
              <div style={inputWrap(fieldErrors.email)}>
                <MailIcon />
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: !e.target.value ? t.errEmailReq : !validEmail(e.target.value) ? t.errEmailBad : undefined })); }} placeholder={t.phEmail} style={inputStyle} />
              </div>
              <div style={errStyle}>{fieldErrors.email}</div>
              <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? t.processing : t.fpSendOtp}</button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleOtp}>
              <label style={labelStyle}>{t.fpOtpLabel}</label>
              <div style={inputWrap(fieldErrors.otp)}>
                <KeyIcon />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setOtpCode(v); setFieldErrors(p => ({ ...p, otp: v.length !== 6 ? t.errOtpBad : undefined })); }}
                  placeholder="••••••"
                  style={{ ...inputStyle, letterSpacing: ".5em", fontWeight: 700 }}
                />
              </div>
              <div style={{ ...errStyle, color: secondsLeft > 0 && !fieldErrors.otp ? C.textMuted : C.rose }}>
                {fieldErrors.otp || (secondsLeft > 0 ? `${t.fpExpiresIn} ${secondsLeft}s` : t.fpExpired)}
              </div>
              <button type="submit" disabled={submitting || secondsLeft <= 0} style={{ ...btnPrimary, opacity: submitting || secondsLeft <= 0 ? 0.6 : 1, cursor: secondsLeft <= 0 ? "not-allowed" : btnPrimary.cursor }}>
                {submitting ? t.processing : t.fpVerify}
              </button>
              <button type="button" onClick={sendOtp} disabled={submitting || secondsLeft > 0} style={{ width: "100%", marginTop: 12, border: `1.5px solid ${C.border}`, borderRadius: 13, padding: 14, background: C.surface, fontWeight: 600, fontSize: 14, color: secondsLeft > 0 ? C.ink350 : C.violetLight, cursor: secondsLeft > 0 ? "not-allowed" : "pointer" }}>
                {secondsLeft > 0 ? `${t.fpResendIn} ${secondsLeft}s` : t.fpResend}
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleReset}>
              <label style={labelStyle}>{t.fpNewPw}</label>
              <div style={inputWrap(fieldErrors.password)}>
                <LockIcon />
                <input type={showPw ? "text" : "password"} value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setFieldErrors(p => ({ ...p, password: !passwordValid(e.target.value) ? t.errPwWeak : undefined })); }} onFocus={() => setPwFocused(true)} onBlur={() => setPwFocused(false)} placeholder={t.phPassword} style={inputStyle} />
                <EyeBtn on={showPw} onClick={() => setShowPw((v) => !v)} />
              </div>
              <PasswordStrengthBar password={newPassword} focused={pwFocused} onGenerate={(pw) => { setNewPassword(pw); setConfirmPassword(pw); setFieldErrors(er => ({ ...er, password: undefined, confirm: undefined })); }} />
              <div style={errStyle}>{fieldErrors.password}</div>

              <label style={labelStyle}>{t.fpConfirmPw}</label>
              <div style={inputWrap(fieldErrors.confirm)}>
                <LockIcon />
                <input type={showPw2 ? "text" : "password"} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirm: !passwordsMatch(newPassword, e.target.value) ? t.errConfirmBad : undefined })); }} placeholder={t.phConfirm} style={inputStyle} />
                <EyeBtn on={showPw2} onClick={() => setShowPw2((v) => !v)} />
              </div>
              <div style={errStyle}>{fieldErrors.confirm}</div>
              <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? t.processing : t.fpResetBtn}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
