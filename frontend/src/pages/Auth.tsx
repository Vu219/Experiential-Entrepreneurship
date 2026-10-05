import ColorModeToggle from '../components/ColorModeToggle';
import { useIsDark } from '../hooks/useIsDark';
import { useEffect, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mail, Lock, User as UserGlyph, Eye, ChevronLeft, Globe, LogOut, Home,
  Sparkles, Clock, BarChart3, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../auth/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { GradIcon } from '../components/ui';
import AimaScene from '../components/AimaScene';
import {
  register as apiRegister, resendRegisterOtp, verifyRegister, startGoogleAuth, consumeGoogleLinkedFromRegister,
  type User,
} from '../api/auth';
import type { ApiError } from '../api/apiClient';
import PasswordStrengthBar from '../components/PasswordStrengthBar';
import { passwordValid, generateStrongPassword } from '../validations/password';
import { validEmail, passwordsMatch, otpValid } from '../validations/authValidation';
import { useToast } from '../components/toast/ToastProvider';
import type { AuthForm, AuthErrors } from '../types';
import { C } from '../styles/colors';
import { DARK_MODE_ENABLED } from '../store/colorMode';

const inputWrap = (error?: string): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: `1.5px solid ${error ? C.inputErrorBorder : C.border}`,
  borderRadius: 13,
  padding: '0 15px',
  background: C.surfaceSubtle,
  transition: 'border .2s',
});
const inputStyle: CSSProperties = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, padding: '14px 0', color: C.textStrong };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', color: C.ink600, marginBottom: 8 };
const errStyle: CSSProperties = { minHeight: 18, fontSize: 12.5, color: C.rose, marginTop: 5 };
const noticeStyle: CSSProperties = { fontSize: 13, color: C.success, background: C.successSoft, border: `1px solid ${C.legacyBordercdeed8}`, borderRadius: 10, padding: '10px 13px', marginBottom: 16 };
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, color: C.violetLight, fontWeight: 700, fontSize: 14, cursor: 'pointer' };

// ErrorCode backend ở bước OTP đăng ký.
const EMAIL_EXISTED = 1003;
const OTP_NOT_FOUND = 1060;          // hết hạn / đã dùng
const OTP_ATTEMPTS_EXCEEDED = 1072;  // sai 5 lần → mã bị huỷ
const OTP_RESEND_TOO_SOON = 1079;    // chưa hết 60s chờ gửi lại
const REGISTRATION_SESSION_EXPIRED = 1080;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const MailIcon = () => <Mail size={18} color={C.ink350} strokeWidth={1.7} />;
const LockIcon = () => <Lock size={18} color={C.ink350} strokeWidth={1.7} />;
const UserIcon = () => <UserGlyph size={17} color={C.ink350} strokeWidth={1.7} />;
const EyeBtn = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button type="button" aria-label={on ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink350, display: 'flex', position: 'relative' }}>
    <Eye size={19} strokeWidth={1.7} aria-hidden="true" />
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <line x1="3" y1="3" x2="21" y2="21" stroke={C.surfaceSubtle} strokeWidth="4" strokeLinecap="round" style={{ strokeDasharray: 26, strokeDashoffset: on ? 26 : 0, transition: 'stroke-dashoffset 0.2s ease-out' }} />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ strokeDasharray: 26, strokeDashoffset: on ? 26 : 0, transition: 'stroke-dashoffset 0.2s ease-out' }} />
    </svg>
  </button>
);

