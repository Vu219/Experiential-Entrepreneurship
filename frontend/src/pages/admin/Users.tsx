import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Users as UsersIcon, UserCheck, Lock, Unlock, Eye, UserPlus, Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon } from '../../components/ui';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/brand/ConfirmDialog';
import StatusBadge, { type Tone } from '../../components/admin/StatusBadge';
import StatCard from '../../components/admin/StatCard';
import Avatar from '../../components/admin/Avatar';
import Pagination from '../../components/admin/Pagination';
import RowActionsMenu, { type RowAction } from '../../components/admin/RowActionsMenu';
import AdminListPage, { SearchInput, FilterSelect, DataTable, type ListState } from '../../components/admin/AdminListPage';
import PasswordStrengthBar from '../../components/PasswordStrengthBar';
import { validEmail } from '../../validations/authValidation';
import { phoneOk } from '../../validations/profileValidation';
import EditUserModal from './EditUserModal';
import {
  getAdminUsers, getUserStats, createAdminUser, setUserLocked, deleteAdminUser, userStatusMeta, userPlanMeta, timeAgo,
  type AdminUserRow, type UserRole, type UserPlan, type UserStatus, type UserStats,
} from '../../api/admin';
import { useToast } from '../../components/toast/ToastProvider';
import PageContainer from '../../components/PageContainer';


const PAGE_SIZE = 8;

type ConfirmState = { kind: 'lock' | 'unlock' | 'delete'; user: AdminUserRow };

