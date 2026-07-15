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
import { register as apiRegister, GOOGLE_LOGIN_URL, type User } from '../api/auth';
import PasswordStrengthBar from '../components/PasswordStrengthBar';
import { passwordValid, generateStrongPassword } from '../validations/password';
import { validEmail, passwordsMatch } from '../validations/authValidation';
import { useToast } from '../components/toast/ToastProvider';
import type { AuthForm, AuthErrors } from '../types';

const inputWrap = (error?: string): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: `1.5px solid ${error ? '#f3aabf' : '#e7e2f2'}`,
  borderRadius: 13,
  padding: '0 15px',
  background: '#fbfaff',
  transition: 'border .2s',
});
const inputStyle: CSSProperties = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, padding: '14px 0', color: '#241f3a' };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', color: '#574f6e', marginBottom: 8 };
const errStyle: CSSProperties = { minHeight: 18, fontSize: 12.5, color: '#e23d6e', marginTop: 5 };

const MailIcon = () => <Mail size={18} color="#a39bbf" strokeWidth={1.7} />;
const LockIcon = () => <Lock size={18} color="#a39bbf" strokeWidth={1.7} />;
const UserIcon = () => <UserGlyph size={17} color="#a39bbf" strokeWidth={1.7} />;
const EyeBtn = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button type="button" aria-label={on ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a39bbf', display: 'flex', position: 'relative' }}>
    <Eye size={19} strokeWidth={1.7} aria-hidden="true" />
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <line x1="3" y1="3" x2="21" y2="21" stroke="#fbfaff" strokeWidth="4" strokeLinecap="round" style={{ strokeDasharray: 26, strokeDashoffset: on ? 26 : 0, transition: 'stroke-dashoffset 0.2s ease-out' }} />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ strokeDasharray: 26, strokeDashoffset: on ? 26 : 0, transition: 'stroke-dashoffset 0.2s ease-out' }} />
    </svg>
  </button>
);

