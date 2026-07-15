import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { User, Phone, Cake, Lock, Eye, EyeOff, Check } from "lucide-react";
import DatePicker from "../components/DatePicker";
import { completeProfile } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { useApp } from "../context/AppContext";
import { Loader } from "../components/ui";
import PasswordStrengthBar from "../components/PasswordStrengthBar";
import { passwordValid } from "../validations/password";
import { passwordsMatch } from "../validations/authValidation";
import { withToast } from "../utils/toastFlow";
import { validateStep1 } from "../validations/profileValidation";

// ---- Design tokens (khớp với Auth.tsx để onboarding nhất quán với app) ----
const inputWrap = (error?: string): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: `1.5px solid ${error ? "#f3aabf" : "#e7e2f2"}`,
  borderRadius: 13,
  padding: "0 15px",
  background: "#fbfaff",
  transition: "border .2s",
});
const inputStyle: CSSProperties = { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, padding: "14px 0", color: "#241f3a" };
const labelStyle: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, letterSpacing: ".04em", color: "#574f6e", marginBottom: 8 };
const errStyle: CSSProperties = { minHeight: 18, fontSize: 12.5, color: "#e23d6e", marginTop: 5 };

const UserIcon = () => <User size={17} color="#a39bbf" strokeWidth={1.7} />;
const PhoneIcon = () => <Phone size={17} color="#a39bbf" strokeWidth={1.7} />;
const CakeIcon = () => <Cake size={17} color="#a39bbf" strokeWidth={1.7} />;
const LockIcon = () => <Lock size={18} color="#a39bbf" strokeWidth={1.7} />;
const EyeBtn = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", color: "#a39bbf", display: "flex" }}>
    {on ? <Eye size={19} strokeWidth={1.7} /> : <EyeOff size={19} strokeWidth={1.7} />}
  </button>
);

const STEPS = ["Thông tin cá nhân", "Thiết lập mật khẩu"];