export default function Users() {
  const { t, lang, brandGradient } = useApp();
  const { user: me } = useAuth();
  const { isMobile } = useBreakpoint();

  // ----- Danh sách (server-side) -----
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0); // 0-based (Spring Pageable)
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [stats, setStats] = useState<UserStats | null>(null);

  // ----- Bộ lọc / tìm kiếm -----
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [role, setRole] = useState<'all' | UserRole>('all');
  const [status, setStatus] = useState<'all' | UserStatus>('all');
  const [plan, setPlan] = useState<'all' | UserPlan>('all');

  // ----- Modal & feedback -----
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(id);
  }, [query]);
  useEffect(() => setPage(0), [debouncedQ, role, status, plan]);

  const fetchUsers = useCallback(() => {
    setLoad('loading');
    getAdminUsers({
      page, size: PAGE_SIZE, q: debouncedQ,
      role: role === 'all' ? undefined : role,
      status: status === 'all' ? undefined : status,
      plan: plan === 'all' ? undefined : plan,
    })
      .then((r) => { setRows(r.rows); setPageCount(r.pageCount); setLoad('ok'); })
      .catch(() => setLoad('error'));
  }, [page, debouncedQ, role, status, plan]);
  useEffect(fetchUsers, [fetchUsers]);

  const fetchStats = useCallback(() => { getUserStats().then(setStats).catch(() => setStats(null)); }, []);
  useEffect(fetchStats, [fetchStats]);

  const state: ListState = load === 'loading' ? 'loading' : load === 'error' ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  // ----- Stat cards (từ endpoint riêng vì list đã server-side) -----
  const statCards = useMemo(() => {
    const s = stats ?? { total: 0, active: 0, locked: 0, newThisMonth: 0 };
    const activePct = s.total ? Math.round((s.active / s.total) * 100) : 0;
    return [
      { value: s.total, label: t.usrStatTotal, pill: null, icon: UsersIcon, tint: 'linear-gradient(135deg,#e9f0ff,#f1e9ff)', color: '#6366f1' },
      { value: s.active, label: t.usrStatActive, pill: `${activePct}% ${t.usrOfTotal}`, icon: UserCheck, tint: 'linear-gradient(135deg,#e7fff4,#e9f7ff)', color: '#10b981' },
      { value: s.locked, label: t.usrStatLocked, pill: null, icon: Lock, tint: 'linear-gradient(135deg,#fde8e8,#fff0f0)', color: '#dc2626' },
      { value: s.newThisMonth, label: t.usrStatNew, pill: null, icon: UserPlus, tint: 'linear-gradient(135deg,#f1e9ff,#fae9ff)', color: '#8b5cf6' },
    ];
  }, [stats, t]);

  const roleMeta = (r: UserRole): { tone: Tone; label: string } =>
    r === 'ADMIN' ? { tone: 'purple', label: t.roleAdmin } : { tone: 'neutral', label: t.roleUser };

  // ----- Hành động dòng: Chi tiết + Khoá/Mở khoá (ADMIN được BE bảo vệ) -----
  const rowActions = (u: AdminUserRow): RowAction[] => {
    const acts: RowAction[] = [
      { key: 'detail', label: t.detail, icon: <Eye size={16} strokeWidth={1.8} />, onClick: () => setSelected(u) },
    ];
    if (u.role === 'ADMIN') return acts; // ADMIN được bảo vệ: không khoá/xoá
    if (u.status === 'ACTIVE' || u.status === 'LOCKED') {
      const locked = u.status === 'LOCKED';
      acts.push({
        key: 'lock',
        label: locked ? t.usrUnlock : t.usrLock,
        icon: locked ? <Unlock size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />,
        onClick: () => setConfirm({ kind: locked ? 'unlock' : 'lock', user: u }),
        danger: !locked,
      });
    }
    // Xóa cứng — cho mọi USER (kể cả đang chờ xóa: admin xóa luôn không cần đợi hết hạn).
    acts.push({
      key: 'delete',
      label: t.usrHardDelete,
      icon: <Trash2 size={16} strokeWidth={1.8} />,
      onClick: () => setConfirm({ kind: 'delete', user: u }),
      danger: true,
    });
    return acts;
  };

  const runConfirm = () => {
    if (!confirm) return;
    setBusy(true);
    const u = confirm.user;
    const done = () => { setBusy(false); setConfirm(null); };

    if (confirm.kind === 'delete') {
      deleteAdminUser(u.id)
        .then(() => {
          setSelected((s) => (s && s.id === u.id ? null : s));
          toast.success(`${t.usrHardDeleted}: ${u.name}`);
          fetchUsers();
          fetchStats();
        })
        .catch(() => toast.error(t.usrHardDeleteFail))
        .finally(done);
      return;
    }

    setUserLocked(u.id, confirm.kind === 'lock')
      .then((res) => {
        setRows((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: res.status } : x)));
        toast.success(`${confirm.kind === 'lock' ? t.usrLocked : t.usrUnlocked}: ${u.name}`);
        fetchStats();
      })
      .catch(() => toast.error(t.usrNoLockAdmin))
      .finally(done);
  };

  const toolbar = (
    <>
      <SearchInput value={query} onChange={setQuery} />
      <FilterSelect value={role} onChange={(v) => setRole(v as 'all' | UserRole)}
        options={[['all', `${t.filterRole}: ${t.filterAll}`], ['USER', t.roleUser], ['ADMIN', t.roleAdmin]]} />
      <FilterSelect value={status} onChange={(v) => setStatus(v as 'all' | UserStatus)}
        options={[['all', `${t.colStatus}: ${t.filterAll}`], ['ACTIVE', t.stActive], ['LOCKED', t.stLocked], ['PENDING_DELETE', t.stPendingDel]]} />
      <FilterSelect value={plan} onChange={(v) => setPlan(v as 'all' | UserPlan)}
        options={[['all', `${t.filterPlan}: ${t.filterAll}`], ['FREE', 'Free'], ['PLUS', 'Plus'], ['PRO', 'Pro']]} />
      <button type="button" onClick={() => setShowCreate(true)} className="btn-grad"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, marginLeft: 'auto', border: 'none', background: brandGradient, color: '#fff', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '0 14px', cursor: 'pointer' }}>
        <Icon icon={UserPlus} size={14} stroke="#fff" />
        {t.usrAdd}
      </button>
    </>
  );

  const head: ReactNode[] = [t.colName, t.colRole, t.colPlan, t.colStatus, t.colLastLogin, t.colCreated, t.colAction];

  return (
    <PageContainer>
      {/* Stat cards — component quản trị dùng chung */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 18 }}>
        {statCards.map((s, i) => (
          <StatCard key={i} icon={s.icon} iconBg={s.tint} iconColor={s.color} value={s.value} label={s.label} pill={s.pill} pillTone="purple" />
        ))}
      </div>

      <AdminListPage state={state} toolbar={toolbar} onRetry={fetchUsers}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
            {rows.map((u) => (
              <Card key={u.id} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Avatar url={u.avatarUrl} initials={u.initials} size={38} gradient={brandGradient} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2b2543', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: '#a59fbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  </div>
                  <RowActionsMenu actions={rowActions(u)} ariaLabel={`${t.usrMoreActions} — ${u.name}`} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <StatusBadge {...roleMeta(u.role)} />
                  <StatusBadge {...userPlanMeta(u.plan)} />
                  <StatusBadge {...userStatusMeta(lang, u.status)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11.5, color: '#8a85a0', borderTop: '1px solid #f4f1fa', paddingTop: 10 }}>
                  <span>{t.colLastLogin}: {timeAgo(lang, u.lastLoginAt)}</span>
                  <span>{t.colCreated}: {u.createdAt}</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <DataTable head={head} minWidth={860}>
            {rows.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid #f1eef8' }}>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar url={u.avatarUrl} initials={u.initials} size={32} gradient={brandGradient} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{u.name}</div>
                      <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 16px' }}><StatusBadge {...roleMeta(u.role)} /></td>
                <td style={{ padding: '13px 16px' }}><StatusBadge {...userPlanMeta(u.plan)} /></td>
                <td style={{ padding: '13px 16px' }}><StatusBadge {...userStatusMeta(lang, u.status)} /></td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: '#6b6680', whiteSpace: 'nowrap' }}>{timeAgo(lang, u.lastLoginAt)}</td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: '#8a85a0', whiteSpace: 'nowrap' }}>{u.createdAt}</td>
                <td style={{ padding: '13px 16px' }}>
                  <RowActionsMenu actions={rowActions(u)} ariaLabel={`${t.usrMoreActions} — ${u.name}`} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <div style={{ padding: '0 16px 16px' }}>
          <Pagination page={page + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)} />
        </div>
      </AdminListPage>

      {/* Modal chi tiết (2 tab) */}
      {selected && me && (
        <EditUserModal
          user={selected}
          currentAdminId={me.id}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); fetchUsers(); fetchStats(); }}
        />
      )}

      {/* Khoá / mở khoá */}
      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'delete' ? t.usrHardDeleteTitle : confirm.kind === 'lock' ? t.usrLockTitle : t.usrUnlockTitle}
          message={confirm.kind === 'delete' ? t.usrHardDeleteMsg : confirm.kind === 'lock' ? t.usrLockMsg : t.usrUnlockMsg}
          confirmLabel={confirm.kind === 'delete' ? t.usrHardDelete : confirm.kind === 'lock' ? t.usrLock : t.usrUnlock}
          variant={confirm.kind === 'unlock' ? 'warning' : 'danger'}
          busy={busy}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        >
          <div style={{ background: '#faf9fe', border: '1px solid #f1eef8', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#3f3a55', marginBottom: 8 }}>
            <b>{confirm.user.name}</b> — {confirm.user.email}
          </div>
        </ConfirmDialog>
      )}

      {/* Thêm người dùng */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(row) => { setShowCreate(false); toast.success(`${t.usrCreated}: ${row.name}`); fetchUsers(); fetchStats(); }}
        />
      )}
    </PageContainer>
  );
}

