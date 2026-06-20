import { useEffect, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../auth/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { GradIcon } from '../components/ui';
import AimaScene from '../components/AimaScene';
import { register as apiRegister, GOOGLE_LOGIN_URL, type User } from '../api/auth';
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

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a39bbf" strokeWidth={1.7}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M4 7l8 6 8-6" /></svg>
);
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a39bbf" strokeWidth={1.7}><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
);
const UserIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a39bbf" strokeWidth={1.7}><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0114 0" /></svg>
);
const EyeBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a39bbf', display: 'flex' }}>
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
  </button>
);

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

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
  const [notice, setNotice] = useState<string>((location.state as { notice?: string } | null)?.notice ?? '');

  // Handle Google OAuth redirect coming back to /login (?login=success | ?error=...).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('login') === 'success') {
      refreshUser().then((me) => {
        if (me) navigate(me.profileCompleted ? '/dashboard' : '/complete-profile', { replace: true });
      });
    } else if (params.get('error')) {
      setErrors((er) => ({ ...er, submit: params.get('error') as string }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onField = (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [e.target.name]: e.target.value }));

  const afterAuth = (me: User) => navigate(me.profileCompleted ? '/dashboard' : '/complete-profile', { replace: true });

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: AuthErrors = {};
    if (!f.email) er.email = t.errEmailReq;
    else if (!validEmail(f.email)) er.email = t.errEmailBad;
    if (!f.password) er.password = t.errPwReq;
    else if (f.password.length < 6) er.password = t.errPwShort;
    setErrors(er);
    if (Object.keys(er).length > 0) return;
    setSubmitting(true);
    setNotice('');
    try {
      const me = await authLogin(f.email, f.password);
      afterAuth(me);
    } catch (err) {
      setErrors({ submit: (err as Error).message });
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
    else if (f.password.length < 6) er.password = t.errPwShort;
    if (!f.confirm) er.confirm = t.errConfirmReq;
    else if (f.confirm !== f.password) er.confirm = t.errConfirmBad;
    if (!agree) er.agree = t.errAgree;
    setErrors(er);
    if (Object.keys(er).length > 0) return;
    setSubmitting(true);
    try {
      await apiRegister({ fullName: f.name, email: f.email, password: f.password });
      const me = await authLogin(f.email, f.password);
      afterAuth(me);
    } catch (err) {
      setErrors({ submit: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const googleLogin = () => {
    window.location.href = GOOGLE_LOGIN_URL;
  };

  const btnPrimary: CSSProperties = { width: '100%', border: 'none', borderRadius: 13, padding: 16, fontWeight: 700, fontSize: 15, letterSpacing: '.05em', color: '#fff', background: brandGradient, boxShadow: '0 16px 30px -12px rgba(139,92,246,.6)', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.75 : 1 };

  return (
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
                  <GradIcon path={p.icon} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#211c38' }}>{p.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.45, color: '#6b6680', marginTop: 3 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form panel */}
      <div style={{ width: isMobile ? '100%' : 'min(48%,640px)', background: '#fff', padding: isMobile ? '30px 20px' : '40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: isMobile ? 18 : 32, right: isMobile ? 18 : 48 }}>
          <button onClick={toggleLang} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', fontSize: 15, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b6680" strokeWidth={1.7}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" strokeLinecap="round" /></svg>
            {t.langLabel}
          </button>
        </div>

        {route === 'login' && (
          <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
            <h2 className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 40, margin: 0, letterSpacing: '-.02em' }}>Welcome to AIMA!!</h2>
            <p style={{ fontSize: 15, color: '#6b6680', margin: '8px 0 30px' }}>{t.loginSub}</p>
            {notice && <div style={{ fontSize: 13, color: '#16a34a', background: '#e8f8ee', border: '1px solid #cdeed8', borderRadius: 10, padding: '10px 13px', marginBottom: 16 }}>{notice}</div>}
            <form onSubmit={submitLogin}>
              <label style={labelStyle}>EMAIL</label>
              <div style={inputWrap(errors.email)}>
                <MailIcon />
                <input name="email" value={f.email} onChange={onField} type="email" placeholder={t.phEmail} style={inputStyle} />
              </div>
              <div style={errStyle}>{errors.email}</div>

              <label style={{ ...labelStyle, margin: '8px 0' }}>{t.lPassword}</label>
              <div style={inputWrap(errors.password)}>
                <LockIcon />
                <input name="password" value={f.password} onChange={onField} type={showPw ? 'text' : 'password'} placeholder={t.phPassword} style={inputStyle} />
                <EyeBtn onClick={() => setShowPw((v) => !v)} />
              </div>
              <div style={errStyle}>{errors.password}</div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#574f6e', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={() => setRemember((v) => !v)} style={{ width: 16, height: 16, accentColor: '#8b5cf6' }} />
                  {t.remember}
                </label>
                <span onClick={() => navigate('/forgot-password')} style={{ fontSize: 13.5, color: '#8b5cf6', fontWeight: 600, cursor: 'pointer' }}>{t.forgot}</span>
              </div>
              {errors.submit && <div style={{ ...errStyle, marginTop: 0, marginBottom: 12 }}>{errors.submit}</div>}
              <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? t.processing : t.signIn}</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#ece8f5' }} />
              <span style={{ fontSize: 13, color: '#8a85a0' }}>{t.orSignIn}</span>
              <div style={{ flex: 1, height: 1, background: '#ece8f5' }} />
            </div>
            <SocialBtn onClick={googleLogin} label="Google" icon={<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 2.9 14.6 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.2-.2-1.7H12z" /></svg>} />
            <div style={{ textAlign: 'center', fontSize: 14, color: '#6b6680', marginTop: 26 }}>
              {t.noAccount} <span onClick={() => go('register')} style={{ color: '#8b5cf6', fontWeight: 700, cursor: 'pointer' }}>{t.signUpNow}</span>
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
                <input name="email" value={f.email} onChange={onField} type="email" placeholder={t.phEmail} style={inputStyle} />
              </div>
              <div style={errStyle}>{errors.email}</div>

              <label style={labelStyle}>{t.lPassword}</label>
              <div style={inputWrap(errors.password)}>
                <LockIcon />
                <input name="password" value={f.password} onChange={onField} type={showPw ? 'text' : 'password'} placeholder={t.phPassword} style={inputStyle} />
                <EyeBtn onClick={() => setShowPw((v) => !v)} />
              </div>
              <div style={errStyle}>{errors.password}</div>

              <label style={labelStyle}>{t.lConfirm}</label>
              <div style={inputWrap(errors.confirm)}>
                <LockIcon />
                <input name="confirm" value={f.confirm} onChange={onField} type={showPw2 ? 'text' : 'password'} placeholder={t.phConfirm} style={inputStyle} />
                <EyeBtn onClick={() => setShowPw2((v) => !v)} />
              </div>
              <div style={errStyle}>{errors.confirm}</div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#574f6e', cursor: 'pointer', margin: '4px 0 16px', lineHeight: 1.4 }}>
                <input type="checkbox" checked={agree} onChange={() => setAgree((v) => !v)} style={{ width: 16, height: 16, marginTop: 1, accentColor: '#8b5cf6', flex: 'none' }} />
                <span>
                  {t.agreePre} <span style={{ color: '#8b5cf6', fontWeight: 600 }}>"{t.terms}"</span> {t.and} <span style={{ color: '#8b5cf6', fontWeight: 600 }}>"{t.privacy}"</span>
                </span>
              </label>
              {errors.agree && <div style={{ ...errStyle, margin: '-12px 0 4px' }}>{errors.agree}</div>}
              {errors.submit && <div style={{ ...errStyle, marginTop: 0, marginBottom: 12 }}>{errors.submit}</div>}
              <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? t.processing : t.signUp}</button>
            </form>
            <div style={{ textAlign: 'center', fontSize: 14, color: '#6b6680', marginTop: 20 }}>
              {t.haveAccount} <span onClick={() => go('login')} style={{ color: '#8b5cf6', fontWeight: 700, cursor: 'pointer' }}>{t.signInNow}</span>
            </div>
          </div>
        )}

        {route === 'logout' && (
          <div style={{ maxWidth: 380, width: '100%', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 150, height: 150, margin: '0 auto 30px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px dashed #d8cdf2', animation: 'spinslow 16s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 22px 44px -16px rgba(139,92,246,.7)' }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" /><path d="M10 17l5-5-5-5M15 12H3" /></svg>
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
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6b6680" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" /></svg>
              {t.backHome}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SocialBtn({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: '1.5px solid #e8e4f1', borderRadius: 12, padding: 13, background: '#fff', fontWeight: 600, fontSize: 14, color: '#3f3a55', cursor: 'pointer' }}>
      {icon}
      {label}
    </button>
  );
}

function pillarsFor(lang: 'vi' | 'en') {
  return lang === 'en'
    ? [
        { icon: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z', title: 'Smart', desc: 'AI analyzes and optimizes content performance' },
        { icon: 'M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z', title: 'Automatic', desc: 'Schedule and auto-post 24/7' },
        { icon: 'M4 21V11M10 21V4M16 21v-6M3 21h18', title: 'Effective', desc: 'Measure and continuously optimize strategy' },
      ]
    : [
        { icon: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z', title: 'Thông minh', desc: 'AI phân tích và tối ưu hiệu quả nội dung' },
        { icon: 'M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z', title: 'Tự động', desc: 'Lên lịch và đăng bài tự động 24/7' },
        { icon: 'M4 21V11M10 21V4M16 21v-6M3 21h18', title: 'Hiệu quả', desc: 'Đo lường và tối ưu chiến lược liên tục' },
      ];
}
