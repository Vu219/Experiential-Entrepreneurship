import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/brand/ConfirmDialog';
import StatusBadge, { type Tone } from '../../components/admin/StatusBadge';
import Avatar from '../../components/admin/Avatar';
import { validEmail } from '../../validations/authValidation';
import { phoneOk } from '../../validations/profileValidation';
import { uploadAvatar } from '../../api/auth';
import { useToast } from '../../components/toast/ToastProvider';
import {
  updateAdminUser, adminResetPassword, userPlanMeta, ADMIN_ERR,
  type AdminUserRow, type UserRole, type UserPlan, type UserStatus,
} from '../../api/admin';
import { withToast } from '../../utils/toastFlow';


/**
 * Modal "Chi tiết người dùng" — 2 tab:
 *  • Thông tin: admin sửa tên/email/SĐT/vai trò/gói/trạng thái + avatar; trường chỉ đọc
 *    (ngày tạo, đăng nhập gần nhất, số kênh). Guard: tự-vai-trò & Google-email bị khoá ở UI + BE.
 *  • Tài khoản: email đăng nhập + phương thức đăng nhập + đặt lại mật khẩu (ẩn với Google).
 */
export default function EditUserModal({ user, currentAdminId, onClose, onSaved }: {
  user: AdminUserRow;
  currentAdminId: string;
  onClose: () => void;
  onSaved: (row: AdminUserRow) => void;
}) {
  const { t, brandGradient } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<'info' | 'account'>('info');

  const isGoogle = user.authProvider === 'GOOGLE';
  const isSelf = user.id === currentAdminId;

  // ----- Tab Thông tin -----
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [plan, setPlan] = useState<UserPlan>(user.plan);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatarUrl);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickAvatar = async (file: File) => {
    setUploading(true);
    const id = toast.loading('Đang chuẩn bị tải ảnh...', { title: 'Đang tải lên' });
    
    let targetPercent = 0;
    let currentPercent = 0;
    
    const interval = setInterval(() => {
      if (currentPercent < targetPercent) {
        currentPercent += Math.max(1, Math.floor((targetPercent - currentPercent) / 2));
      } else if (currentPercent < 99 && targetPercent === 100) {
        currentPercent += 1;
      }
      if (currentPercent > 99) currentPercent = 99;
      toast.loading(`Đang tải ảnh lên (${currentPercent}%)...`, { id, title: 'Đang tải lên' });
    }, 150);

    try {
      const url = await uploadAvatar(file, (evt) => {
        if (evt.total) {
          targetPercent = Math.round((evt.loaded * 100) / evt.total);
        }
      });
      clearInterval(interval);
      setAvatarUrl(url);
      toast.success('Tải ảnh thành công. Hãy nhấn Lưu để cập nhật.', { id, title: 'Thành công' });
    } catch {
      clearInterval(interval);
      toast.error('Không thể tải ảnh lên. Vui lòng thử lại.', { id, title: 'Lỗi tải lên' });
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    const er: typeof errors = {};
    if (!name.trim()) er.name = t.errNameReq;
    if (!email.trim()) er.email = t.errEmailReq;
    else if (!validEmail(email)) er.email = t.errEmailBad;
    if (phone.trim() && !phoneOk(phone)) er.phone = t.errPhoneBad;
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const persist = async () => {
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        email: isGoogle ? undefined : email.trim(),
        phone: phone.trim() || undefined,
        role: isSelf ? undefined : role,
        plan,
        status: isSelf ? undefined : status,
        avatarUrl,
      };
      const row = await withToast(updateAdminUser(user.id, payload), {
        loading: 'Đang lưu thay đổi...',
        success: (res) => `${t.usrSaved}: ${res.name}`,
        title: 'Cập nhật người dùng'
      });
      onSaved(row);
    } catch (e) {
      const code = (e as { code?: number }).code;
      const errorMsg = code === ADMIN_ERR.CANNOT_DEMOTE_SELF ? t.usrCannotDemoteSelf
        : code === ADMIN_ERR.EMAIL_LOCKED_GOOGLE ? t.usrEmailLockedGoogleErr
        : code === ADMIN_ERR.EMAIL_EXISTED ? t.usrEmailExistedErr
        : code === ADMIN_ERR.ADMIN_PROTECTED ? t.usrNoLockAdmin
        : t.usrSaveFail;
      toast.error(errorMsg);
    } finally {
      setBusy(false);
      setConfirmPlan(false);
    }
  };

  const submit = () => {
    if (!validate()) { setTab('info'); return; }
    if (plan !== user.plan) { setConfirmPlan(true); return; } // đổi gói → xác nhận trước khi lưu
    persist();
  };

  // ----- Tab Tài khoản: đặt lại mật khẩu -----
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const doReset = async () => {
    setResetBusy(true);
    try {
      await withToast(adminResetPassword(user.id), {
        loading: 'Đang gửi email đặt lại mật khẩu...',
        success: `${t.usrResetPwSent} ${user.email}`,
        error: t.usrResetPwFail,
        title: 'Đặt lại mật khẩu'
      });
    } catch {
      // lỗi đã xử lý
    } finally {
      setResetBusy(false);
      setConfirmReset(false);
    }
  };

  const providerBadge: { tone: Tone; label: string } = isGoogle
    ? { tone: 'info', label: 'Google' }
    : { tone: 'neutral', label: 'Email' };

  // Trạng thái chờ xóa: hiển thị cho admin biết + còn bao nhiêu ngày trước khi xóa vĩnh viễn.
  const pendingDays = user.status === 'PENDING_DELETE' && user.deletionDate
    ? Math.max(0, Math.ceil((new Date(user.deletionDate).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <Modal title={t.usrDetailTitle} onClose={onClose} maxWidth={560}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Avatar url={avatarUrl} initials={user.initials} size={52} gradient={brandGradient} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#211c38' }}>{user.name}</div>
          <div style={{ fontSize: 13, color: '#8a85a0' }}>{user.email}</div>
        </div>
      </div>

      {/* Banner tài khoản đang chờ xóa */}
      {user.status === 'PENDING_DELETE' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fdf0dc', border: '1px solid #f7dca6', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
          <span style={{ fontSize: 16, lineHeight: 1.3 }}>⚠</span>
          <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
            <b>{t.usrPendingTitle}</b>
            {pendingDays !== null && <> · {t.usrPendingLeft} <b>{pendingDays}</b> {t.usrPendingDaysUnit}</>}
            {user.deletionDate && (
              <div style={{ marginTop: 2 }}>{t.usrPendingOn}: {user.deletionDate.slice(0, 16).replace('T', ' ')}</div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #efeaf8', marginBottom: 16 }}>
        {([['info', t.usrTabInfo], ['account', t.usrTabAccount]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer', padding: '9px 12px',
              fontSize: 13.5, fontWeight: 700, marginBottom: -1,
              color: tab === k ? '#6d28d9' : '#a59fbb',
              borderBottom: `2px solid ${tab === k ? '#7c3aed' : 'transparent'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Avatar url={avatarUrl} initials={user.initials} size={44} gradient={brandGradient} />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={(e) => e.target.files?.[0] && pickAvatar(e.target.files[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={outlineBtn}>
              {uploading ? t.usrUploading : t.usrChangeAvatar}
            </button>
            {avatarUrl && (
              <button type="button" onClick={() => setAvatarUrl(undefined)} style={ghostBtn}>{t.usrRemoveAvatar}</button>
            )}
            <StatusBadge tone={providerBadge.tone} label={`${t.usrSignupMethod}: ${providerBadge.label}`} />
          </div>

          <Field label={t.colName} error={errors.name}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} />
          </Field>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label={t.colEmail} error={errors.email} style={{ flex: '1 1 220px' }}>
              <input value={email} type="email" disabled={isGoogle}
                onChange={(e) => setEmail(e.target.value)} style={isGoogle ? inputDisabled : input} />
              {isGoogle && <span style={hint}>{t.usrEmailLockedGoogle}</span>}
            </Field>
            <Field label={t.colPhone} error={errors.phone} style={{ flex: '1 1 160px' }}>
              <input value={phone} inputMode="tel" placeholder="0901234567"
                onChange={(e) => setPhone(e.target.value)} style={input} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label={t.colRole} style={{ flex: 1 }}>
              <select value={role} disabled={isSelf}
                onChange={(e) => setRole(e.target.value as UserRole)} style={isSelf ? inputDisabled : input}>
                <option value="USER">{t.roleUser}</option>
                <option value="ADMIN">{t.roleAdmin}</option>
              </select>
              {isSelf && <span style={hint}>{t.usrSelfRoleLocked}</span>}
            </Field>
            <Field label={t.filterPlan} style={{ flex: 1 }}>
              <select value={plan} onChange={(e) => setPlan(e.target.value as UserPlan)} style={input}>
                <option value="FREE">Free</option>
                <option value="PLUS">Plus</option>
                <option value="PRO">Pro</option>
              </select>
            </Field>
          </div>
          <Field label={t.colStatus}>
            <select value={status} disabled={isSelf}
              onChange={(e) => setStatus(e.target.value as UserStatus)} style={isSelf ? inputDisabled : input}>
              <option value="ACTIVE">{t.stActive}</option>
              <option value="LOCKED">{t.stLocked}</option>
              <option value="PENDING_DELETE">{t.stPendingDel}</option>
            </select>
            {isSelf && <span style={hint}>{t.usrSelfStatusLocked}</span>}
          </Field>

          {/* Chỉ đọc */}
          <div style={roLabel}>{t.usrReadonlyHint}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label={t.colCreated} style={{ flex: '1 1 140px' }}>
              <input value={user.createdAt} disabled style={inputDisabled} />
            </Field>
            <Field label={t.colLastLogin} style={{ flex: '1 1 140px' }}>
              <input value={user.lastLoginAt ?? '—'} disabled style={inputDisabled} />
            </Field>
          </div>
          <Field label={t.usrChannelsConnected}>
            <input value={`${user.connectedChannels ?? 0} ${t.usrChannelUnit}`} disabled style={inputDisabled} />
          </Field>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={cancelBtn}>{t.cancel}</button>
            <button onClick={submit} disabled={busy || uploading} style={primaryBtn(busy || uploading)}>{t.usrSave}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InfoLine label={t.usrLoginEmail} value={user.email} />
          <InfoLine label={t.usrLoginMethod} badge={providerBadge} />
          {isGoogle && <InfoLine label={t.usrEmailVerified} badge={{ tone: 'success', label: t.usrVerifiedGoogle }} />}

          <div style={roLabel}>{t.usrResetPwTitle}</div>
          {isGoogle ? (
            <div style={noteBox}>{t.usrGoogleNoPassword}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#6b6680', lineHeight: 1.6, margin: 0 }}>{t.usrResetPwDesc}</p>
              <button type="button" onClick={() => setConfirmReset(true)} disabled={resetBusy}
                style={{ ...outlineBtn, alignSelf: 'flex-start' }}>
                {t.usrResetPwBtn}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirm đổi gói */}
      {confirmPlan && (
        <ConfirmDialog
          title={t.usrPlanChangeTitle}
          message={`${t.usrPlanChangeMsg} ${user.name} ${t.usrPlanChangeTo} ${userPlanMeta(plan).label}?`}
          confirmLabel={t.usrPlanChangeBtn}
          variant="warning"
          busy={busy}
          onConfirm={persist}
          onClose={() => setConfirmPlan(false)}
        />
      )}

      {/* Confirm gửi email đặt lại mật khẩu */}
      {confirmReset && (
        <ConfirmDialog
          title={t.usrResetPwTitle}
          message={`${t.usrResetPwConfirm} ${user.email}?`}
          confirmLabel={t.usrResetPwBtn}
          variant="warning"
          busy={resetBusy}
          onConfirm={doReset}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </Modal>
  );
}

/* ---- primitives nội bộ (khớp style của trang danh sách) ---- */
function Field({ label, error, style, children }: { label: string; error?: string; style?: React.CSSProperties; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#8a85a0', letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{error}</span>}
    </label>
  );
}

function InfoLine({ label, value, badge }: { label: string; value?: string; badge?: { tone: Tone; label: string } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#faf9fe', border: '1px solid #f1eef8', borderRadius: 12, padding: '10px 14px' }}>
      <span style={{ fontSize: 12.5, color: '#8a85a0', fontWeight: 600 }}>{label}</span>
      {badge ? <StatusBadge tone={badge.tone} label={badge.label} />
        : <span style={{ fontSize: 13, fontWeight: 600, color: '#2b2543' }}>{value}</span>}
    </div>
  );
}

const input = { width: '100%', height: 40, border: '1px solid #ece8f6', borderRadius: 10, padding: '0 12px', fontSize: 13.5, color: '#241f3a', outline: 'none', background: '#fff' } as const;
const inputDisabled = { ...input, background: '#f4f2fb', color: '#8a85a0', cursor: 'not-allowed' } as const;
const hint = { fontSize: 11.5, color: '#a59fbb' } as const;
const roLabel = { fontSize: 11.5, fontWeight: 700 as const, color: '#a59fbb', letterSpacing: 0.3, textTransform: 'uppercase' as const, marginTop: 2 };
const noteBox = { background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#6b6680' } as const;
const outlineBtn = { border: '1px solid #ece8f6', background: '#fff', color: '#5b5670', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' } as const;
const ghostBtn = { ...outlineBtn, color: '#dc2626' } as const;
const cancelBtn = { flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' } as const;
const primaryBtn = (busy: boolean) => ({ flex: 1, border: 'none', background: 'var(--brand)', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 } as const);