/** Tạo tài khoản thủ công (POST /users) — admin đặt mật khẩu, mặc định gói FREE. */
function CreateUserModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (row: AdminUserRow) => void;
}) {
  const { t } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('USER');
  const [plan, setPlan] = useState<UserPlan>('FREE');
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = () => {
    const er: typeof errors = {};
    if (!name.trim()) er.name = t.errNameReq;
    if (!email.trim()) er.email = t.errEmailReq;
    else if (!validEmail(email)) er.email = t.errEmailBad;
    if (phone.trim() && !phoneOk(phone)) er.phone = t.errPhoneBad;
    if (password.length < 8) er.password = t.usrPasswordHint;
    setErrors(er);
    if (Object.keys(er).length > 0) return;
    setBusy(true);
    createAdminUser({ name: name.trim(), email: email.trim(), password, phone: phone.trim() || undefined, role, plan })
      .then(onCreated)
      .catch((e) => toast.error((e as { code?: number }).code === 1003 ? t.usrEmailExistedErr : t.usrSaveFail))
      .finally(() => setBusy(false));
  };

  return (
    <Modal title={t.usrAddTitle} onClose={onClose} maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CField label={t.colName} error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} style={cInput} />
        </CField>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <CField label={t.colEmail} error={errors.email} style={{ flex: '1 1 200px' }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={cInput} />
          </CField>
          <CField label={t.colPhone} error={errors.phone} style={{ flex: '1 1 160px' }}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0901234567" style={cInput} />
          </CField>
        </div>
        <CField label={t.usrPassword} error={errors.password}>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" style={cInput} />
          <PasswordStrengthBar password={password} />
          <span style={{ fontSize: 11.5, color: '#a59fbb' }}>{t.usrPasswordHint}</span>
        </CField>
        <div style={{ display: 'flex', gap: 12 }}>
          <CField label={t.colRole} style={{ flex: 1 }}>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={cInput}>
              <option value="USER">{t.roleUser}</option>
              <option value="ADMIN">{t.roleAdmin}</option>
            </select>
          </CField>
          <CField label={t.filterPlan} style={{ flex: 1 }}>
            <select value={plan} onChange={(e) => setPlan(e.target.value as UserPlan)} style={cInput}>
              <option value="FREE">Free</option>
              <option value="PLUS">Plus</option>
              <option value="PRO">Pro</option>
            </select>
          </CField>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.cancel}</button>
          <button onClick={submit} disabled={busy} style={{ flex: 1, border: 'none', background: 'var(--brand)', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>{t.usrCreate}</button>
        </div>
      </div>
    </Modal>
  );
}

function CField({ label, error, style, children }: { label: string; error?: string; style?: React.CSSProperties; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#8a85a0', letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{error}</span>}
    </label>
  );
}

const cInput = { width: '100%', height: 40, border: '1px solid #ece8f6', borderRadius: 10, padding: '0 12px', fontSize: 13.5, color: '#241f3a', outline: 'none', background: '#fff' } as const;
