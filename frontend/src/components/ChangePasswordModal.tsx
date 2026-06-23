import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../auth/AuthContext';
import { changePasswordInit, changePasswordConfirm, verifyOtp } from '../api/auth';
import type { ApiError } from '../api/client';
import Modal from './Modal';
import PasswordStrengthBar from './PasswordStrengthBar';
import { passwordValid } from '../utils/password';

type Step = 'current' | 'otp' | 'new';

// Khớp otp.ttl-seconds mặc định ở backend (90s) — giống luồng quên mật khẩu.
const OTP_TTL = 90;
const OTP_NOT_FOUND = 1060; // OTP hết hạn / không tồn tại
const OTP_ATTEMPTS_EXCEEDED = 1072; // sai quá số lần cho phép

const labelStyle: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', color: '#574f6e', marginBottom: 8 };
const inputWrap: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid #e7e2f2', borderRadius: 13, padding: '0 15px', background: '#fbfaff' };
const inputStyle: CSSProperties = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, padding: '13px 0', color: '#241f3a' };

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a39bbf" strokeWidth={1.7}><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
);
const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a39bbf" strokeWidth={1.7}><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M17 6l2 2M14 9l2 2" /></svg>
);
const EyeBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a39bbf', display: 'flex' }}>
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
  </button>
);

export default function ChangePasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t, brandGradient } = useApp();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('current');
  const [currentPassword, setCurrentPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const sendOtp = async () => {
    setError('');
    setSubmitting(true);
    try {
      await changePasswordInit(currentPassword);
      setStep('otp');
      setOtpCode('');
      setSecondsLeft(OTP_TTL);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCurrent = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!currentPassword) return setError(t.errCurrentPwReq);
    sendOtp();
  };

  const handleOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otpCode) return setError(t.errOtpReq);
    if (!/^\d{6}$/.test(otpCode)) return setError(t.errOtpBad);
    setSubmitting(true);
    try {
      // Xác thực OTP ở backend trước khi cho qua bước nhập mật khẩu mới.
      await verifyOtp(user!.email, otpCode);
      setStep('new');
    } catch (err) {
      const code = (err as ApiError).code;
      if (code === OTP_ATTEMPTS_EXCEEDED || code === OTP_NOT_FOUND) {
        setSecondsLeft(0);
        setOtpCode('');
      }
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNew = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newPassword) return setError(t.errPwReq);
    if (!passwordValid(newPassword)) return setError(t.errPwWeak);
    if (newPassword !== confirmPassword) return setError(t.errConfirmBad);
    setSubmitting(true);
    try {
      await changePasswordConfirm({ otpCode, newPassword, confirmPassword });
      onSuccess();
      onClose();
    } catch (err) {
      const code = (err as ApiError).code;
      if (code === OTP_NOT_FOUND || code === OTP_ATTEMPTS_EXCEEDED) {
        setStep('otp');
        setSecondsLeft(0);
        setOtpCode('');
      }
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const sub = step === 'current' ? t.cpSubCurrent : step === 'otp' ? t.cpSubOtp : t.cpSubNew;
  const btnPrimary: CSSProperties = { width: '100%', border: 'none', borderRadius: 13, padding: 14, fontWeight: 700, fontSize: 14.5, letterSpacing: '.04em', color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.75 : 1 };

  const steps: { key: Step; label: string }[] = [
    { key: 'current', label: t.cpStepCurrent },
    { key: 'otp', label: t.cpStepOtp },
    { key: 'new', label: t.cpStepNew },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);

  return (
    <Modal title={t.cpTitle} subtitle={sub} onClose={onClose}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none', color: i <= activeIdx ? '#fff' : '#a39bbf', background: i <= activeIdx ? brandGradient : '#efecf7' }}>
              {i < activeIdx ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: i <= activeIdx ? '#3f3a55' : '#a39bbf', whiteSpace: 'nowrap' }}>{s.label}</span>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, borderRadius: 2, background: i < activeIdx ? brandGradient : '#efecf7' }} />}
          </div>
        ))}
      </div>

      {error && <div style={{ fontSize: 13, color: '#e23d6e', background: '#fdecf1', border: '1px solid #f6cdd9', borderRadius: 10, padding: '10px 13px', marginBottom: 14 }}>{error}</div>}

      {step === 'current' && (
        <form onSubmit={handleCurrent}>
          <label style={labelStyle}>{t.cpCurrentLabel}</label>
          <div style={inputWrap}>
            <LockIcon />
            <input type={showCur ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t.cpCurrentPh} style={inputStyle} autoFocus />
            <EyeBtn onClick={() => setShowCur((v) => !v)} />
          </div>
          <button type="submit" disabled={submitting} style={{ ...btnPrimary, marginTop: 18 }}>{submitting ? t.processing : t.cpContinue}</button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleOtp}>
          <label style={labelStyle}>{t.fpOtpLabel}</label>
          <div style={inputWrap}>
            <KeyIcon />
            <input type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" style={{ ...inputStyle, letterSpacing: '.5em', fontWeight: 700 }} autoFocus />
          </div>
          <div style={{ minHeight: 18, fontSize: 12.5, marginTop: 6, color: secondsLeft > 0 ? '#8a85a0' : '#e23d6e' }}>
            {secondsLeft > 0 ? `${t.fpExpiresIn} ${secondsLeft}s` : t.fpExpired}
          </div>
          <button type="submit" disabled={submitting || secondsLeft <= 0} style={{ ...btnPrimary, marginTop: 6, opacity: submitting || secondsLeft <= 0 ? 0.6 : 1, cursor: secondsLeft <= 0 ? 'not-allowed' : btnPrimary.cursor }}>
            {submitting ? t.processing : t.fpVerify}
          </button>
          <button type="button" onClick={sendOtp} disabled={submitting || secondsLeft > 0} style={{ width: '100%', marginTop: 10, border: '1.5px solid #e8e4f1', borderRadius: 13, padding: 12, background: '#fff', fontWeight: 600, fontSize: 13.5, color: secondsLeft > 0 ? '#a39bbf' : '#8b5cf6', cursor: secondsLeft > 0 ? 'not-allowed' : 'pointer' }}>
            {secondsLeft > 0 ? `${t.fpResendIn} ${secondsLeft}s` : t.fpResend}
          </button>
        </form>
      )}

      {step === 'new' && (
        <form onSubmit={handleNew}>
          <label style={labelStyle}>{t.fpNewPw}</label>
          <div style={inputWrap}>
            <LockIcon />
            <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.phPassword} style={inputStyle} autoFocus />
            <EyeBtn onClick={() => setShowPw((v) => !v)} />
          </div>
          <PasswordStrengthBar password={newPassword} />
          <div style={{ height: 12 }} />
          <label style={labelStyle}>{t.fpConfirmPw}</label>
          <div style={inputWrap}>
            <LockIcon />
            <input type={showPw2 ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.phConfirm} style={inputStyle} />
            <EyeBtn onClick={() => setShowPw2((v) => !v)} />
          </div>
          <button type="submit" disabled={submitting} style={{ ...btnPrimary, marginTop: 18 }}>{submitting ? t.processing : t.cpConfirm}</button>
        </form>
      )}
    </Modal>
  );
}