export default function Auth() {
  const isDark = useIsDark();
  const { t, lang, route, go, brandGradient, toggleLang } = useApp();
  const { login: authLogin, refreshUser } = useAuth();
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const [f, setF] = useState<AuthForm>({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [remember, setRemember] = useState(false);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [notice, setNotice] = useState<string>((location.state as { notice?: string } | null)?.notice ?? '');
  const toast = useToast();
  // Đăng ký 2 bước: form → nhập OTP (tài khoản chỉ được tạo khi OTP đúng).
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLeft, setOtpLeft] = useState(0);
  const [resendLeft, setResendLeft] = useState(0);
  const [resending, setResending] = useState(false);

  // Đếm ngược hiệu lực mã + thời gian chờ gửi lại (1 nhịp/giây cho cả hai).
  useEffect(() => {
    if (otpLeft <= 0 && resendLeft <= 0) return;
    const id = setTimeout(() => {
      setOtpLeft((s) => Math.max(0, s - 1));
      setResendLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [otpLeft, resendLeft]);

  const switchRoute = (r: 'login' | 'register') => {
    setErrors({});
    setNotice('');
    setRegStep('form');
    setF(s => ({ ...s, password: '', confirm: '' }));
    go(r);
  };

  // Chuyển lỗi OAuth thô (vd "[access_denied]" khi người dùng huỷ) thành thông báo thân thiện.
  const oauthErrorMessage = (raw: string) => {
    if (/access_denied/i.test(raw)) return t.errGoogleCancelled;
    if (/khoá|khóa/i.test(raw)) return raw; // Lỗi từ backend (tiếng Việt)
    if (/locked/i.test(raw)) return lang === 'vi' ? 'Tài khoản của bạn đã bị khóa.' : 'Your account has been locked.';
    return t.errGoogleFailed;
  };

  // Handle Google OAuth redirect coming back to /login (?login=success | ?error=... | state.oauthError).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const stateError = (location.state as { oauthError?: string } | null)?.oauthError;
    if (params.get('login') === 'success') {
      if (consumeGoogleLinkedFromRegister(params)) toast.success(t.googleLinkedMsg, { title: t.googleLinkedTitle });
      setSubmitting(true);
      refreshUser().then((me) => {
        if (me) navigate(me.profileCompleted ? '/dashboard' : '/complete-profile', { replace: true });
      }).finally(() => {
        setSubmitting(false);
      });
    } else if (params.get('error') || stateError) {
      const raw = (params.get('error') ?? stateError) as string;
      setNotice(oauthErrorMessage(raw));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onField = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setF((s) => ({ ...s, [name]: value }));
    if (route === 'login') {
      if (name === 'email') setErrors((er) => ({ ...er, email: !value ? t.errEmailReq : !validEmail(value) ? t.errEmailBad : undefined }));
      else if (name === 'password') setErrors((er) => ({ ...er, password: !value ? t.errPwReq : undefined }));
    } else {
      if (name === 'name') setErrors((er) => ({ ...er, name: !value ? t.errNameReq : undefined }));
      else if (name === 'email') setErrors((er) => ({ ...er, email: !value ? t.errEmailReq : !validEmail(value) ? t.errEmailBad : undefined }));
      else if (name === 'password') setErrors((er) => ({ ...er, password: !value ? t.errPwReq : !passwordValid(value) ? t.errPwWeak : undefined, confirm: f.confirm && !passwordsMatch(value, f.confirm) ? t.errConfirmBad : undefined }));
      else if (name === 'confirm') setErrors((er) => ({ ...er, confirm: !value ? t.errConfirmReq : !passwordsMatch(f.password, value) ? t.errConfirmBad : undefined }));
    }
  };

  const afterAuth = (me: User) => navigate(me.profileCompleted ? '/dashboard' : '/complete-profile', { replace: true });

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: AuthErrors = {};
    if (!f.email) er.email = t.errEmailReq;
    else if (!validEmail(f.email)) er.email = t.errEmailBad;
    if (!f.password) er.password = t.errPwReq;
    setErrors(er);
    if (Object.keys(er).length > 0) return;
    setSubmitting(true);
    setNotice('');
    
    let loadingId: number | undefined;
    const loadingTimer = setTimeout(() => {
      loadingId = toast.loading('Vui lòng chờ trong giây lát.', { title: 'Đang đăng nhập...' });
    }, 1000);

    try {
      const me = await authLogin(f.email, f.password);
      clearTimeout(loadingTimer);
      toast.success('Chào mừng bạn quay trở lại.', { id: loadingId, title: 'Đăng nhập thành công' });
      afterAuth(me);
    } catch (err) {
      clearTimeout(loadingTimer);
      const msg = (err as Error).message;
      let title = 'Đăng nhập thất bại';
      let desc = 'Email hoặc mật khẩu không chính xác.';
      
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('server') || msg.toLowerCase().includes('fetch')) {
        title = 'Không thể đăng nhập';
        desc = 'Máy chủ hiện không phản hồi.';
      } else if (msg && !/401|invalid|incorrect|sai/i.test(msg)) {
        desc = msg;
      }
      
      toast.error(desc, { id: loadingId, title });
      setErrors({ submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: AuthErrors = {};
    if (!f.name) er.name = t.errNameReq;
    if (!f.email) er.email = t.errEmailReq;
    else if (!validEmail(f.email)) er.email = t.errEmailBad;
    if (!f.password) er.password = t.errPwReq;
    else if (!passwordValid(f.password)) er.password = t.errPwWeak;
    if (!f.confirm) er.confirm = t.errConfirmReq;
    else if (!passwordsMatch(f.password, f.confirm)) er.confirm = t.errConfirmBad;
    if (!agree) er.agree = t.errAgree;
    setErrors(er);
    if (Object.keys(er).length > 0) return;
    setSubmitting(true);
    setNotice('');
    try {
      const sent = await apiRegister({ fullName: f.name.trim(), email: f.email.trim(), password: f.password });
      openOtpStep(sent.expiresInSeconds, sent.resendAfterSeconds, t.regOtpSent);
    } catch (err) {
      const { code, message } = err as ApiError;
      if (code === EMAIL_EXISTED) setErrors({ email: 'taken' });
      // Mã của lần bấm trước vẫn còn hiệu lực → vào thẳng bước nhập mã thay vì báo lỗi.
      else if (code === OTP_RESEND_TOO_SOON) openOtpStep(0, 60, t.regOtpAlreadySent);
      else toast.error(message, { title: 'Đăng ký thất bại' });
    } finally {
      setSubmitting(false);
    }
  };

  const openOtpStep = (expiresIn: number, resendIn: number, msg: string) => {
    setRegStep('otp');
    setOtpCode('');
    setOtpError('');
    setOtpLeft(expiresIn);
    setResendLeft(resendIn);
    setNotice(msg);
  };

  const backToRegisterForm = (msg = '') => {
    setRegStep('form');
    setOtpCode('');
    setOtpError('');
    setOtpLeft(0);
    setNotice(msg);
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return setOtpError(t.errOtpReq);
    if (!otpValid(otpCode)) return setOtpError(t.errOtpBad);
    setSubmitting(true);
    setOtpError('');
    try {
      await verifyRegister(f.email.trim(), otpCode);
      const me = await refreshUser();
      toast.success(t.regSuccessMsg, { title: t.regSuccessTitle });
      if (me) afterAuth(me);
    } catch (err) {
      const { code, message } = err as ApiError;
      if (code === OTP_ATTEMPTS_EXCEEDED || code === OTP_NOT_FOUND) {
        // Mã đã bị huỷ/hết hạn → buộc gửi mã mới.
        setOtpCode('');
        setOtpLeft(0);
        setOtpError(code === OTP_ATTEMPTS_EXCEEDED ? t.regOtpBurned : t.regOtpExpired);
      } else if (code === REGISTRATION_SESSION_EXPIRED) {
        backToRegisterForm(t.regSessionExpired);
      } else if (code === EMAIL_EXISTED) {
        backToRegisterForm();
        setErrors({ email: 'taken' });
      } else {
        setOtpError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (resendLeft > 0 || resending) return;
    setResending(true);
    setOtpError('');
    try {
      const sent = await resendRegisterOtp(f.email.trim());
      setOtpCode('');
      setOtpLeft(sent.expiresInSeconds);
      setResendLeft(sent.resendAfterSeconds);
      setNotice(t.regOtpResent);
    } catch (err) {
      const { code, message } = err as ApiError;
      if (code === REGISTRATION_SESSION_EXPIRED) backToRegisterForm(t.regSessionExpired);
      else if (code === OTP_RESEND_TOO_SOON) setResendLeft((s) => Math.max(s, 60));
      else setOtpError(message);
    } finally {
      setResending(false);
    }
  };

  const btnPrimary: CSSProperties = { width: '100%', border: 'none', borderRadius: 13, padding: 16, fontWeight: 700, fontSize: 15, letterSpacing: '.05em', color: C.onBrand, background: brandGradient, boxShadow: `0 16px 30px -12px ${C.legacyShadowrgba13992246_6_}`, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.75 : 1 };

  return (
    <>

      <div className="view-pop" style={{ minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: C.surface }}>
        {/* Illustration panel — hidden on mobile */}
        {!isMobile && (
          <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent 55%),radial-gradient(900px 700px at 90% 90%,rgba(217,70,239,.11),transparent 55%),linear-gradient(160deg,${C.bg},${C.surfaceMuted} 55%,${C.surfaceMuted})`, padding: '48px 54px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: "fixed", top: 16, right: 18, zIndex: 101 }}><ColorModeToggle /></div>
          <img src={isDark ? "/aima-h-dark.png" : "/aima-logo.png"} alt="AIMA" style={{ height: 74, width: 'auto', alignSelf: 'flex-start' }} />
            <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 44, letterSpacing: '-.02em', color: C.ink900, margin: '8px 0 0' }}>AI - Marketing Assistant</h1>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: C.ink550, maxWidth: 430, margin: '16px 0 0' }}>{t.authIntro}</p>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0' }}>
              <div style={{ width: 460, height: 420, maxWidth: '100%' }}>
                <AimaScene />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 38 }}>
              {pillarsFor(lang).map((p, i) => (
                <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ width: 42, height: 42, margin: '0 auto 10px', borderRadius: 12, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 22px -14px ${C.legacyShadowrgba12060180_6_}` }}>
                    <GradIcon icon={p.icon} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.textStrong }}>{p.title}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: C.textSecondary, marginTop: 3 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form panel */}
        <div style={{ width: isMobile ? '100%' : 'min(48%,640px)', background: C.surface, padding: isMobile ? '64px 20px 30px' : '56px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: isMobile ? 18 : 32, left: isMobile ? 18 : 48 }}>
            <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', fontSize: 15, fontWeight: 600, color: C.ink650, cursor: 'pointer' }}>
              <ChevronLeft size={19} color={C.textSecondary} strokeWidth={1.8} />
              {t.backToHome}
            </button>
          </div>
          <div style={{ position: 'absolute', top: isMobile ? 18 : 32, right: isMobile ? 18 : DARK_MODE_ENABLED ? 84 : 48 }}>
            <button onClick={toggleLang} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', fontSize: 15, fontWeight: 600, color: C.ink650, cursor: 'pointer' }}>
              <Globe size={18} color={C.textSecondary} strokeWidth={1.7} />
              {t.langLabel}
            </button>
          </div>

          {route === 'login' && (
            <div style={{ maxWidth: 400, width: '100%', margin: '0 auto', padding: isMobile ? 0 : '8px 0' }}>
              <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: lang === 'vi' ? (isMobile ? 25 : 32) : (isMobile ? 30 : 40), margin: 0, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{t.loginTitle}</h2>
              <p style={{ fontSize: 15, color: C.textSecondary, margin: '8px 0 30px' }}>{t.loginSub}</p>
              {notice && <div style={noticeStyle}>{notice}</div>}
              <form onSubmit={submitLogin}>
                <label style={labelStyle}>EMAIL</label>
                <div style={inputWrap(errors.email)}>
                  <MailIcon />
                  <input autoFocus name="email" value={f.email} onChange={onField} type="email" placeholder={t.phEmail} style={inputStyle} />
                </div>
                <div style={errStyle}>{errors.email}</div>

                <label style={{ ...labelStyle, margin: '8px 0' }}>{t.lPassword}</label>
                <div style={inputWrap(errors.password)}>
                  <LockIcon />
                  <input name="password" value={f.password} onChange={onField} type={showPw ? 'text' : 'password'} placeholder={t.phPassword} style={inputStyle} />
                  <EyeBtn on={showPw} onClick={() => setShowPw((v) => !v)} />
                </div>
                <div style={errStyle}>{errors.password}</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: C.ink600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={remember} onChange={() => setRemember((v) => !v)} style={{ width: 16, height: 16, accentColor: '#8b5cf6' }} />
                    {t.remember}
                  </label>
                  <span onClick={() => navigate('/forgot-password')} style={{ fontSize: 13.5, color: C.violetLight, fontWeight: 600, cursor: 'pointer' }}>{t.forgot}</span>
                </div>
                {errors.submit && <div style={{ fontSize: 13, color: C.rose, textAlign: 'center', marginBottom: 16 }}>{errors.submit}</div>}
                <button type="submit" disabled={submitting} style={btnPrimary}>
                  {submitting ? (
                    <div className="dots-container">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  ) : t.signIn}
                </button>
              </form>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '36px 0 24px' }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ fontSize: 13, color: C.textMuted }}>{t.orSignIn}</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              <SocialBtn onClick={() => startGoogleAuth('login')} label={t.googleSignIn} icon={<GoogleIcon />} />
              <div style={{ textAlign: 'center', fontSize: 14, color: C.textSecondary, marginTop: 26 }}>
                {t.noAccount} <span onClick={() => switchRoute('register')} style={{ color: C.violetLight, fontWeight: 700, cursor: 'pointer' }}>{t.signUpNow}</span>
              </div>
              <LegalLinks t={t} />
            </div>
          )}

          {route === 'register' && regStep === 'form' && (
            <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
              <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 34, margin: 0, letterSpacing: '-.01em' }}>{t.regTitle}</h2>
              <p style={{ fontSize: 14.5, color: C.textSecondary, margin: '8px 0 22px' }}>{t.regSub}</p>
              {notice && <div style={noticeStyle}>{notice}</div>}
              <form onSubmit={submitRegister} noValidate>
                <label style={labelStyle}>{t.lName}</label>
                <div style={inputWrap(errors.name)}>
                  <UserIcon />
                  <input name="name" value={f.name} onChange={onField} placeholder={t.phName} style={inputStyle} />
                </div>
                <div style={errStyle}>{errors.name}</div>

                <label htmlFor="reg-email" style={labelStyle}>EMAIL <span aria-hidden="true" style={{ color: C.rose }}>*</span></label>
                <div style={inputWrap(errors.email)}>
                  <MailIcon />
                  <input id="reg-email" autoFocus name="email" value={f.email} onChange={onField} type="email" aria-required="true" aria-invalid={!!errors.email} placeholder={t.phEmail} style={inputStyle} />
                </div>
                <div style={errStyle}>
                  {errors.email === 'taken' ? (
                    <span style={{ color: C.rose }}>
                      {t.regEmailTaken} —{' '}
                      <span onClick={() => switchRoute('login')} style={{ color: C.violetLight, textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>
                        {t.regWantLogin}
                      </span>
                    </span>
                  ) : errors.email}
                </div>

                <label style={labelStyle}>{t.lPassword}</label>
                <div style={inputWrap(errors.password)}>
                  <LockIcon />
                  <input name="password" value={f.password} onChange={onField} onFocus={() => setPwFocused(true)} onBlur={() => setPwFocused(false)} type={showPw ? 'text' : 'password'} placeholder={t.phPassword} style={inputStyle} />
                  {f.password && (
                    <button type="button" aria-label="Tạo mật khẩu ngẫu nhiên" onClick={() => { const pw = generateStrongPassword(); setF(s => ({ ...s, password: pw, confirm: pw })); setErrors(er => ({ ...er, password: undefined, confirm: undefined })); }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', color: C.ink350 }}>
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </button>
                  )}
                  <EyeBtn on={showPw} onClick={() => setShowPw((v) => !v)} />
                </div>
                <PasswordStrengthBar password={f.password} focused={pwFocused} onGenerate={(pw) => { setF((s) => ({ ...s, password: pw, confirm: pw })); setErrors(er => ({ ...er, password: undefined, confirm: undefined })); }} />
                <div style={errStyle}>{errors.password}</div>

                <label style={labelStyle}>{t.lConfirm}</label>
                <div style={inputWrap(errors.confirm)}>
                  <LockIcon />
                  <input name="confirm" value={f.confirm} onChange={onField} type={showPw2 ? 'text' : 'password'} placeholder={t.phConfirm} style={inputStyle} />
                  <EyeBtn on={showPw2} onClick={() => setShowPw2((v) => !v)} />
                </div>
                <div style={errStyle}>{errors.confirm}</div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: C.ink600, cursor: 'pointer', margin: '4px 0 16px', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={agree} onChange={() => { setAgree((v) => !v); setErrors(er => ({ ...er, agree: agree ? t.errAgree : undefined })); }} style={{ width: 16, height: 16, marginTop: 1, accentColor: '#8b5cf6', flex: 'none' }} />
                  <span>
                    {t.agreePre} <a href="/terms" target="_blank" rel="noopener noreferrer" className="link-underline" style={legalInlineLink}>"{t.terms}"</a> {t.and} <a href="/privacy" target="_blank" rel="noopener noreferrer" className="link-underline" style={legalInlineLink}>"{t.privacy}"</a>
                  </span>
                </label>
                {errors.agree && <div style={{ ...errStyle, margin: '-12px 0 4px' }}>{errors.agree}</div>}
                <button type="submit" disabled={submitting} style={btnPrimary}>
                  {submitting ? (
                    <div className="dots-container">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  ) : t.signUp}
                </button>
              </form>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '26px 0 20px' }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ fontSize: 13, color: C.textMuted }}>{t.orSignUp}</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              <SocialBtn onClick={() => startGoogleAuth('register')} label={t.googleSignUp} icon={<GoogleIcon />} />
              <div style={{ textAlign: 'center', fontSize: 14, color: C.textSecondary, marginTop: 20 }}>
                {t.haveAccount} <span onClick={() => switchRoute('login')} style={{ color: C.violetLight, fontWeight: 700, cursor: 'pointer' }}>{t.signInNow}</span>
              </div>
              <LegalLinks t={t} />
            </div>
          )}

          {route === 'register' && regStep === 'otp' && (
            <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
              <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 34, margin: 0, letterSpacing: '-.01em' }}>{t.regOtpTitle}</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: C.textSecondary, margin: '8px 0 22px' }}>
                {t.regOtpSub} <b style={{ color: C.textStrong, wordBreak: 'break-all' }}>{f.email.trim().toLowerCase()}</b>
              </p>
              {notice && <div style={noticeStyle} role="status">{notice}</div>}
              <form onSubmit={submitOtp} noValidate>
                <label htmlFor="reg-otp" style={labelStyle}>{t.regOtpLabel} <span aria-hidden="true" style={{ color: C.rose }}>*</span></label>
                <div style={inputWrap(otpError)}>
                  <LockIcon />
                  <input
                    id="reg-otp" autoFocus name="otp" value={otpCode} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                    aria-required="true" aria-invalid={!!otpError} placeholder={t.regOtpPh}
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                    style={{ ...inputStyle, letterSpacing: otpCode ? '.4em' : undefined, fontWeight: otpCode ? 700 : undefined }}
                  />
                </div>
                <div style={errStyle} role="alert">{otpError}</div>
                <div style={{ minHeight: 18, fontSize: 13, color: C.textSecondary, margin: '2px 0 18px' }}>
                  {otpLeft > 0 ? <>{t.regOtpExpiresIn} <b style={{ color: C.textStrong, fontVariantNumeric: 'tabular-nums' }}>{mmss(otpLeft)}</b></> : null}
                </div>
                <button type="submit" disabled={submitting} style={btnPrimary}>
                  {submitting ? (
                    <div className="dots-container">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  ) : t.regOtpVerify}
                </button>
              </form>
              <div style={{ textAlign: 'center', fontSize: 14, color: C.textSecondary, marginTop: 22 }}>
                {t.regOtpNoCode}{' '}
                {resendLeft > 0 ? (
                  <span style={{ color: C.ink350, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{t.regOtpResendIn} {resendLeft}s</span>
                ) : (
                  <button type="button" onClick={resendOtp} disabled={resending} style={{ ...linkBtn, opacity: resending ? 0.6 : 1 }}>{t.regOtpResend}</button>
                )}
              </div>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button type="button" onClick={() => backToRegisterForm()} style={{ ...linkBtn, display: 'inline-flex', alignItems: 'center', gap: 5, color: C.textSecondary, fontWeight: 600 }}>
                  <ChevronLeft size={16} strokeWidth={1.8} />
                  {t.regOtpBack}
                </button>
              </div>
            </div>
          )}

          {route === 'logout' && (
            <div style={{ maxWidth: 380, width: '100%', margin: '0 auto', textAlign: 'center' }}>
              <div style={{ position: 'relative', width: 150, height: 150, margin: '0 auto 30px' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px dashed ${C.violetLine}`, animation: 'spinslow 16s linear infinite' }} />
                <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 22px 44px -16px ${C.legacyShadowrgba13992246_7_}` }}>
                  <LogOut size={52} color={C.onBrand} strokeWidth={1.9} />
                </div>
              </div>
              <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 38, margin: 0 }}>{t.logoutTitle}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: C.textSecondary, margin: '14px 0 32px' }}>{t.logoutMsg}</p>
              <button onClick={() => go('login')} style={btnPrimary}>{t.loginAgain}</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ fontSize: 13, color: C.textMuted }}>{t.or}</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              <button onClick={() => go('landing')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: `1.5px solid ${C.border}`, borderRadius: 13, padding: 15, background: C.surface, fontWeight: 600, fontSize: 15, color: C.text, cursor: 'pointer' }}>
                <Home size={19} color={C.textSecondary} strokeWidth={1.8} />
                {t.backHome}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Link trang pháp lý dưới form đăng nhập/đăng ký — mở tab mới để không mất dữ liệu đang nhập.