export default function Auth() {
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

  const switchRoute = (r: 'login' | 'register') => {
    setErrors({});
    setNotice('');
    setF(s => ({ ...s, password: '', confirm: '' }));
    go(r);
  };

  // Chuyển lỗi OAuth thô (vd "[access_denied]" khi người dùng huỷ) thành thông báo thân thiện.
  const oauthErrorMessage = (raw: string) =>
    /access_denied/i.test(raw) ? t.errGoogleCancelled : t.errGoogleFailed;

  // Handle Google OAuth redirect coming back to /login (?login=success | ?error=... | state.oauthError).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const stateError = (location.state as { oauthError?: string } | null)?.oauthError;
    if (params.get('login') === 'success') {
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
    try {
      await apiRegister({ fullName: f.name, email: f.email, password: f.password });
      const me = await authLogin(f.email, f.password);
      afterAuth(me);
    } catch (err) {
      const msg = (err as Error).message;
      if (/tồn tại|taken|exist|already|sử dụng/i.test(msg)) {
        setErrors({ email: 'taken' });
      } else {
        setErrors({ email: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const googleLogin = () => {
    window.location.href = GOOGLE_LOGIN_URL;
  };

  const btnPrimary: CSSProperties = { width: '100%', border: 'none', borderRadius: 13, padding: 16, fontWeight: 700, fontSize: 15, letterSpacing: '.05em', color: '#fff', background: brandGradient, boxShadow: '0 16px 30px -12px rgba(139,92,246,.6)', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.75 : 1 };

  return (
    <>

      <div className="view-pop" style={{ minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: '#fff' }}>
        {/* Illustration panel — hidden on mobile */}
        {!isMobile && (
          <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent 55%),radial-gradient(900px 700px at 90% 90%,rgba(217,70,239,.11),transparent 55%),linear-gradient(160deg,#f1f2fc,#f5f1fb 55%,#f9f1fc)', padding: '48px 54px', display: 'flex', flexDirection: 'column' }}>
            <img src="/aima-logo.png" alt="AIMA" style={{ height: 74, width: 'auto', alignSelf: 'flex-start' }} />
            <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 44, letterSpacing: '-.02em', color: '#171327', margin: '8px 0 0' }}>AI - Marketing Assistant</h1>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: '#5b5670', maxWidth: 430, margin: '16px 0 0' }}>{t.authIntro}</p>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0' }}>
              <div style={{ width: 460, height: 420, maxWidth: '100%' }}>
                <AimaScene />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 38 }}>
              {pillarsFor(lang).map((p, i) => (
                <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ width: 42, height: 42, margin: '0 auto 10px', borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 22px -14px rgba(120,60,180,.6)' }}>
                    <GradIcon icon={p.icon} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#211c38' }}>{p.title}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: '#6b6680', marginTop: 3 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form panel */}
        <div style={{ width: isMobile ? '100%' : 'min(48%,640px)', background: '#fff', padding: isMobile ? '64px 20px 30px' : '56px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: isMobile ? 18 : 32, left: isMobile ? 18 : 48 }}>
            <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', fontSize: 15, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}>
              <ChevronLeft size={19} color="#6b6680" strokeWidth={1.8} />
              {t.backToHome}
            </button>
          </div>
          <div style={{ position: 'absolute', top: isMobile ? 18 : 32, right: isMobile ? 18 : 48 }}>
            <button onClick={toggleLang} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', fontSize: 15, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}>
              <Globe size={18} color="#6b6680" strokeWidth={1.7} />
              {t.langLabel}
            </button>
          </div>

          {route === 'login' && (
            <div style={{ maxWidth: 400, width: '100%', margin: '0 auto', padding: isMobile ? 0 : '8px 0' }}>
              <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: lang === 'vi' ? (isMobile ? 25 : 32) : (isMobile ? 30 : 40), margin: 0, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{t.loginTitle}</h2>
              <p style={{ fontSize: 15, color: '#6b6680', margin: '8px 0 30px' }}>{t.loginSub}</p>
              {notice && <div style={{ fontSize: 13, color: '#16a34a', background: '#e8f8ee', border: '1px solid #cdeed8', borderRadius: 10, padding: '10px 13px', marginBottom: 16 }}>{notice}</div>}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#574f6e', cursor: 'pointer' }}>
                    <input type="checkbox" checked={remember} onChange={() => setRemember((v) => !v)} style={{ width: 16, height: 16, accentColor: '#8b5cf6' }} />
                    {t.remember}
                  </label>
                  <span onClick={() => navigate('/forgot-password')} style={{ fontSize: 13.5, color: '#8b5cf6', fontWeight: 600, cursor: 'pointer' }}>{t.forgot}</span>
                </div>
                {errors.submit && <div style={{ fontSize: 13, color: '#e23d6e', textAlign: 'center', marginBottom: 16 }}>{errors.submit}</div>}
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
                <div style={{ flex: 1, height: 1, background: '#ece8f5' }} />
                <span style={{ fontSize: 13, color: '#8a85a0' }}>{t.orSignIn}</span>
                <div style={{ flex: 1, height: 1, background: '#ece8f5' }} />
              </div>
              <SocialBtn onClick={googleLogin} label={t.googleSignIn} icon={<GoogleIcon />} />
              <div style={{ textAlign: 'center', fontSize: 14, color: '#6b6680', marginTop: 26 }}>
                {t.noAccount} <span onClick={() => switchRoute('register')} style={{ color: '#8b5cf6', fontWeight: 700, cursor: 'pointer' }}>{t.signUpNow}</span>
              </div>
            </div>
          )}

          {route === 'register' && (
            <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
              <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 34, margin: 0, letterSpacing: '-.01em' }}>{t.regTitle}</h2>
              <p style={{ fontSize: 14.5, color: '#6b6680', margin: '8px 0 22px' }}>{t.regSub}</p>
              <form onSubmit={submitRegister}>
                <label style={labelStyle}>{t.lName}</label>
                <div style={inputWrap(errors.name)}>
                  <UserIcon />
                  <input name="name" value={f.name} onChange={onField} placeholder={t.phName} style={inputStyle} />
                </div>
                <div style={errStyle}>{errors.name}</div>

                <label style={labelStyle}>EMAIL</label>
                <div style={inputWrap(errors.email)}>
                  <MailIcon />
                  <input autoFocus name="email" value={f.email} onChange={onField} type="email" placeholder={t.phEmail} style={inputStyle} />
                </div>
                <div style={errStyle}>
                  {errors.email === 'taken' ? (
                    <span style={{ color: '#e23d6e' }}>
                      {lang === 'vi' ? 'Email này đã được sử dụng — ' : "That email's taken — "}
                      <span onClick={() => switchRoute('login')} style={{ color: '#8b5cf6', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>
                        {lang === 'vi' ? 'bạn muốn đăng nhập?' : 'want to log in?'}
                      </span>
                    </span>
                  ) : errors.email}
                </div>

                <label style={labelStyle}>{t.lPassword}</label>
                <div style={inputWrap(errors.password)}>
                  <LockIcon />
                  <input name="password" value={f.password} onChange={onField} onFocus={() => setPwFocused(true)} onBlur={() => setPwFocused(false)} type={showPw ? 'text' : 'password'} placeholder={t.phPassword} style={inputStyle} />
                  {f.password && (
                    <button type="button" aria-label="Tạo mật khẩu ngẫu nhiên" onClick={() => { const pw = generateStrongPassword(); setF(s => ({ ...s, password: pw, confirm: pw })); setErrors(er => ({ ...er, password: undefined, confirm: undefined })); }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', color: '#a39bbf' }}>
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

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#574f6e', cursor: 'pointer', margin: '4px 0 16px', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={agree} onChange={() => { setAgree((v) => !v); setErrors(er => ({ ...er, agree: agree ? t.errAgree : undefined })); }} style={{ width: 16, height: 16, marginTop: 1, accentColor: '#8b5cf6', flex: 'none' }} />
                  <span>
                    {t.agreePre} <span style={{ color: '#8b5cf6', fontWeight: 600 }}>"{t.terms}"</span> {t.and} <span style={{ color: '#8b5cf6', fontWeight: 600 }}>"{t.privacy}"</span>
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
              <div style={{ textAlign: 'center', fontSize: 14, color: '#6b6680', marginTop: 20 }}>
                {t.haveAccount} <span onClick={() => switchRoute('login')} style={{ color: '#8b5cf6', fontWeight: 700, cursor: 'pointer' }}>{t.signInNow}</span>
              </div>
            </div>
          )}

          {route === 'logout' && (
            <div style={{ maxWidth: 380, width: '100%', margin: '0 auto', textAlign: 'center' }}>
              <div style={{ position: 'relative', width: 150, height: 150, margin: '0 auto 30px' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px dashed #d8cdf2', animation: 'spinslow 16s linear infinite' }} />
                <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 22px 44px -16px rgba(139,92,246,.7)' }}>
                  <LogOut size={52} color="#fff" strokeWidth={1.9} />
                </div>
              </div>
              <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 38, margin: 0 }}>{t.logoutTitle}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#6b6680', margin: '14px 0 32px' }}>{t.logoutMsg}</p>
              <button onClick={() => go('login')} style={btnPrimary}>{t.loginAgain}</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#ece8f5' }} />
                <span style={{ fontSize: 13, color: '#8a85a0' }}>{t.or}</span>
                <div style={{ flex: 1, height: 1, background: '#ece8f5' }} />
              </div>
              <button onClick={() => go('landing')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: '1.5px solid #e8e4f1', borderRadius: 13, padding: 15, background: '#fff', fontWeight: 600, fontSize: 15, color: '#3f3a55', cursor: 'pointer' }}>
                <Home size={19} color="#6b6680" strokeWidth={1.8} />
                {t.backHome}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SocialBtn({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="google-btn"
      style={{ width: '100%', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, border: '1.5px solid #d7d2e3', borderRadius: 14, background: '#fff', fontWeight: 700, fontSize: 15, color: '#211c38', cursor: 'pointer', transition: 'background .15s, transform .1s' }}
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
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
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
