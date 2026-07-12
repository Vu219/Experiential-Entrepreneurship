import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Eye, Lock, Trash2 } from 'lucide-react';
import DatePicker from '../components/DatePicker';
import { useApp } from '../context/AppContext';
import { useAuth } from '../auth/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Card } from '../components/ui';
import Modal from '../components/Modal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { updateProfile, uploadAvatar, requestDeleteAccount, restoreAccount } from '../api/auth';
import { activity } from '../data';

const fieldLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: '#574f6e', marginBottom: 7 } as const;
const fieldInput = { width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 11, padding: '12px 14px', fontSize: 14, color: '#241f3a', background: '#fbfaff', outline: 'none' } as const;

export default function Profile() {
  const { t, lang, logout, brandGradient } = useApp();
  const { user, setUser, refreshUser } = useAuth();
  const { isMobile, isTablet } = useBreakpoint();
  const acts = activity(lang);
  const stacked = isMobile || isTablet;

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [showChangePw, setShowChangePw] = useState(false);
  const [pwToast, setPwToast] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accError, setAccError] = useState('');

  // Avatar: dropdown (xem / đổi ảnh), lightbox phóng to, và trạng thái tải ảnh.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const name = fullName || user?.fullName || 'AIMA User';
  const email = user?.email ?? '';
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();
  const avatarUrl = user?.avatarUrl ?? null;
  const pendingDelete = user?.status === 'PENDING_DELETE';

  // Đóng dropdown avatar khi nhấn ra ngoài.
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) setAvatarMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [avatarMenuOpen]);

  // Khoá cuộn nền + cho phép Esc đóng khi mở lightbox.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightboxOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  const onAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset để chọn lại cùng một file vẫn kích hoạt onChange
    if (!file) return;
    setAvatarError('');
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      const updated = await updateProfile({ fullName, phone, dateOfBirth, avatarUrl: url });
      setUser(updated);
    } catch (err) {
      setAvatarError((err as Error).message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' });

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const updated = await updateProfile({ fullName, phone, dateOfBirth });
      setUser(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setAccError('');
    setBusy(true);
    try {
      await requestDeleteAccount();
      await refreshUser();
      setShowDeleteConfirm(false);
    } catch (err) {
      setAccError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    setAccError('');
    setBusy(true);
    try {
      await restoreAccount();
      await refreshUser();
      setPwToast(t.pdRestored);
      window.setTimeout(() => setPwToast(''), 2600);
    } catch (err) {
      setAccError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view-pop" style={{ maxWidth: 980, margin: '0 auto' }}>
      {pwToast && (
        <div style={{ fontSize: 13.5, color: '#16a34a', background: '#e8f8ee', border: '1px solid #cdeed8', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>✓ {pwToast}</div>
      )}

      {/* Pending-deletion banner */}
      {pendingDelete && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, background: '#fdeef2', border: '1px solid #f3c9d6', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#c0285a' }}>⚠ {t.pdTitle}</div>
            <div style={{ fontSize: 13, color: '#8a5566', marginTop: 3 }}>
              {t.pdMsg} {user?.deletionDate ? <strong>{fmtDate(user.deletionDate)}</strong> : null}.
            </div>
            {accError && <div style={{ fontSize: 12.5, color: '#e23d6e', marginTop: 6 }}>{accError}</div>}
          </div>
          <button onClick={doRestore} disabled={busy} style={{ border: 'none', borderRadius: 11, padding: '11px 20px', fontWeight: 700, fontSize: 13.5, color: '#fff', background: brandGradient, boxShadow: '0 12px 24px -12px rgba(139,92,246,.6)', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>
            {busy ? t.processing : t.pdRestore}
          </button>
        </div>
      )}

      <div style={{ display: stacked ? 'flex' : 'grid', gridTemplateColumns: stacked ? undefined : '1fr 1.4fr', flexDirection: stacked ? 'column' : undefined, gap: 20, alignItems: stacked ? 'stretch' : 'start' }}>
        {/* LEFT column: identity + change password + delete account */}
        <div style={{ display: stacked ? 'contents' : 'flex', flexDirection: 'column', gap: 20 }}>
          <Card style={{ padding: 26, textAlign: 'center', order: stacked ? 1 : undefined }}>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onAvatarChange} style={{ display: 'none' }} />
            <div ref={avatarMenuRef} style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 14px' }}>
              <button
                onClick={() => { setAvatarError(''); setAvatarMenuOpen((v) => !v); }}
                disabled={avatarUploading}
                aria-haspopup="menu"
                aria-expanded={avatarMenuOpen}
                style={{ width: 90, height: 90, borderRadius: '50%', padding: 0, border: 'none', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 32, boxShadow: '0 16px 30px -14px rgba(139,92,246,.7)', overflow: 'hidden', position: 'relative', cursor: avatarUploading ? 'wait' : 'pointer' }}
              >
                {avatarUrl ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                {avatarUploading && (
                  <span style={{ position: 'absolute', inset: 0, background: 'rgba(20,12,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                      </path>
                    </svg>
                  </span>
                )}
              </button>
              {/* Huy hiệu máy ảnh gợi ý avatar có thể đổi */}
              <span style={{ position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px -3px rgba(60,30,110,.4)', pointerEvents: 'none' }}>
                <Camera size={15} color="#7c3aed" strokeWidth={1.9} />
              </span>

              {avatarMenuOpen && (
                <div role="menu" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 10, width: 186, background: '#fff', borderRadius: 12, border: '1px solid #ece8f6', boxShadow: '0 24px 48px -22px rgba(80,40,140,.5)', overflow: 'hidden', zIndex: 50 }}>
                  <button role="menuitem" onClick={() => { setAvatarMenuOpen(false); setLightboxOpen(true); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', border: 'none', background: 'transparent', fontSize: 13.5, fontWeight: 600, color: '#574f6e', cursor: 'pointer' }}>
                    <Eye size={17} color="#a39bbf" strokeWidth={1.8} />
                    {t.avView}
                  </button>
                  <button role="menuitem" onClick={() => { setAvatarMenuOpen(false); fileInputRef.current?.click(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', border: 'none', borderTop: '1px solid #f0ecf8', background: 'transparent', fontSize: 13.5, fontWeight: 600, color: '#574f6e', cursor: 'pointer' }}>
                    <Camera size={17} color="#a39bbf" strokeWidth={1.8} />
                    {t.avChange}
                  </button>
                </div>
              )}
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#211c38' }}>{name}</div>
            <div style={{ fontSize: 13, color: '#8a85a0', marginTop: 2 }}>{email}</div>
            {avatarUploading && <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 6 }}>{t.avUploading}</div>}
            {avatarError && <div style={{ fontSize: 12, color: '#e23d6e', marginTop: 6 }}>{avatarError}</div>}
            {/* Gói thật của user (từ /users/me) — không hardcode "Gói Premium" */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f3edff', borderRadius: 999, padding: '5px 13px' }}>
              ★ {user?.plan === 'PRO' ? t.planPro : user?.plan === 'PLUS' ? t.planPlus : t.planFree}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {[['142', t.stPosts], ['248K', t.stTotalReach]].map(([v, l], i) => (
                <div key={i} style={{ flex: 1, border: '1px solid #efeaf8', borderRadius: 13, padding: 13 }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{v}</div>
                  <div style={{ fontSize: 11, color: '#a59fbb' }}>{l}</div>
                </div>
              ))}
            </div>
            {/* Nút đăng xuất chỉ hiện trên mobile/tablet — trên laptop/PC đã có ở thanh bên/menu. */}
            {stacked && (
              <button onClick={logout} style={{ width: '100%', marginTop: 18, border: '1.5px solid #f3c9d6', background: '#fff', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13.5, color: '#e23d6e', cursor: 'pointer' }}>{t.signOut}</button>
            )}
          </Card>

          {/* Change password */}
          <Card style={{ padding: 22, order: stacked ? 4 : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 11, background: '#f3edff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={20} strokeWidth={1.8} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: '#211c38' }}>{t.prChangePw}</div>
                <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 2 }}>{t.prChangePwSub}</div>
              </div>
            </div>
            <button onClick={() => setShowChangePw(true)} style={{ width: '100%', marginTop: 14, border: '1.5px solid #e7e2f2', background: '#fff', borderRadius: 11, padding: 11, fontWeight: 700, fontSize: 13.5, color: '#7c3aed', cursor: 'pointer' }}>{t.prChangePw}</button>
          </Card>

          {/* Delete account — ẩn khi đã ở trạng thái chờ xóa (đã có banner khôi phục) */}
          {!pendingDelete && (
            <Card style={{ padding: 22, border: '1px solid #f3c9d6', order: stacked ? 5 : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 11, background: '#fdeef2', color: '#e23d6e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} strokeWidth={1.8} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: '#c0285a' }}>{t.prDeleteAcc}</div>
                  <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 2 }}>{t.prDeleteAccSub}</div>
                </div>
              </div>
              <button onClick={() => { setAccError(''); setShowDeleteConfirm(true); }} style={{ width: '100%', marginTop: 14, border: '1.5px solid #f3c9d6', background: '#fff', borderRadius: 11, padding: 11, fontWeight: 700, fontSize: 13.5, color: '#e23d6e', cursor: 'pointer' }}>{t.prDeleteAcc}</button>
            </Card>
          )}
        </div>

        {/* RIGHT column: edit + activity */}
        <div style={{ display: stacked ? 'contents' : 'flex', flexDirection: 'column', gap: 20 }}>
          <Card style={{ padding: 26, order: stacked ? 2 : undefined }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.prEdit}</div>
            {error && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdeef2', border: '1px solid #f3c9d6', borderRadius: 10, padding: '10px 13px', marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div>
                <label style={fieldLabel}>{t.lName}</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={fieldInput} />
              </div>
              <div>
                <label style={fieldLabel}>EMAIL</label>
                <input value={email} disabled style={{ ...fieldInput, color: '#8a85a0', cursor: 'not-allowed' }} />
              </div>
              <div>
                <label style={fieldLabel}>{t.prPhone}</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901234567" style={fieldInput} />
              </div>
              <div>
                <label style={fieldLabel}>{t.prDob}</label>
                <DatePicker
                  value={dateOfBirth}
                  onChange={(v) => setDateOfBirth(v)}
                  max={new Date().toISOString().split('T')[0]}
                  style={{ border: '1.5px solid #e7e2f2', borderRadius: 11, padding: '0 14px', background: '#fbfaff' }}
                  inputStyle={{ fontSize: 14, padding: '12px 0' }}
                />
              </div>
            </div>
            <button onClick={save} disabled={saving} style={{ marginTop: 18, border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.75 : 1 }}>{saving ? t.processing : saved ? t.saved : t.save}</button>
          </Card>

          <Card style={{ padding: 26, order: stacked ? 3 : undefined }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.prActivity}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {acts.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: a.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{a.tag}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: '#3f3a55' }}>{a.text}</span>
                  <span style={{ fontSize: 12, color: '#a59fbb' }}>{a.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {lightboxOpen && createPortal(
        <div
          onMouseDown={() => setLightboxOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,18,48,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onMouseDown={(e) => e.stopPropagation()} style={{ display: 'flex' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} style={{ maxWidth: '92vw', maxHeight: '88vh', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: 16, boxShadow: '0 40px 80px -30px rgba(0,0,0,.6)' }} />
            ) : (
              <div style={{ width: 'min(70vw, 300px)', height: 'min(70vw, 300px)', maxWidth: 300, maxHeight: 300, borderRadius: '50%', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 88, boxShadow: '0 40px 80px -30px rgba(0,0,0,.6)' }}>{initials}</div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {showChangePw && (
        <ChangePasswordModal
          onClose={() => setShowChangePw(false)}
          onSuccess={() => { setPwToast(t.cpSuccess); window.setTimeout(() => setPwToast(''), 2600); }}
        />
      )}

      {showDeleteConfirm && (
        <Modal title={t.delTitle} onClose={() => !busy && setShowDeleteConfirm(false)}>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: '#4b4660' }}>{t.delMsg}</div>
          {accError && <div style={{ fontSize: 12.5, color: '#e23d6e', marginTop: 12 }}>{accError}</div>}
          <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
            <button onClick={() => setShowDeleteConfirm(false)} disabled={busy} style={{ flex: 1, border: '1.5px solid #e7e2f2', background: '#fff', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, color: '#4b4660', cursor: 'pointer' }}>{t.cancel}</button>
            <button onClick={doDelete} disabled={busy} style={{ flex: 1, border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, color: '#fff', background: '#e23d6e', boxShadow: '0 12px 24px -12px rgba(226,61,110,.6)', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>{busy ? t.processing : t.delConfirm}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