export default function CompleteProfilePage() {
  const { t, brandGradient } = useApp();
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; dob?: string; password?: string; confirm?: string; submit?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  // Ngăn guard <Navigate> redirect ngay khi refreshUser() set profileCompleted=true,
  // cho toast đủ thời gian hiển thị trước khi chuyển trang.
  const [completed, setCompleted] = useState(false);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  // Validity realtime (để bật/tắt nút), độc lập với việc hiển thị lỗi inline.
  const step1Errs = useMemo(() => validateStep1(fullName, phone, dob), [fullName, phone, dob]);
  const step1Valid = Object.keys(step1Errs).length === 0;
  const step2Valid = passwordValid(password) && confirm.length > 0 && passwordsMatch(password, confirm);

  if (loading) {
    return <Loader fullScreen label="Đang tải..." />;
  }
  // Phải đăng nhập mới vào được; đã hoàn tất hồ sơ thì không cần trang này.
  if (!user) return <Navigate to="/login" replace />;
  if (user.profileCompleted && !completed) return <Navigate to="/dashboard" replace />;

  const focusFirst = (e: Record<string, string | undefined>) => {
    if (e.fullName) fullNameRef.current?.focus();
    else if (e.phone) phoneRef.current?.focus();
    else if (e.dob) dobRef.current?.focus();
  };

  // Cổng validation: chỉ sang Bước 2 khi toàn bộ Bước 1 hợp lệ (re-validate lúc bấm).
  const goStep2 = () => {
    const e = validateStep1(fullName, phone, dob);
    setErrors((prev) => ({ ...prev, ...e, fullName: e.fullName, phone: e.phone, dob: e.dob }));
    if (Object.keys(e).length > 0) {
      focusFirst(e);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    // Re-check cổng Bước 1 (phòng trường hợp lách) trước khi xử lý Bước 2.
    const e1 = validateStep1(fullName, phone, dob);
    if (Object.keys(e1).length > 0) {
      setErrors((p) => ({ ...p, ...e1 }));
      setStep(1);
      setTimeout(() => focusFirst(e1), 0);
      return;
    }
    const e2: Record<string, string> = {};
    if (!passwordValid(password)) e2.password = "Mật khẩu cần ≥ 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt";
    if (!passwordsMatch(password, confirm)) e2.confirm = "Mật khẩu xác nhận không khớp";
    if (Object.keys(e2).length > 0) {
      setErrors((p) => ({ ...p, ...e2 }));
      (e2.password ? pwRef : confirmRef).current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await withToast(
        completeProfile({ fullName: fullName.trim(), phone: phone.trim(), dob, password, confirmPassword: confirm }),
        {
          loading: "Đang lưu thông tin hồ sơ...",
          success: t.cpSaved,
          title: "Hoàn tất đăng ký"
        }
      );
      setCompleted(true);
      await refreshUser();
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    } catch (err) {
      const msg = (err as Error).message;
      if (/hoàn tất/i.test(msg)) {
        await refreshUser();
        navigate("/dashboard", { replace: true });
      } else if (/khớp/i.test(msg)) {
        setErrors((p) => ({ ...p, confirm: msg }));
      } else {
        setErrors((p) => ({ ...p, password: msg }));
      }
      setSubmitting(false);
    }
  };

  const btnPrimary = (enabled: boolean): CSSProperties => ({
    width: "100%", border: "none", borderRadius: 13, padding: 15, fontWeight: 700, fontSize: 15, letterSpacing: ".04em",
    color: "#fff", background: brandGradient, boxShadow: "0 16px 30px -12px rgba(139,92,246,.55)",
    cursor: enabled && !submitting ? "pointer" : "not-allowed", opacity: enabled && !submitting ? 1 : 0.5,
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.10),transparent 55%),radial-gradient(900px 700px at 90% 90%,rgba(217,70,239,.09),transparent 55%),linear-gradient(160deg,#f1f2fc,#f5f1fb 55%,#f9f1fc)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 22, boxShadow: "0 30px 60px -34px rgba(80,40,140,.45)", border: "1px solid #efeaf8", padding: "34px 34px 30px" }}>
        <img src="/aima-logo.png" alt="AIMA" style={{ height: 46, width: "auto", marginBottom: 14 }} />
        <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 25, letterSpacing: "-.01em", color: "#171327", margin: 0 }}>Hoàn tất hồ sơ</h1>
        <p style={{ fontSize: 14, color: "#6b6680", margin: "6px 0 20px" }}>Bổ sung thông tin và đặt mật khẩu để bắt đầu dùng AIMA.</p>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "flex-start", margin: "0 0 24px" }}>
          {STEPS.map((title, i) => {
            const num = (i + 1) as 1 | 2;
            const done = num < step;
            const current = num === step;
            const reachable = num === 1 || step1Valid; // không cho nhảy sang Bước 2 khi Bước 1 chưa pass
            return (
              <div key={title} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 96 }}>
                  <button
                    type="button"
                    onClick={() => { if (num === 1) setStep(1); else if (reachable) goStep2(); }}
                    disabled={!reachable && !current}
                    style={{
                      width: 38, height: 38, borderRadius: "50%", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 14, color: done || current ? "#fff" : "#a39bbf",
                      background: done ? "#16a34a" : current ? brandGradient : "#eceaf4",
                      boxShadow: current ? "0 10px 20px -8px rgba(139,92,246,.6)" : "none",
                      cursor: reachable || current ? "pointer" : "not-allowed",
                    }}
                  >
                    {done ? <Check size={18} color="#fff" strokeWidth={2.6} /> : num}
                  </button>
                  <span style={{ fontSize: 11.5, fontWeight: current ? 700 : 600, color: current ? "#3f3a55" : "#9a95ad", textAlign: "center", lineHeight: 1.3 }}>{title}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 3, borderRadius: 3, margin: "0 -6px", marginBottom: 22, background: done ? "#16a34a" : "#eceaf4" }} />
                )}
              </div>
            );
          })}
        </div>



        {step === 1 && (
          <div>
            <label style={labelStyle}>HỌ VÀ TÊN</label>
            <div style={inputWrap(errors.fullName)}>
              <UserIcon />
              <input ref={fullNameRef} value={fullName} onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: validateStep1(e.target.value, phone, dob).fullName })); }}
                onBlur={() => setErrors((p) => ({ ...p, fullName: validateStep1(fullName, phone, dob).fullName }))}
                placeholder="Nguyễn Văn A" style={inputStyle} />
            </div>
            <div style={errStyle}>{errors.fullName}</div>

            <label style={labelStyle}>SỐ ĐIỆN THOẠI</label>
            <div style={inputWrap(errors.phone)}>
              <PhoneIcon />
              <input ref={phoneRef} value={phone} onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: validateStep1(fullName, e.target.value, dob).phone })); }}
                onBlur={() => setErrors((p) => ({ ...p, phone: validateStep1(fullName, phone, dob).phone }))}
                inputMode="numeric" placeholder="0901234567" style={inputStyle} />
            </div>
            <div style={errStyle}>{errors.phone}</div>

            <label style={labelStyle}>NGÀY SINH</label>
            <DatePicker
              value={dob}
              onChange={(v) => { setDob(v); setErrors((p) => ({ ...p, dob: undefined })); }}
              max={new Date().toISOString().split("T")[0]}
              icon={<CakeIcon />}
              error={errors.dob}
            />
            <div style={errStyle}>{errors.dob}</div>

            <button type="button" onClick={goStep2} disabled={!step1Valid} style={{ ...btnPrimary(step1Valid), marginTop: 8 }}>Tiếp tục</button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>MẬT KHẨU</label>
            <div style={inputWrap(errors.password)}>
              <LockIcon />
              <input ref={pwRef} type={showPw ? "text" : "password"} value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: e.target.value ? (passwordValid(e.target.value) ? undefined : "Mật khẩu yếu") : "Vui lòng nhập mật khẩu", confirm: confirm && !passwordsMatch(e.target.value, confirm) ? "Mật khẩu xác nhận không khớp" : undefined })); }}
                onFocus={() => setPwFocused(true)} onBlur={() => setPwFocused(false)}
                placeholder="Tối thiểu 8 ký tự" style={inputStyle} />
              <EyeBtn on={showPw} onClick={() => setShowPw((v) => !v)} />
            </div>
            {/* Thanh đo độ mạnh mật khẩu — realtime */}
            <PasswordStrengthBar password={password} focused={pwFocused} onGenerate={(pw) => { setPassword(pw); setConfirm(pw); setErrors(er => ({ ...er, password: undefined, confirm: undefined })); }} />
            <div style={errStyle}>{errors.password}</div>

            <label style={labelStyle}>XÁC NHẬN MẬT KHẨU</label>
            <div style={inputWrap(errors.confirm)}>
              <LockIcon />
              <input ref={confirmRef} type={showPw2 ? "text" : "password"} value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: e.target.value ? (passwordsMatch(password, e.target.value) ? undefined : "Mật khẩu xác nhận không khớp") : "Vui lòng xác nhận mật khẩu" })); }}
                onBlur={() => setErrors((p) => ({ ...p, confirm: confirm && !passwordsMatch(password, confirm) ? "Mật khẩu xác nhận không khớp" : undefined }))}
                placeholder="Nhập lại mật khẩu" style={inputStyle} />
              <EyeBtn on={showPw2} onClick={() => setShowPw2((v) => !v)} />
            </div>
            <div style={errStyle}>{errors.confirm}</div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="button" onClick={() => { setStep(1); }}
                style={{ flex: "none", width: 120, border: "1.5px solid #e8e4f1", borderRadius: 13, padding: 15, background: "#fff", fontWeight: 600, fontSize: 14, color: "#3f3a55", cursor: "pointer" }}>
                Quay lại
              </button>
              <button type="submit" disabled={!step2Valid || submitting} style={{ ...btnPrimary(step2Valid), flex: 1 }}>
                {submitting ? "Đang lưu..." : "Lưu thông tin"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