const legalInlineLink: CSSProperties = { color: C.violetLight, fontWeight: 600, textDecoration: 'none' };

function LegalLinks({ t }: { t: { terms: string; privacy: string; ftDataDeletion: string } }) {
  const style: CSSProperties = { fontSize: 12.5, color: C.textMuted, textDecoration: 'none' };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginTop: 18 }}>
      <a href="/terms" target="_blank" rel="noopener noreferrer" className="link-underline" style={style}>{t.terms}</a>
      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="link-underline" style={style}>{t.privacy}</a>
      <a href="/data-deletion" target="_blank" rel="noopener noreferrer" className="link-underline" style={style}>{t.ftDataDeletion}</a>
    </div>
  );
}

function SocialBtn({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="google-btn"
      style={{ width: '100%', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, border: `1.5px solid ${C.legacyBorderd7d2e3}`, borderRadius: 14, background: C.surface, fontWeight: 700, fontSize: 15, color: C.textStrong, cursor: 'pointer', transition: 'background .15s, transform .1s' }}
    >
      {icon}
      {label}
    </button>
  );
}

// Logo Google chính thức (4 màu) — đồng bộ với nút "Đăng nhập với Google" ở UML/FE.
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#ea4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285f4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#fbbc05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34a853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function pillarsFor(lang: 'vi' | 'en'): { icon: LucideIcon; title: string; desc: string }[] {
  return lang === 'en'
    ? [
      { icon: Sparkles, title: 'Smart', desc: 'AI analyzes and optimizes content performance' },
      { icon: Clock, title: 'Automatic', desc: 'Schedule and auto-post 24/7' },
      { icon: BarChart3, title: 'Effective', desc: 'Measure and continuously optimize strategy' },
    ]
    : [
      { icon: Sparkles, title: 'Thông minh', desc: 'AI phân tích và tối ưu hiệu quả nội dung' },
      { icon: Clock, title: 'Tự động', desc: 'Lên lịch và đăng bài tự động 24/7' },
      { icon: BarChart3, title: 'Hiệu quả', desc: 'Đo lường và tối ưu chiến lược liên tục' },
    ];
}
